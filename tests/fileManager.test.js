const {
  saveImage,
  deleteImage,
  imageExists,
  generateFilename,
  cleanOldImages
} = require('../src/utils/fileManager');

// Mock image buffer
const mockImageBuffer = Buffer.from('89504e470d0a1a0a' + '0'.repeat(100), 'hex');

describe('File Manager Tests', () => {
  const testFiles = [];
  
  afterEach(async () => {
    // Clean up test files
    for (const filename of testFiles) {
      try {
        await deleteImage(filename);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testFiles.length = 0;
  });

  afterAll(async () => {
    // Final cleanup
    try {
      await cleanOldImages(0);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should generate unique filenames', async () => {
    const filename1 = generateFilename('test-url', 'body');
    
    // Add small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 1));
    
    const filename2 = generateFilename('test-url', 'body');
    
    expect(filename1).toMatch(/screenshot-.+\.png$/);
    expect(filename2).toMatch(/screenshot-.+\.png$/);
    expect(filename1).not.toBe(filename2); // Should be unique
  });

  test('should save and check image existence', async () => {
    const filename = 'test-save.png';
    testFiles.push(filename);
    
    const result = await saveImage(mockImageBuffer, filename);
    
    expect(result).toHaveProperty('filename', filename);
    expect(result).toHaveProperty('size', mockImageBuffer.length);
    expect(await imageExists(filename)).toBe(true);
  });

  test('should delete images', async () => {
    const filename = 'test-delete.png';
    testFiles.push(filename);
    
    await saveImage(mockImageBuffer, filename);
    expect(await imageExists(filename)).toBe(true);
    
    const deleted = await deleteImage(filename);
    expect(deleted).toBe(true);
    expect(await imageExists(filename)).toBe(false);
  });

  test('should clean old images', async () => {
    const filename = 'test-cleanup.png';
    testFiles.push(filename);
    
    await saveImage(mockImageBuffer, filename);
    
    // Clean with 0 age (should delete all)
    const result = await cleanOldImages(0);
    
    expect(result).toHaveProperty('deletedCount');
    expect(typeof result.deletedCount).toBe('number');
  });
});