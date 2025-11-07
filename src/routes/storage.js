const express = require('express');
const { body, query } = require('express-validator');
const { basicAuth } = require('../middleware/auth');
const { createValidator } = require('../utils/validation');
const logger = require('../utils/logger');

// Custom validation middleware for storage endpoints
const validateStorageRequest = (req, res, next) => {
  // Simple validation middleware that just passes through
  // Specific validation is handled by express-validator chains
  next();
};
const {
  getStorageStats,
  cleanOldImages,
  validateImage,
  deleteImage,
  listImages,
  getImageInfo
} = require('../utils/fileManager');

const router = express.Router();

// Apply authentication to all storage routes
router.use(basicAuth);

/**
 * GET /storage/stats
 * Get storage statistics
 */
router.get('/stats', 
  query('details').optional().isBoolean(),
  validateStorageRequest,
  async (req, res) => {
    const requestId = req.requestId;
    const user = req.user.id;
    const includeDetails = req.query.details === 'true';
    
    try {
      logger.info('Getting storage statistics', {
        requestId,
        user,
        includeDetails
      });
      
      const stats = await getStorageStats(includeDetails);
      
      res.json({
        status: 'success',
        data: stats,
        requestId
      });
      
    } catch (error) {
      logger.error('Failed to get storage stats', {
        requestId,
        user,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to get storage statistics',
        requestId
      });
    }
  }
);

/**
 * POST /storage/cleanup
 * Clean old images
 */
router.post('/cleanup',
  body('maxAge').optional().isInt({ min: 1 }),
  body('maxFiles').optional().isInt({ min: 0 }),
  validateStorageRequest,
  async (req, res) => {
    const requestId = req.requestId;
    const user = req.user.id;
    const maxAge = req.body.maxAge || 24 * 60 * 60 * 1000; // 24 hours default
    const maxFiles = req.body.maxFiles;
    
    try {
      logger.info('Starting storage cleanup', {
        requestId,
        user,
        maxAge,
        maxFiles
      });
      
      let result;
      
      if (maxFiles !== undefined) {
        // Clean by file count
        const images = await listImages();
        
        if (images.length > maxFiles) {
          // Sort by creation date (oldest first)
          const sortedImages = images.sort((a, b) => a.created - b.created);
          const imagesToDelete = sortedImages.slice(0, images.length - maxFiles);
          
          let deletedCount = 0;
          let deletedSize = 0;
          
          for (const image of imagesToDelete) {
            try {
              await deleteImage(image.filename);
              deletedCount++;
              deletedSize += image.size;
            } catch (error) {
              logger.warn('Failed to delete image during cleanup', {
                filename: image.filename,
                error: error.message
              });
            }
          }
          
          result = { deletedCount, deletedSize };
        } else {
          result = { deletedCount: 0, deletedSize: 0 };
        }
      } else {
        // Clean by age
        result = await cleanOldImages(maxAge);
      }
      
      logger.info('Storage cleanup completed', {
        requestId,
        user,
        deletedCount: result.deletedCount,
        deletedSize: result.deletedSize
      });
      
      res.json({
        status: 'success',
        data: {
          deletedCount: result.deletedCount,
          deletedSize: result.deletedSize,
          deletedSizeFormatted: formatFileSize(result.deletedSize),
          maxAge: maxFiles ? null : maxAge,
          maxFiles: maxFiles || null
        },
        requestId
      });
      
    } catch (error) {
      logger.error('Storage cleanup failed', {
        requestId,
        user,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Storage cleanup failed',
        requestId
      });
    }
  }
);

/**
 * GET /storage/images
 * List all images with pagination
 */
router.get('/images',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sortBy').optional().isIn(['created', 'size', 'filename']),
  query('order').optional().isIn(['asc', 'desc']),
  validateStorageRequest,
  async (req, res) => {
    const requestId = req.requestId;
    const user = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'created';
    const order = req.query.order || 'desc';
    
    try {
      logger.info('Listing images', {
        requestId,
        user,
        page,
        limit,
        sortBy,
        order
      });
      
      const images = await listImages();
      
      // Sort images
      images.sort((a, b) => {
        let valueA = a[sortBy];
        let valueB = b[sortBy];
        
        if (sortBy === 'created') {
          valueA = valueA.getTime();
          valueB = valueB.getTime();
        }
        
        if (order === 'asc') {
          return valueA > valueB ? 1 : -1;
        } else {
          return valueA < valueB ? 1 : -1;
        }
      });
      
      // Paginate
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedImages = images.slice(startIndex, endIndex);
      
      // Format response
      const formattedImages = paginatedImages.map(img => ({
        filename: img.filename,
        size: img.size,
        sizeFormatted: formatFileSize(img.size),
        created: img.created.toISOString(),
        age: Date.now() - img.created.getTime(),
        ageFormatted: formatDuration(Date.now() - img.created.getTime()),
        url: `/images/${img.filename}`
      }));
      
      res.json({
        status: 'success',
        data: {
          images: formattedImages,
          pagination: {
            page,
            limit,
            total: images.length,
            pages: Math.ceil(images.length / limit),
            hasNext: endIndex < images.length,
            hasPrev: page > 1
          },
          sort: { sortBy, order }
        },
        requestId
      });
      
    } catch (error) {
      logger.error('Failed to list images', {
        requestId,
        user,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Failed to list images',
        requestId
      });
    }
  }
);

/**
 * POST /storage/images/:filename/validate
 * Validate specific image
 */
router.post('/images/:filename/validate', async (req, res) => {
  const { filename } = req.params;
  const requestId = req.requestId;
  const user = req.user.id;
  
  try {
    logger.info('Validating image', {
      requestId,
      user,
      filename
    });
    
    const validation = await validateImage(filename);
    
    res.json({
      status: 'success',
      data: {
        filename,
        ...validation
      },
      requestId
    });
    
  } catch (error) {
    logger.error('Image validation failed', {
      requestId,
      user,
      filename,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Image validation failed',
      requestId
    });
  }
});

/**
 * DELETE /storage/images/:filename
 * Delete specific image
 */
router.delete('/images/:filename', async (req, res) => {
  const { filename } = req.params;
  const requestId = req.requestId;
  const user = req.user.id;
  
  try {
    // Validate filename format
    if (!filename.match(/^[a-zA-Z0-9\-_]+\.png$/)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid filename format',
        requestId
      });
    }
    
    logger.info('Deleting image', {
      requestId,
      user,
      filename
    });
    
    // Get image info before deletion
    const imageInfo = await getImageInfo(filename);
    
    if (!imageInfo.exists) {
      return res.status(404).json({
        status: 'error',
        message: 'Image not found',
        filename,
        requestId
      });
    }
    
    // Delete the image
    const success = await deleteImage(filename);
    
    if (success) {
      logger.info('Image deleted successfully', {
        requestId,
        user,
        filename,
        size: imageInfo.size
      });
      
      res.json({
        status: 'success',
        message: 'Image deleted successfully',
        data: {
          filename,
          size: imageInfo.size,
          sizeFormatted: formatFileSize(imageInfo.size)
        },
        requestId
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to delete image',
        requestId
      });
    }
    
  } catch (error) {
    logger.error('Failed to delete image', {
      requestId,
      user,
      filename,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to delete image',
      requestId
    });
  }
});

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = router;