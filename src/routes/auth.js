const express = require('express');
const { basicAuth, optionalAuth } = require('../middleware/auth');
const AuthUtils = require('../utils/authUtils');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

/**
 * Test authentication endpoint - requires Basic Auth
 * GET /auth/test
 */
router.get('/test', basicAuth, (req, res) => {
  logger.info('Authentication test successful', { user: req.user.id });
  
  res.json({
    status: 'success',
    message: 'Authentication successful',
    user: {
      id: req.user.id,
      authenticated: true,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Generate sample credentials endpoint - no auth required
 * POST /auth/generate
 */
router.post('/generate', (req, res) => {
  const userId = AuthUtils.generateUserId();
  const apiKey = AuthUtils.generateApiKey();
  const authHeader = AuthUtils.createAuthHeader(userId, apiKey);

  logger.info('Sample credentials generated');

  res.json({
    status: 'success',
    message: 'Sample credentials generated',
    credentials: {
      userId,
      apiKey,
      authHeader,
      usage: {
        curl: `curl -H "Authorization: ${authHeader}" http://localhost:3000/auth/test`,
        javascript: `headers: { 'Authorization': '${authHeader}' }`,
        base64: AuthUtils.encodeCredentials(userId, apiKey)
      }
    },
    note: 'These are sample credentials. Configure your own in .env file'
  });
});

/**
 * Check current authentication status
 * GET /auth/status
 */
router.get('/status', optionalAuth, (req, res) => {
  if (req.user) {
    res.json({
      status: 'authenticated',
      user: req.user,
      message: 'Valid authentication detected'
    });
  } else {
    res.json({
      status: 'not_authenticated',
      message: 'No valid authentication provided',
      help: 'Use /auth/generate to get sample credentials'
    });
  }
});

/**
 * Validate environment configuration
 * GET /auth/config
 */
router.get('/config', (req, res) => {
  const hasUserId = !!config.auth.userId;
  const hasApiKey = !!config.auth.apiKey;
  
  let status = 'not_configured';
  let message = 'Authentication not configured';
  
  if (hasUserId && hasApiKey) {
    const validation = AuthUtils.validateCredentials(config.auth.userId, config.auth.apiKey);
    if (validation.isValid) {
      status = 'configured';
      message = 'Authentication properly configured';
    } else {
      status = 'invalid_config';
      message = 'Authentication configuration invalid';
    }
  }

  res.json({
    status,
    message,
    configuration: {
      hasUserId,
      hasApiKey,
      userIdLength: hasUserId ? config.auth.userId.length : 0,
      apiKeyLength: hasApiKey ? config.auth.apiKey.length : 0
    },
    ...(status === 'invalid_config' && {
      errors: AuthUtils.validateCredentials(config.auth.userId || '', config.auth.apiKey || '').errors
    })
  });
});

module.exports = router;