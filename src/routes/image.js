const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const screenshotService = require('../services/screenshot');
const { saveImage, generateImageUrl, generateFilename } = require('../utils/fileManager');
const { validateImageParams, createValidator } = require('../utils/validation');

// Validation middleware for image conversion
const validateImageRequest = createValidator(validateImageParams);

// Main image conversion endpoint
router.post('/', validateImageRequest, async (req, res) => {
  const requestId = req.requestId || 'unknown';
  const startTime = Date.now();
  
  try {
    const { url, selector } = req.validatedData;
    const user = req.user?.id || 'anonymous';
    
    logger.info('Starting image conversion', {
      requestId,
      user,
      url,
      selector,
      ip: req.ip
    });

    // Capture screenshot directly - error handling is done within the service
    logger.debug('Capturing screenshot', { requestId, url, selector });
    const imageBuffer = await screenshotService.captureElement(url, selector, {
      waitForAnimations: true
    });

    // Step 3: Generate filename and save image
    const filename = generateFilename(url, selector);
    logger.debug('Saving image', { requestId, filename, size: imageBuffer.length });
    
    const savedImage = await saveImage(imageBuffer, filename);
    
    // Step 4: Generate public URL
    const imageUrl = generateImageUrl(filename, req.get('host') 
      ? `${req.protocol}://${req.get('host')}` 
      : undefined
    );

    const duration = Date.now() - startTime;
    
    logger.info('Image conversion completed successfully', {
      requestId,
      user,
      url,
      selector,
      filename,
      fileSize: savedImage.size,
      duration: `${duration}ms`
    });

    // Return success response
    res.json({
      url: imageUrl,
      filename,
      size: savedImage.size,
      created: savedImage.created,
      requestId,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Image conversion failed', {
      requestId,
      user: req.user?.id,
      url: req.validatedData?.url,
      selector: req.validatedData?.selector,
      error: error.message,
      duration: `${duration}ms`,
      stack: error.stack
    });

    // Determine appropriate status code and message
    let status = 500;
    let message = 'Internal server error';
    
    if (error.message.includes('timeout')) {
      status = 408;
      message = 'Request timeout - page took too long to load';
    } else if (error.message.includes('not found') || error.message.includes('CSS selector')) {
      status = 400;
      message = 'CSS selector not found on page';
    } else if (error.message.includes('Failed to load')) {
      status = 400;
      message = 'Failed to load the specified URL';
    } else if (error.message.includes('Invalid')) {
      status = 400;
      message = error.message;
    }

    res.status(status).json({
      status: 'error',
      message,
      requestId,
      duration: `${duration}ms`,
      ...(process.env.NODE_ENV !== 'production' && { 
        details: error.message,
        stack: error.stack 
      })
    });
  }
});

// Get image conversion endpoint info
router.get('/info', (req, res) => {
  res.json({
    endpoint: '/v1/image',
    method: 'POST',
    description: 'Convert HTML elements to PNG images',
    parameters: {
      url: 'string (required) - URL of the HTML page',
      selector: 'string (required) - CSS selector for the element to capture'
    },
    response: {
      success: {
        url: 'string - Public URL of the generated image',
        filename: 'string - Generated filename',
        size: 'number - File size in bytes',
        created: 'string - Creation timestamp',
        requestId: 'string - Request identifier',
        duration: 'string - Processing time'
      },
      error: {
        status: 'string - Error status',
        message: 'string - Error description',
        requestId: 'string - Request identifier'
      }
    },
    authentication: 'HTTP Basic Auth required',
    status: 'Active'
  });
});

// Test endpoint for checking URL accessibility
router.post('/check', validateImageRequest, async (req, res) => {
  try {
    const { url } = req.validatedData;
    
    logger.info('URL accessibility check requested', {
      requestId: req.requestId,
      user: req.user?.id,
      url
    });

    const result = await screenshotService.checkUrl(url);
    
    res.json({
      url,
      accessible: result.accessible,
      status: result.status,
      statusText: result.statusText,
      redirected: result.url !== url ? result.url : null,
      error: result.error || null,
      requestId: req.requestId
    });

  } catch (error) {
    logger.error('URL check failed', {
      requestId: req.requestId,
      error: error.message
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to check URL accessibility',
      requestId: req.requestId
    });
  }
});

// Get page information
router.post('/page-info', validateImageRequest, async (req, res) => {
  try {
    const { url } = req.validatedData;
    
    logger.info('Page info requested', {
      requestId: req.requestId,
      user: req.user?.id,
      url
    });

    const pageInfo = await screenshotService.getPageInfo(url);
    
    res.json({
      ...pageInfo,
      requestId: req.requestId
    });

  } catch (error) {
    logger.error('Failed to get page info', {
      requestId: req.requestId,
      error: error.message
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve page information',
      requestId: req.requestId
    });
  }
});

// Full page screenshot endpoint
router.post('/full-page', validateImageRequest, async (req, res) => {
  const requestId = req.requestId || 'unknown';
  const startTime = Date.now();
  
  try {
    const { url } = req.validatedData;
    const user = req.user?.id || 'anonymous';
    
    logger.info('Starting full page screenshot', {
      requestId,
      user,
      url
    });

    // Capture full page screenshot
    const imageBuffer = await screenshotService.captureFullPage(url);

    // Save image
    const filename = generateFilename(url, 'full-page');
    const savedImage = await saveImage(imageBuffer, filename);
    
    // Generate public URL
    const imageUrl = generateImageUrl(filename, req.get('host') 
      ? `${req.protocol}://${req.get('host')}` 
      : undefined
    );

    const duration = Date.now() - startTime;
    
    logger.info('Full page screenshot completed', {
      requestId,
      user,
      url,
      filename,
      fileSize: savedImage.size,
      duration: `${duration}ms`
    });

    res.json({
      url: imageUrl,
      filename,
      size: savedImage.size,
      created: savedImage.created,
      requestId,
      duration: `${duration}ms`
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    
    logger.error('Full page screenshot failed', {
      requestId,
      error: error.message,
      duration: `${duration}ms`
    });

    res.status(500).json({
      status: 'error',
      message: 'Failed to capture full page screenshot',
      requestId,
      duration: `${duration}ms`
    });
  }
});

module.exports = router;