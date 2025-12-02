const { chromium } = require('playwright');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Screenshot capture service using Playwright
 */
class ScreenshotService {
  constructor() {
    this.browser = null;
    this.isInitialized = false;
  }

  /**
   * Initialize browser instance
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      logger.info('Initializing Playwright browser...');
      
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080'
        ]
      });

      this.isInitialized = true;
      logger.info('Playwright browser initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw new Error(`Browser initialization failed: ${error.message}`);
    }
  }

  /**
   * Capture screenshot of specific element
   */
  async captureElement(url, selector, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let context = null;
    let page = null;

    try {
      logger.info('Starting screenshot capture', { url, selector });

      // Create new browser context
      context = await this.browser.newContext({
        viewport: {
          width: config.browser.viewport.width,
          height: config.browser.viewport.height
        },
        userAgent: config.browser.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

      // Create new page
      page = await context.newPage();

      // Set timeout for navigation
      page.setDefaultTimeout(config.browser.timeout);

      // Navigate to URL
      logger.debug('Navigating to URL', { url, timeout: config.browser.timeout });
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: config.browser.timeout 
        });
      } catch (navigateError) {
        logger.error('Navigation failed', {
          url,
          error: navigateError.message,
          timeout: config.browser.timeout
        });
        throw navigateError;
      }

      // Wait for element with intelligent timeout strategy
      logger.debug('Waiting for element', { selector });
      
      try {
        // Try to find element quickly first (5 seconds)
        await page.waitForSelector(selector, { 
          state: 'visible',
          timeout: 5000 
        });
      } catch (quickError) {
        // If not found quickly, wait for network to settle and try again
        logger.debug('Element not immediately visible, waiting for network idle');
        await page.waitForLoadState('networkidle', { timeout: 10000 });
        await page.waitForSelector(selector, { 
          state: 'visible',
          timeout: config.browser.timeout - 15000 // Reserve time for other operations
        });
      }

      // Short wait for animations only if needed
      if (options.waitForAnimations !== false) {
        await page.waitForTimeout(300);
      }

      // Capture screenshot of specific element
      logger.debug('Capturing element screenshot', { selector });
      const element = await page.locator(selector);
      
      if (!(await element.count())) {
        throw new Error(`Element not found: ${selector}`);
      }

      const screenshotBuffer = await element.screenshot({
        type: 'png'
        // Note: PNG doesn't support quality setting in Playwright
      });

      logger.info('Screenshot captured successfully', { 
        url, 
        selector, 
        size: screenshotBuffer.length 
      });

      return screenshotBuffer;

    } catch (error) {
      logger.error('Screenshot capture failed', { 
        url, 
        selector, 
        error: error.message 
      });
      
      // Re-throw with more context
      if (error.message.includes('timeout')) {
        throw new Error(`Timeout waiting for element "${selector}" on ${url}`);
      } else if (error.message.includes('net::ERR_')) {
        throw new Error(`Failed to load page: ${url}`);
      } else if (error.message.includes('Element not found')) {
        throw new Error(`CSS selector "${selector}" not found on page`);
      } else {
        throw new Error(`Screenshot capture failed: ${error.message}`);
      }

    } finally {
      // Always cleanup page and context
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupError) {
        logger.warn('Cleanup error:', cleanupError);
      }
    }
  }

  /**
   * Capture full page screenshot
   */
  async captureFullPage(url, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let context = null;
    let page = null;

    try {
      logger.info('Starting full page screenshot', { url });

      context = await this.browser.newContext({
        viewport: {
          width: config.browser.viewport.width,
          height: config.browser.viewport.height
        },
        userAgent: config.browser.userAgent
      });

      page = await context.newPage();
      page.setDefaultTimeout(config.browser.timeout);

      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: config.browser.timeout 
      });

      const screenshotBuffer = await page.screenshot({
        type: 'png',
        fullPage: true
        // Note: PNG doesn't support quality setting in Playwright
      });

      logger.info('Full page screenshot captured', { 
        url, 
        size: screenshotBuffer.length 
      });

      return screenshotBuffer;

    } catch (error) {
      logger.error('Full page screenshot failed', { url, error: error.message });
      throw new Error(`Full page screenshot failed: ${error.message}`);

    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupError) {
        logger.warn('Cleanup error:', cleanupError);
      }
    }
  }

  /**
   * Check if URL is accessible
   */
  async checkUrl(url) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let context = null;
    let page = null;

    try {
      logger.debug('Checking URL accessibility', { url, normalizedUrl: url });
      
      context = await this.browser.newContext();
      page = await context.newPage();
      page.setDefaultTimeout(config.browser.timeout);
      
      const response = await page.goto(url, { 
        timeout: config.browser.timeout,
        waitUntil: 'domcontentloaded'
      });

      return {
        accessible: true,
        status: response.status(),
        statusText: response.statusText(),
        url: response.url()
      };

    } catch (error) {
      logger.warn('URL accessibility check failed', {
        url,
        error: error.message,
        timeout: config.browser.timeout
      });
      
      return {
        accessible: false,
        error: error.message,
        timeout: config.browser.timeout
      };

    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupError) {
        logger.warn('Cleanup error:', cleanupError);
      }
    }
  }

  /**
   * Get page information
   */
  async getPageInfo(url) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    let context = null;
    let page = null;

    try {
      context = await this.browser.newContext();
      page = await context.newPage();
      
      await page.goto(url, { 
        timeout: config.browser.timeout,
        waitUntil: 'networkidle'
      });

      const pageInfo = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        userAgent: navigator.userAgent
      }));

      return pageInfo;

    } catch (error) {
      throw new Error(`Failed to get page info: ${error.message}`);

    } finally {
      try {
        if (page) await page.close();
        if (context) await context.close();
      } catch (cleanupError) {
        logger.warn('Cleanup error:', cleanupError);
      }
    }
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
        this.browser = null;
        this.isInitialized = false;
        logger.info('Browser closed successfully');
      } catch (error) {
        logger.error('Error closing browser:', error);
      }
    }
  }

  /**
   * Get browser status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      connected: this.browser && this.browser.isConnected(),
      version: this.browser ? this.browser.version() : null
    };
  }
}

// Create singleton instance
const screenshotService = new ScreenshotService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await screenshotService.close();
});

process.on('SIGINT', async () => {
  await screenshotService.close();
});

module.exports = screenshotService;