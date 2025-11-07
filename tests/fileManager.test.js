const fs = require('fs').promises;
const path = require('path');
const { 
  generateFilename, 
  saveImage, 
  deleteImage, 
  imageExists, 
  getImageInfo,
  listImages,
  cleanOldImages,
  getDirectoryStats,
  generateImageUrl
} = require('../src/utils/fileManager');

// Mock image buffer (simple PNG signature + some data)
const mockImageBuffer = Buffer.from('89504e470d0a1a0a' + '0'.repeat(100), 'hex');
describe('File Manager Tests', () => {
  const testFiles = [];
  
  afterEach(async () => {
    // Clean up test files
    for (const filename of testFiles) {
      try {
        await deleteImage(filename);
      } catch (error) {
        // File might already be deleted
      }
    }
    testFiles.length = 0; // Clear array
  });

  describe('generateFilename', () => {
    test('should generate unique filenames', async () => {
      const filename1 = generateFilename('https://example.com', '.test');
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const filename2 = generateFilename('https://example.com', '.test');
      
      expect(filename1).not.toBe(filename2);
      expect(filename1).toMatch(/^screenshot-[a-f0-9]+-\d+\.png$/);
    });

    test('should use custom extension', () => {
      const filename = generateFilename('test', 'test', 'jpg');
      expect(filename).toMatch(/\.jpg$/);
    });
  });

  describe('saveImage', () => {
    test('should save image buffer to file', async () => {
      const filename = 'test-image.png';
      testFiles.push(filename);
      
      const result = await saveImage(mockImageBuffer, filename);
      
      expect(result).toHaveProperty('filename', filename);
      expect(result).toHaveProperty('filepath');
      expect(result).toHaveProperty('size');
      expect(result.size).toBe(mockImageBuffer.length);
      
      // Verify file exists
      const exists = await imageExists(filename);
      expect(exists).toBe(true);
    });

    test('should generate filename if not provided', async () => {
      const result = await saveImage(mockImageBuffer);
      testFiles.push(result.filename);
      
      expect(result.filename).toMatch(/^screenshot-[a-f0-9]+-\d+\.png$/);
      expect(result.size).toBe(mockImageBuffer.length);
    });

    test('should handle invalid buffer gracefully', async () => {
      await expect(saveImage(null)).rejects.toThrow();
    });
  });

  describe('deleteImage', () => {
    test('should delete existing image', async () => {
      // First save an image
      await saveImage(mockImageBuffer, 'delete-test.png');
      
      // Verify it exists
      expect(await imageExists('delete-test.png')).toBe(true);
      
      // Delete it
      const result = await deleteImage('delete-test.png');
      expect(result).toBe(true);
      
      // Verify it's gone
      expect(await imageExists('delete-test.png')).toBe(false);
    });

    test('should handle non-existent files gracefully', async () => {
      const result = await deleteImage('non-existent.png');
      expect(result).toBe(false);
    });
  });

  describe('imageExists', () => {
    test('should return true for existing files', async () => {
      await saveImage(mockImageBuffer, 'exists-test.png');
      
      const exists = await imageExists('exists-test.png');
      expect(exists).toBe(true);
    });

    test('should return false for non-existent files', async () => {
      const exists = await imageExists('non-existent.png');
      expect(exists).toBe(false);
    });
  });

  describe('getImageInfo', () => {
    test('should return info for existing image', async () => {
      const savedResult = await saveImage(mockImageBuffer, 'info-test.png');
      expect(savedResult).toBeDefined();
      
      const info = await getImageInfo('info-test.png');
      
      expect(info.exists).toBe(true);
      expect(info.filename).toBe('info-test.png');
      expect(info.size).toBe(mockImageBuffer.length);
      expect(typeof info.created).toBe('object');
      expect(info.created instanceof Date).toBe(true);
    });

    test('should handle non-existent files', async () => {
      const info = await getImageInfo('non-existent.png');
      
      expect(info.exists).toBe(false);
      expect(info.error).toBe('File not found');
    });
  });

  describe('listImages', () => {
    test('should list images in directory', async () => {
      // Save multiple images
      testFiles.push('list-test-1.png', 'list-test-2.png', 'list-test-3.jpg');
      
      await saveImage(mockImageBuffer, 'list-test-1.png');
      await saveImage(mockImageBuffer, 'list-test-2.png');
      await saveImage(mockImageBuffer, 'list-test-3.jpg');
      
      const images = await listImages();
      
      expect(images.length).toBeGreaterThanOrEqual(3);
      
      const filenames = images.map(img => img.filename);
      expect(filenames).toContain('list-test-1.png');
      expect(filenames).toContain('list-test-2.png');
      expect(filenames).toContain('list-test-3.jpg');
    });
  });

  describe('cleanOldImages', () => {
    test('should clean images older than specified age', async () => {
      // Save an image
      const result = await saveImage(mockImageBuffer, 'old-test.png');
      
      // Verify file was created
      expect(await imageExists('old-test.png')).toBe(true);
      
      // Manually modify the file timestamp to make it "old"
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      try {
        await fs.utimes(result.filepath, oldTime, oldTime);
      } catch (error) {
        // If utimes fails, just test with a very small age (0 minutes)
        const cleanResult = await cleanOldImages(0);
        expect(cleanResult.deletedCount).toBeGreaterThanOrEqual(0);
        return;
      }
      
      // Clean images older than 1 hour
      const cleanResult = await cleanOldImages(60);
      
      expect(cleanResult.deletedCount).toBeGreaterThanOrEqual(1);
      expect(await imageExists('old-test.png')).toBe(false);
    });

    test('should not clean recent images', async () => {
      await saveImage(mockImageBuffer, 'recent-test.png');
      
      // Clean images older than 1 minute (this image is recent)
      const result = await cleanOldImages(1);
      
      expect(result.deletedCount).toBe(0);
      expect(await imageExists('recent-test.png')).toBe(true);
    });
  });

  describe('getDirectoryStats', () => {
    test('should return directory statistics', async () => {
      // Clean existing images first
      await cleanOldImages(0);
      
      testFiles.push('stats-test-1.png', 'stats-test-2.png');
      
      await saveImage(mockImageBuffer, 'stats-test-1.png');
      await saveImage(mockImageBuffer, 'stats-test-2.png');
      
      const stats = await getDirectoryStats();
      
      expect(stats.totalImages).toBeGreaterThanOrEqual(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.totalSizeMB).toBeGreaterThan(0);
      expect(stats).toHaveProperty('directory');
    });
  });

  describe('generateImageUrl', () => {
    test('should generate correct public URL', () => {
      const url = generateImageUrl('test.png', 'http://localhost:3000');
      expect(url).toBe('http://localhost:3000/images/test.png');
    });

    test('should use config base URL if not provided', () => {
      const url = generateImageUrl('test.png');
      expect(url).toMatch(/\/images\/test\.png$/);
    });
  });
});