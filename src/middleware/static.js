const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');
const { getImageInfo } = require('../utils/fileManager');

/**
 * Static file server middleware with enhanced features
 */
function createStaticMiddleware() {
  const router = express.Router();
  
  // Serve static images with metadata headers
  router.get('/images/:filename', async (req, res, next) => {
    const { filename } = req.params;
    const requestId = req.requestId;
    
    try {
      // Validate filename format
      if (!filename.match(/^[a-zA-Z0-9\-_]+\.png$/)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid filename format',
          requestId
        });
      }
      
      // Get image info and check if exists
      const imageInfo = await getImageInfo(filename);
      
      if (!imageInfo.exists) {
        logger.warn('Image not found', {
          requestId,
          filename,
          ip: req.ip
        });
        
        return res.status(404).json({
          status: 'error',
          message: 'Image not found',
          filename,
          requestId
        });
      }
      
      // Set appropriate headers
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageInfo.size,
        'Cache-Control': 'public, max-age=86400', // 24 hours
        'Last-Modified': imageInfo.created.toUTCString(),
        'X-Image-Size': imageInfo.size,
        'X-Image-Created': imageInfo.created.toISOString()
      });
      
      // Log image access
      logger.info('Image served', {
        requestId,
        filename,
        size: imageInfo.size,
        age: Date.now() - imageInfo.created.getTime(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      // Stream the file
      const filePath = path.join(process.cwd(), 'images', filename);
      res.sendFile(filePath);
      
    } catch (error) {
      logger.error('Error serving static image', {
        requestId,
        filename,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Error serving image',
        requestId
      });
    }
  });
  
  // Image info endpoint
  router.get('/images/:filename/info', async (req, res) => {
    const { filename } = req.params;
    const requestId = req.requestId;
    
    try {
      // Validate filename format
      if (!filename.match(/^[a-zA-Z0-9\-_]+\.png$/)) {
        return res.status(400).json({
          status: 'error',
          message: 'Invalid filename format',
          requestId
        });
      }
      
      const imageInfo = await getImageInfo(filename);
      
      if (!imageInfo.exists) {
        return res.status(404).json({
          status: 'error',
          message: 'Image not found',
          filename,
          requestId
        });
      }
      
      res.json({
        status: 'success',
        filename: imageInfo.filename,
        size: imageInfo.size,
        sizeFormatted: formatFileSize(imageInfo.size),
        created: imageInfo.created.toISOString(),
        age: Date.now() - imageInfo.created.getTime(),
        ageFormatted: formatDuration(Date.now() - imageInfo.created.getTime()),
        url: `/images/${filename}`,
        requestId
      });
      
    } catch (error) {
      logger.error('Error getting image info', {
        requestId,
        filename,
        error: error.message
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Error getting image info',
        requestId
      });
    }
  });
  
  // Images directory listing (for debugging in development)
  router.get('/images', async (req, res) => {
    const requestId = req.requestId;
    
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        status: 'error',
        message: 'Directory listing not available in production',
        requestId
      });
    }
    
    try {
      const imagesDir = path.join(process.cwd(), 'images');
      
      // Ensure directory exists
      try {
        await fs.access(imagesDir);
      } catch {
        return res.json({
          status: 'success',
          images: [],
          total: 0,
          requestId
        });
      }
      
      const files = await fs.readdir(imagesDir);
      const pngFiles = files.filter(file => file.endsWith('.png'));
      
      const images = await Promise.all(
        pngFiles.map(async (filename) => {
          const info = await getImageInfo(filename);
          return {
            filename: info.filename,
            size: info.size,
            sizeFormatted: formatFileSize(info.size),
            created: info.created.toISOString(),
            age: Date.now() - info.created.getTime(),
            ageFormatted: formatDuration(Date.now() - info.created.getTime()),
            url: `/images/${filename}`
          };
        })
      );
      
      // Sort by creation date (newest first)
      images.sort((a, b) => new Date(b.created) - new Date(a.created));
      
      res.json({
        status: 'success',
        images,
        total: images.length,
        totalSize: images.reduce((sum, img) => sum + img.size, 0),
        requestId
      });
      
    } catch (error) {
      logger.error('Error listing images', {
        requestId,
        error: error.message
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Error listing images',
        requestId
      });
    }
  });
  
  return router;
}

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

module.exports = { createStaticMiddleware };