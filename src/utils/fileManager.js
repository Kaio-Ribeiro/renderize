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

/**
 * Copy image to different directory
 */
async function copyImage(sourceFilename, targetFilename, targetDir = null) {
  try {
    const sourceDir = config.image.tempDir;
    const destDir = targetDir || config.image.tempDir;
    
    const sourcePath = path.join(sourceDir, sourceFilename);
    const targetPath = path.join(destDir, targetFilename);
    
    // Ensure target directory exists
    await ensureDirectory(destDir);
    
    // Copy file
    await fs.copyFile(sourcePath, targetPath);
    
    // Get target file stats
    const stats = await fs.stat(targetPath);
    
    logger.info('Image copied successfully', {
      sourceFilename,
      targetFilename,
      targetDir: destDir,
      size: stats.size
    });
    
    return {
      filename: targetFilename,
      size: stats.size,
      created: stats.birthtime,
      path: targetPath
    };
    
  } catch (error) {
    logger.error('Failed to copy image', {
      sourceFilename,
      targetFilename,
      error: error.message
    });
    throw new Error(`Failed to copy image: ${error.message}`);
  }
}

/**
 * Move image to different directory
 */
async function moveImage(sourceFilename, targetFilename, targetDir = null) {
  try {
    const sourceDir = config.image.tempDir;
    const destDir = targetDir || config.image.tempDir;
    
    const sourcePath = path.join(sourceDir, sourceFilename);
    const targetPath = path.join(destDir, targetFilename);
    
    // Ensure target directory exists
    await ensureDirectory(destDir);
    
    // Move file (rename)
    await fs.rename(sourcePath, targetPath);
    
    // Get target file stats
    const stats = await fs.stat(targetPath);
    
    logger.info('Image moved successfully', {
      sourceFilename,
      targetFilename,
      targetDir: destDir,
      size: stats.size
    });
    
    return {
      filename: targetFilename,
      size: stats.size,
      created: stats.birthtime,
      path: targetPath
    };
    
  } catch (error) {
    logger.error('Failed to move image', {
      sourceFilename,
      targetFilename,
      error: error.message
    });
    throw new Error(`Failed to move image: ${error.message}`);
  }
}

/**
 * Get storage statistics
 */
async function getStorageStats(includeDetails = false) {
  try {
    const tempDir = config.image.tempDir;
    const directoryStats = await getDirectoryStats(tempDir);
    
    const stats = {
      directory: tempDir,
      totalImages: directoryStats.totalImages,
      totalSize: directoryStats.totalSize,
      totalSizeMB: directoryStats.totalSizeMB,
      freeSpace: null, // Will be populated if available
      usedSpace: directoryStats.totalSize,
      lastUpdate: new Date().toISOString()
    };
    
    // Try to get disk space info (may not work on all systems)
    try {
      const fsStats = await fs.stat(tempDir);
      // Note: Getting actual disk space requires additional libraries
      // For now, we'll just track our own usage
    } catch (error) {
      // Ignore disk space errors
    }
    
    if (includeDetails) {
      const images = await listImages(tempDir);
      stats.images = images.map(img => ({
        filename: img.filename,
        size: img.size,
        created: img.created,
        age: Date.now() - img.created.getTime()
      }));
    }
    
    return stats;
    
  } catch (error) {
    logger.error('Failed to get storage stats', { error: error.message });
    throw new Error(`Failed to get storage stats: ${error.message}`);
  }
}

/**
 * Validate image file
 */
async function validateImage(filename) {
  try {
    const tempDir = config.image.tempDir;
    const filepath = path.join(tempDir, filename);
    
    // Check if file exists
    const exists = await imageExists(filename);
    if (!exists) {
      return { valid: false, reason: 'File does not exist' };
    }
    
    // Check file extension
    if (!filename.toLowerCase().endsWith('.png')) {
      return { valid: false, reason: 'Invalid file extension' };
    }
    
    // Check filename format
    if (!filename.match(/^[a-zA-Z0-9\-_]+\.png$/)) {
      return { valid: false, reason: 'Invalid filename format' };
    }
    
    // Check file size
    const stats = await fs.stat(filepath);
    const maxSize = config.image.maxSize || 10 * 1024 * 1024; // 10MB default
    
    if (stats.size > maxSize) {
      return { valid: false, reason: 'File too large' };
    }
    
    if (stats.size === 0) {
      return { valid: false, reason: 'Empty file' };
    }
    
    // Basic PNG header check
    const buffer = await fs.readFile(filepath, { start: 0, end: 7 });
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    if (!buffer.equals(pngSignature)) {
      return { valid: false, reason: 'Invalid PNG signature' };
    }
    
    return { valid: true, size: stats.size, created: stats.birthtime };
    
  } catch (error) {
    logger.error('Failed to validate image', { filename, error: error.message });
    return { valid: false, reason: error.message };
  }
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
  generateImageUrl,
  copyImage,
  moveImage,
  getStorageStats,
  validateImage
};