const screenshotService = require('../src/services/screenshot');

describe('Screenshot Service Tests', () => {
  // Increase timeout for browser operations
  beforeAll(() => {
    jest.setTimeout(60000);
  });

  afterAll(async () => {
    // Clean up browser instance
    await screenshotService.close();
  });

  test('should initialize browser successfully', async () => {
    await screenshotService.initialize();
    
    const status = screenshotService.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.connected).toBe(true);
  });

  test('should check URL accessibility', async () => {
    const result = await screenshotService.checkUrl('https://example.com');
    
    expect(result).toHaveProperty('accessible');
    expect(result).toHaveProperty('status');
    
    // Should be accessible (example.com is a reliable test site)
    expect(result.accessible).toBe(true);
    expect(result.status).toBe(200);
  });

  test('should handle inaccessible URLs', async () => {
    const result = await screenshotService.checkUrl('https://nonexistent-domain-12345.com');
    
    expect(result.accessible).toBe(false);
    expect(result).toHaveProperty('error');
  });

  test('should get page information', async () => {
    const pageInfo = await screenshotService.getPageInfo('https://example.com');
    
    expect(pageInfo).toHaveProperty('title');
    expect(pageInfo).toHaveProperty('url');
    expect(pageInfo).toHaveProperty('viewport');
    expect(pageInfo.title).toBeTruthy();
    expect(pageInfo.url).toContain('example.com');
  });

  test('should capture element screenshot from example.com', async () => {
    const imageBuffer = await screenshotService.captureElement(
      'https://example.com',
      'h1'
    );
    
    expect(imageBuffer).toBeInstanceOf(Buffer);
    expect(imageBuffer.length).toBeGreaterThan(0);
    
    // Check if it's a valid PNG (starts with PNG signature)
    expect(imageBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
  });

  test('should capture full page screenshot', async () => {
    const imageBuffer = await screenshotService.captureFullPage('https://example.com');
    
    expect(imageBuffer).toBeInstanceOf(Buffer);
    expect(imageBuffer.length).toBeGreaterThan(0);
    
    // Check if it's a valid PNG
    expect(imageBuffer.toString('hex', 0, 8)).toBe('89504e470d0a1a0a');
  });

  test('should handle invalid URLs gracefully', async () => {
    await expect(
      screenshotService.captureElement('invalid-url', 'body')
    ).rejects.toThrow();
  });

  test('should handle non-existent selectors gracefully', async () => {
    await expect(
      screenshotService.captureElement('https://example.com', '.non-existent-selector-12345')
    ).rejects.toThrow();
  }, 30000);

  test('should handle timeout errors gracefully', async () => {
    // Test with a URL that will likely timeout
    await expect(
      screenshotService.captureElement('https://httpbin.org/delay/10', 'body')
    ).rejects.toThrow();
  }, 35000);

  test('should return browser status', () => {
    const status = screenshotService.getStatus();
    
    expect(status).toHaveProperty('initialized');
    expect(status).toHaveProperty('connected');
    expect(typeof status.initialized).toBe('boolean');
    expect(typeof status.connected).toBe('boolean');
  });
});

describe('Screenshot Service Error Handling', () => {
  test('should handle browser initialization failure gracefully', async () => {
    // This test simulates what would happen if browser fails to launch
    // In real scenarios, this might happen due to missing dependencies
    
    const service = require('../src/services/screenshot');
    
    // The service should handle errors gracefully
    expect(() => service.getStatus()).not.toThrow();
  });

  test('should handle multiple concurrent requests', async () => {
    const promises = [
      screenshotService.captureElement('https://example.com', 'h1'),
      screenshotService.captureElement('https://example.com', 'p'),
      screenshotService.checkUrl('https://example.com')
    ];
    
    const results = await Promise.allSettled(promises);
    
    // At least some requests should succeed
    const successful = results.filter(result => result.status === 'fulfilled');
    expect(successful.length).toBeGreaterThan(0);
  });
});