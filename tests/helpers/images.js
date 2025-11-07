const fs = require('fs').promises;
const path = require('path');
const { saveImage, deleteImage, listImages } = require('../../src/utils/fileManager');

/**
 * Helper functions for managing test images
 */

/**
 * Create a simple test PNG image
 */
function createTestImageBuffer() {
  // Simple 1x1 PNG image buffer (transparent pixel)
  return Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // Width: 1
    0x00, 0x00, 0x00, 0x01, // Height: 1
    0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth: 8, Color type: 6 (RGBA), Compression: 0, Filter: 0, Interlace: 0
    0x1F, 0x15, 0xC4, 0x89, // CRC
    0x00, 0x00, 0x00, 0x0B, // IDAT chunk length
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x78, 0x9C, 0x62, 0x00, 0x02, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0D, // Compressed image data
    0x0A, 0x2D, 0xB4, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk length
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
}

/**
 * Create a test image with given filename
 */
async function createTestImage(filename = null) {
  const imageBuffer = createTestImageBuffer();
  
  if (!filename) {
    filename = `test-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
  }
  
  const result = await saveImage(imageBuffer, filename);
  return result.filename;
}

/**
 * Create multiple test images
 */
async function createMultipleTestImages(count = 3, prefix = 'test') {
  const filenames = [];
  
  for (let i = 0; i < count; i++) {
    const filename = `${prefix}-${Date.now()}-${i}.png`;
    const createdFilename = await createTestImage(filename);
    filenames.push(createdFilename);
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  return filenames;
}

/**
 * Clean up test images (delete all images starting with 'test-')
 */
async function cleanupTestImages() {
  try {
    const images = await listImages();
    const testImages = images.filter(img => 
      img.filename.startsWith('test-') || 
      img.filename.includes('-test') ||
      img.filename.startsWith('cleanup-') ||
      img.filename.startsWith('validate-') ||
      img.filename.startsWith('delete-') ||
      img.filename.startsWith('serve-') ||
      img.filename.startsWith('info-')
    );
    
    for (const image of testImages) {
      try {
        await deleteImage(image.filename);
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup test image ${image.filename}:`, error.message);
      }
    }
    
    return testImages.length;
  } catch (error) {
    console.warn('Failed to cleanup test images:', error.message);
    return 0;
  }
}

/**
 * Create an old test image (by modifying its timestamp)
 */
async function createOldTestImage(filename = null, ageMs = 25 * 60 * 60 * 1000) { // 25 hours old by default
  const createdFilename = await createTestImage(filename);
  
  try {
    const tempDir = require('../../src/config').image.tempDir;
    const filepath = path.join(tempDir, createdFilename);
    
    // Set file modification time to make it appear old
    const oldDate = new Date(Date.now() - ageMs);
    await fs.utimes(filepath, oldDate, oldDate);
    
    return createdFilename;
  } catch (error) {
    console.warn(`Failed to make test image old: ${error.message}`);
    return createdFilename;
  }
}

/**
 * Create test images with specific sizes (approximately)
 */
async function createTestImageWithSize(targetSizeBytes = 1000, filename = null) {
  // Create a larger test image by repeating data
  const baseBuffer = createTestImageBuffer();
  const padding = Math.max(0, targetSizeBytes - baseBuffer.length);
  
  // Add padding (note: this creates an invalid PNG, but for size testing it's ok)
  const paddedBuffer = Buffer.concat([
    baseBuffer,
    Buffer.alloc(padding, 0)
  ]);
  
  if (!filename) {
    filename = `test-size-${targetSizeBytes}-${Date.now()}.png`;
  }
  
  const result = await saveImage(paddedBuffer, filename);
  return result.filename;
}

/**
 * Wait for file system operations to complete
 */
async function waitForFileSystem(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  createTestImageBuffer,
  createTestImage,
  createMultipleTestImages,
  cleanupTestImages,
  createOldTestImage,
  createTestImageWithSize,
  waitForFileSystem
};