const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');

// Placeholder for image conversion endpoint
// This will be implemented in the next commit

router.post('/', (req, res) => {
  logger.info('Image conversion endpoint accessed', { 
    user: req.user?.id,
    ip: req.ip 
  });

  res.status(501).json({
    status: 'error',
    message: 'Image conversion not yet implemented',
    hint: 'This endpoint will be available in the next version'
  });
});

// Get image conversion status/info
router.get('/info', (req, res) => {
  res.json({
    endpoint: '/v1/image',
    method: 'POST',
    description: 'Convert HTML elements to PNG images',
    parameters: {
      url: 'string (required) - URL of the HTML page',
      selector: 'string (required) - CSS selector for the element to capture'
    },
    authentication: 'HTTP Basic Auth required',
    status: 'Not implemented yet'
  });
});

module.exports = router;