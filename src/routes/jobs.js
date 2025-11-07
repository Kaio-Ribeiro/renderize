const express = require('express');
const { body, query } = require('express-validator');
const { basicAuth } = require('../middleware/auth');
const { createValidator } = require('../utils/validation');
const logger = require('../utils/logger');
const jobScheduler = require('../services/jobScheduler');

const router = express.Router();

// Custom validation middleware for jobs endpoints
const validateJobRequest = (req, res, next) => {
  // Simple validation middleware that just passes through
  next();
};

// Apply authentication to all job routes
router.use(basicAuth);

/**
 * GET /jobs/status
 * Get status of all scheduled jobs
 */
router.get('/status', validateJobRequest, async (req, res) => {
  const requestId = req.requestId;
  const user = req.user.id;

  try {
    logger.info('Getting job status', { requestId, user });
    
    const status = jobScheduler.getStatus();
    
    res.json({
      status: 'success',
      data: status,
      requestId
    });
    
  } catch (error) {
    logger.error('Failed to get job status', {
      requestId,
      user,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get job status',
      requestId
    });
  }
});

/**
 * POST /jobs/cleanup/run
 * Run cleanup job manually
 */
router.post('/cleanup/run',
  body('maxAge').optional().isInt({ min: 1 }),
  validateJobRequest,
  async (req, res) => {
    const requestId = req.requestId;
    const user = req.user.id;
    const maxAge = req.body.maxAge;

    try {
      logger.info('Running manual cleanup job', { requestId, user, maxAge });
      
      const result = await jobScheduler.runCleanupNow(maxAge);
      
      logger.info('Manual cleanup job completed', {
        requestId,
        user,
        deletedCount: result.deletedCount,
        deletedSize: result.deletedSize
      });
      
      res.json({
        status: 'success',
        data: {
          deletedCount: result.deletedCount,
          deletedSize: result.deletedSize,
          deletedSizeFormatted: formatFileSize(result.deletedSize),
          maxAge: maxAge || 'default',
          executedAt: new Date().toISOString()
        },
        requestId
      });
      
    } catch (error) {
      logger.error('Manual cleanup job failed', {
        requestId,
        user,
        error: error.message,
        stack: error.stack
      });
      
      res.status(500).json({
        status: 'error',
        message: 'Manual cleanup job failed',
        requestId
      });
    }
  }
);

/**
 * POST /jobs/start
 * Start the job scheduler
 */
router.post('/start', validateJobRequest, async (req, res) => {
  const requestId = req.requestId;
  const user = req.user.id;

  try {
    logger.info('Starting job scheduler manually', { requestId, user });
    
    jobScheduler.start();
    
    res.json({
      status: 'success',
      message: 'Job scheduler started',
      data: jobScheduler.getStatus(),
      requestId
    });
    
  } catch (error) {
    logger.error('Failed to start job scheduler', {
      requestId,
      user,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to start job scheduler',
      requestId
    });
  }
});

/**
 * POST /jobs/stop
 * Stop the job scheduler
 */
router.post('/stop', validateJobRequest, async (req, res) => {
  const requestId = req.requestId;
  const user = req.user.id;

  try {
    logger.info('Stopping job scheduler manually', { requestId, user });
    
    jobScheduler.stop();
    
    res.json({
      status: 'success',
      message: 'Job scheduler stopped',
      data: jobScheduler.getStatus(),
      requestId
    });
    
  } catch (error) {
    logger.error('Failed to stop job scheduler', {
      requestId,
      user,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to stop job scheduler',
      requestId
    });
  }
});

/**
 * GET /jobs/info
 * Get information about available jobs and their configurations
 */
router.get('/info', validateJobRequest, async (req, res) => {
  const requestId = req.requestId;
  const user = req.user.id;

  try {
    const config = require('../config');
    
    const jobInfo = {
      cleanup: {
        enabled: config.jobs?.cleanup?.enabled,
        schedule: config.jobs?.cleanup?.schedule,
        maxAge: config.jobs?.cleanup?.maxAge,
        maxAgeFormatted: formatDuration(config.jobs?.cleanup?.maxAge || 24 * 60 * 60 * 1000),
        description: 'Automatically removes old image files'
      },
      monitoring: {
        enabled: config.jobs?.monitoring?.enabled,
        schedule: config.jobs?.monitoring?.schedule,
        description: 'Monitors storage usage and generates warnings'
      },
      healthCheck: {
        enabled: config.jobs?.healthCheck?.enabled,
        schedule: config.jobs?.healthCheck?.schedule,
        description: 'Periodic health and uptime reporting'
      },
      timezone: config.jobs?.timezone,
      storageSettings: {
        maxTotalSize: config.storage?.maxTotalSize,
        maxTotalSizeFormatted: formatFileSize(config.storage?.maxTotalSize || 0),
        maxTotalFiles: config.storage?.maxTotalFiles
      }
    };
    
    res.json({
      status: 'success',
      data: jobInfo,
      requestId
    });
    
  } catch (error) {
    logger.error('Failed to get job info', {
      requestId,
      user,
      error: error.message,
      stack: error.stack
    });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to get job information',
      requestId
    });
  }
});

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration in human readable format
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

module.exports = router;