const logger = require('../utils/logger');

/**
 * Request validation middleware
 */
function validateRequest(req, res, next) {
  // Add request metadata for logging
  req.requestId = generateRequestId();
  req.startTime = Date.now();
  
  logger.debug('Request received', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  next();
}

/**
 * Request timeout middleware
 */
function requestTimeout(timeout = 45000) {
  return (req, res, next) => {
    res.setTimeout(timeout, () => {
      logger.warn('Request timeout', {
        requestId: req.requestId,
        timeout,
        url: req.originalUrl
      });
      
      if (!res.headersSent) {
        res.status(408).json({
          status: 'error',
          message: 'Request timeout',
          timeout: `${timeout}ms`
        });
      }
    });
    
    next();
  };
}

/**
 * Rate limiting placeholder (basic implementation)
 */
function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
  const requests = new Map();
  
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(key)) {
      requests.set(key, []);
    }
    
    const userRequests = requests.get(key);
    
    // Remove old requests outside the window
    while (userRequests.length > 0 && userRequests[0] < windowStart) {
      userRequests.shift();
    }
    
    if (userRequests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        requests: userRequests.length,
        maxRequests,
        windowMs
      });
      
      return res.status(429).json({
        status: 'error',
        message: 'Too many requests',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    userRequests.push(now);
    requests.set(key, userRequests);
    
    next();
  };
}

/**
 * Global error handler
 */
function errorHandler(err, req, res, next) {
  const requestId = req.requestId || 'unknown';
  const duration = req.startTime ? Date.now() - req.startTime : 0;
  
  logger.error('Request error', {
    requestId,
    duration,
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  // Default error response
  const errorResponse = {
    status: 'error',
    requestId,
    timestamp: new Date().toISOString()
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      ...errorResponse,
      message: 'Validation error',
      details: err.details || err.message
    });
  }

  if (err.name === 'UnauthorizedError' || err.status === 401) {
    return res.status(401).json({
      ...errorResponse,
      message: 'Authentication required'
    });
  }

  if (err.name === 'ForbiddenError' || err.status === 403) {
    return res.status(403).json({
      ...errorResponse,
      message: 'Access forbidden'
    });
  }

  if (err.status === 404) {
    return res.status(404).json({
      ...errorResponse,
      message: 'Resource not found'
    });
  }

  // Default server error
  const status = err.status || 500;
  res.status(status).json({
    ...errorResponse,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      details: err.details 
    })
  });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  const requestId = req.requestId || 'unknown';
  
  logger.warn('Route not found', {
    requestId,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    requestId,
    timestamp: new Date().toISOString()
  });
}

/**
 * Request completion logger
 */
function requestLogger(req, res, next) {
  const oldSend = res.send;
  let sent = false;
  
  res.send = function(data) {
    if (sent) return;
    sent = true;
    
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    
    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      size: data ? data.length : 0
    });
    
    oldSend.apply(this, arguments);
  };
  
  next();
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

module.exports = {
  validateRequest,
  requestTimeout,
  rateLimit,
  errorHandler,
  notFoundHandler,
  requestLogger
};