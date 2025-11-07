module.exports = {
  // Server Configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // API Configuration
  api: {
    baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
    version: process.env.API_VERSION || 'v1',
    prefix: `/v1`
  },

  // Authentication
  auth: {
    userId: process.env.HCTI_USER_ID,
    apiKey: process.env.HCTI_API_KEY
  },

  // Image Configuration
  image: {
    tempDir: process.env.IMAGE_TEMP_DIR || './temp',
    maxAgeMinutes: parseInt(process.env.IMAGE_MAX_AGE_MINUTES) || 60,
    quality: parseInt(process.env.IMAGE_QUALITY) || 90,
    format: process.env.IMAGE_FORMAT || 'png',
    maxFileSize: '10mb'
  },

  // Browser Configuration
  browser: {
    timeout: parseInt(process.env.BROWSER_TIMEOUT) || 30000,
    headless: process.env.BROWSER_HEADLESS !== 'false',
    viewport: {
      width: parseInt(process.env.BROWSER_VIEWPORT_WIDTH) || 1920,
      height: parseInt(process.env.BROWSER_VIEWPORT_HEIGHT) || 1080
    },
    userAgent: process.env.BROWSER_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    waitForAnimations: process.env.BROWSER_WAIT_ANIMATIONS !== 'false',
    defaultQuality: parseInt(process.env.BROWSER_DEFAULT_QUALITY) || 90
  },

  // Security
  security: {
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
    }
  },

  // Jobs Configuration
  jobs: {
    cleanup: {
      enabled: process.env.JOB_CLEANUP_ENABLED !== 'false', // Default enabled
      schedule: process.env.JOB_CLEANUP_SCHEDULE || '0 2 * * *', // 2 AM daily
      maxAge: parseInt(process.env.JOB_CLEANUP_MAX_AGE_HOURS) * 60 * 60 * 1000 || 24 * 60 * 60 * 1000 // 24 hours default
    },
    monitoring: {
      enabled: process.env.JOB_MONITORING_ENABLED !== 'false', // Default enabled
      schedule: process.env.JOB_MONITORING_SCHEDULE || '*/15 * * * *' // Every 15 minutes
    },
    healthCheck: {
      enabled: process.env.JOB_HEALTH_CHECK_ENABLED !== 'false', // Default enabled
      schedule: process.env.JOB_HEALTH_CHECK_SCHEDULE || '0 */6 * * *' // Every 6 hours
    },
    timezone: process.env.JOB_TIMEZONE || 'UTC'
  },

  // Storage Limits
  storage: {
    maxTotalSize: parseInt(process.env.STORAGE_MAX_TOTAL_SIZE) || 1000 * 1024 * 1024, // 1GB
    maxTotalFiles: parseInt(process.env.STORAGE_MAX_TOTAL_FILES) || 10000
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};