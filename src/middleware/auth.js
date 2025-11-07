const config = require('../config');
const logger = require('../utils/logger');

/**
 * HTTP Basic Authentication Middleware
 * Validates credentials against HCTI_USER_ID and HCTI_API_KEY environment variables
 */
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  // Check if Authorization header exists
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    logger.warn('Authentication failed: Missing or invalid Authorization header', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required. Please provide valid credentials.'
    });
  }

  try {
    // Extract and decode Base64 credentials
    const base64Credentials = authHeader.slice('Basic '.length);
    const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');

    // Validate credentials against environment variables
    const validUsername = config.auth.userId;
    const validPassword = config.auth.apiKey;

    if (!validUsername || !validPassword) {
      logger.error('Authentication configuration error: Missing HCTI_USER_ID or HCTI_API_KEY');
      return res.status(500).json({
        status: 'error',
        message: 'Server configuration error'
      });
    }

    // Compare credentials
    if (username !== validUsername || password !== validPassword) {
      logger.warn('Authentication failed: Invalid credentials', {
        username: username,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(401).json({
        status: 'error',
        message: 'Invalid credentials'
      });
    }

    // Authentication successful
    logger.info('Authentication successful', {
      username: username,
      ip: req.ip,
      endpoint: req.path
    });
    
    // Add user info to request for later use
    req.user = {
      id: username,
      authenticated: true
    };

    next();

  } catch (error) {
    logger.error('Authentication error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication processing error'
    });
  }
}

/**
 * Optional authentication middleware - allows access without auth but logs attempts
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No auth provided, continue without user info
    req.user = null;
    return next();
  }

  // Auth provided, validate it
  basicAuth(req, res, next);
}

/**
 * Create Basic Auth challenge response
 */
function createAuthChallenge(realm = 'Renderize API') {
  return (req, res) => {
    res.set('WWW-Authenticate', `Basic realm="${realm}"`);
    res.status(401).json({
      status: 'error',
      message: 'Authentication required',
      realm: realm
    });
  };
}

module.exports = {
  basicAuth,
  optionalAuth,
  createAuthChallenge
};