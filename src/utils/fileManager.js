const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('../config');

/**
 * File management utilities for images
 */

/**
 * Generate unique filename for screenshot
 */
function generateFilename(url, selector, extension = 'png') {
  const timestamp = Date.now();
  const hash = crypto
    .createHash('md5')
    .update(`${url}-${selector}-${timestamp}`)
    .digest('hex');
  
  return `screenshot-${hash}-${timestamp}.${extension}`;
}

/**
 * Save image buffer to file
 */
async function saveImage(imageBuffer, filename = null, customTempDir = null) {
  try {
    const tempDir = customTempDir || config.image.tempDir;
    // Ensure temp directory exists
    await ensureDirectory(tempDir);
    
    // Generate filename if not provided
    if (!filename) {
      filename = generateFilename('unknown', 'unknown');
    }
    
    const filepath = path.join(tempDir, filename);
    
    // Write buffer to file
    await fs.writeFile(filepath, imageBuffer);
    
    // Get file stats
    const stats = await fs.stat(filepath);
    
    logger.info('Image saved successfully', {
      filename,
      filepath,
      size: stats.size
    });
    
    return {
      filename,
      filepath,
      size: stats.size,
      created: stats.birthtime
    };
    
  } catch (error) {
    logger.error('Failed to save image', { filename, error: error.message });
    throw new Error(`Failed to save image: ${error.message}`);
  }
}

/**
 * Delete image file
 */
async function deleteImage(filename) {
  try {
    const filepath = path.join(config.image.tempDir, filename);
    await fs.unlink(filepath);
    
    logger.debug('Image deleted successfully', { filename });
    return true;
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      logger.warn('Image file not found for deletion', { filename });
      return false;
    }
    
    logger.error('Failed to delete image', { filename, error: error.message });
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * Check if image file exists
 */
async function imageExists(filename) {
  try {
    const filepath = path.join(config.image.tempDir, filename);
    await fs.access(filepath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get image file information
 */
async function getImageInfo(filename) {
  try {
    const filepath = path.join(config.image.tempDir, filename);
    const stats = await fs.stat(filepath);
    
    return {
      filename,
      filepath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };
    
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        filename,
        exists: false,
        error: 'File not found'
      };
    }
    
    throw new Error(`Failed to get image info: ${error.message}`);
  }
}

/**
 * List all images in temp directory
 */
async function listImages() {
  try {
    await ensureDirectory(config.image.tempDir);
    
    const files = await fs.readdir(config.image.tempDir);
    const imageFiles = files.filter(file => 
      file.match(/\.(png|jpg|jpeg|gif|webp)$/i)
    );
    
    const imageInfos = await Promise.all(
      imageFiles.map(async (filename) => {
        try {
          return await getImageInfo(filename);
        } catch (error) {
          logger.warn('Error getting info for image', { filename, error: error.message });
          return null;
        }
      })
    );
    
    return imageInfos.filter(info => info !== null);
    
  } catch (error) {
    logger.error('Failed to list images', { error: error.message });
    throw new Error(`Failed to list images: ${error.message}`);
  }
}

/**
 * Clean old images based on age
 */
async function cleanOldImages(maxAgeMinutes = null) {
  try {
    const maxAge = maxAgeMinutes || config.image.maxAgeMinutes;
    const cutoffTime = Date.now() - (maxAge * 60 * 1000);
    
    const images = await listImages();
    let deletedCount = 0;
    
    for (const image of images) {
      if (image.exists && image.created.getTime() < cutoffTime) {
        try {
          await deleteImage(image.filename);
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete old image', { 
            filename: image.filename, 
            error: error.message 
          });
        }
      }
    }
    
    logger.info('Old images cleanup completed', { 
      deletedCount, 
      totalImages: images.length,
      maxAgeMinutes: maxAge
    });
    
    return { deletedCount, totalImages: images.length };
    
  } catch (error) {
    logger.error('Failed to clean old images', { error: error.message });
    throw new Error(`Failed to clean old images: ${error.message}`);
  }
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.access(dirPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.mkdir(dirPath, { recursive: true });
      logger.info('Directory created', { dirPath });
    } else {
      throw error;
    }
  }
}

/**
 * Get directory stats
 */
async function getDirectoryStats() {
  try {
    const images = await listImages();
    const totalSize = images.reduce((sum, img) => sum + (img.size || 0), 0);
    
    return {
      totalImages: images.length,
      totalSize,
      totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
      directory: config.image.tempDir
    };
    
  } catch (error) {
    logger.error('Failed to get directory stats', { error: error.message });
    throw new Error(`Failed to get directory stats: ${error.message}`);
  }
}

/**
 * Generate public URL for image
 */
function generateImageUrl(filename, baseUrl = null) {
  const base = baseUrl || config.api.baseUrl;
  return `${base}/images/${filename}`;
}

module.exports = {
  generateFilename,
  saveImage,
  deleteImage,
  imageExists,
  getImageInfo,
  listImages,
  cleanOldImages,
  ensureDirectory,
  getDirectoryStats,
  generateImageUrl
};