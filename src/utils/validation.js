/**
 * Request validation utilities
 */

/**
 * Validate URL parameter
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new ValidationError('URL is required and must be a string');
  }

  try {
    // Remove extra slashes at the end before parsing
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const parsedUrl = new URL(cleanUrl);
    
    // Only allow HTTP and HTTPS protocols
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new ValidationError('URL must use HTTP or HTTPS protocol');
    }
    
    // Return the cleaned URL without extra trailing slashes
    return parsedUrl.href.replace(/\/+$/, '');
  } catch (error) {
    throw new ValidationError('Invalid URL format');
  }
}

/**
 * Validate CSS selector
 */
function validateSelector(selector) {
  if (!selector || typeof selector !== 'string') {
    throw new ValidationError('CSS selector is required and must be a string');
  }

  // Basic CSS selector validation
  const selectorRegex = /^[a-zA-Z0-9\s\.\#\[\]\(\)\:\-\_\,\>\+\~\*\=\"\'\|\\]+$/;
  
  if (!selectorRegex.test(selector)) {
    throw new ValidationError('Invalid CSS selector format');
  }

  if (selector.length > 1000) {
    throw new ValidationError('CSS selector is too long (max 1000 characters)');
  }

  return selector.trim();
}

/**
 * Validate image conversion parameters
 */
function validateImageParams(params) {
  const { url, selector } = params;
  
  return {
    url: validateUrl(url),
    selector: validateSelector(selector)
  };
}

/**
 * Create validation middleware
 */
function createValidator(validationFunction) {
  return (req, res, next) => {
    try {
      const validatedData = validationFunction(req.body);
      req.validatedData = validatedData;
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: error.message,
          field: error.field || 'unknown'
        });
      }
      next(error);
    }
  };
}

/**
 * Custom validation error class
 */
class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.status = 400;
  }
}

/**
 * Sanitize input strings
 */
function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') {
    return '';
  }
  
  return str
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Remove potential HTML tags
}

/**
 * Validate pagination parameters
 */
function validatePagination(query) {
  const page = parseInt(query.page);
  const limit = parseInt(query.limit);
  
  // Use defaults if not provided or invalid
  const finalPage = page && page > 0 ? page : 1;
  const finalLimit = limit && limit > 0 && limit <= 100 ? limit : 10;
  
  // Throw errors for explicitly invalid values
  if (query.page !== undefined && (isNaN(page) || page < 1)) {
    throw new ValidationError('Page must be greater than 0', 'page');
  }
  
  if (query.limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
    throw new ValidationError('Limit must be between 1 and 100', 'limit');
  }
  
  return {
    page: finalPage,
    limit: finalLimit,
    offset: (finalPage - 1) * finalLimit
  };
}

module.exports = {
  validateUrl,
  validateSelector,
  validateImageParams,
  createValidator,
  ValidationError,
  sanitizeString,
  validatePagination
};