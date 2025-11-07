const cron = require('node-cron');
const logger = require('../utils/logger');
const { cleanOldImages, getDirectoryStats } = require('../utils/fileManager');
const config = require('../config');

/**
 * Job scheduler for automatic maintenance tasks
 */

class JobScheduler {
  constructor() {
    this.jobs = new Map();
    this.isRunning = false;
  }

  /**
   * Start all scheduled jobs
   */
  start() {
    if (this.isRunning) {
      logger.warn('Job scheduler already running');
      return;
    }

    logger.info('Starting job scheduler');
    this.isRunning = true;

    // Schedule image cleanup job
    this.scheduleImageCleanup();
    
    // Schedule storage monitoring job
    this.scheduleStorageMonitoring();
    
    // Schedule health check job
    this.scheduleHealthCheck();

    logger.info('All jobs scheduled successfully');
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Job scheduler not running');
      return;
    }

    logger.info('Stopping job scheduler');
    
    for (const [name, job] of this.jobs) {
      job.destroy();
      logger.info(`Stopped job: ${name}`);
    }
    
    this.jobs.clear();
    this.isRunning = false;
    
    logger.info('Job scheduler stopped');
  }

  /**
   * Schedule automatic image cleanup
   */
  scheduleImageCleanup() {
    const schedule = config.jobs?.cleanup?.schedule || '0 2 * * *'; // 2 AM daily
    const maxAge = config.jobs?.cleanup?.maxAge || 24 * 60 * 60 * 1000; // 24 hours
    const enabled = config.jobs?.cleanup?.enabled !== false; // Default enabled
    
    if (!enabled) {
      logger.info('Image cleanup job disabled in configuration');
      return;
    }

    const job = cron.schedule(schedule, async () => {
      const jobId = `cleanup-${Date.now()}`;
      
      try {
        logger.info('Starting automatic image cleanup', { jobId, maxAge, schedule });
        
        const result = await cleanOldImages(maxAge);
        
        logger.info('Automatic image cleanup completed', {
          jobId,
          deletedCount: result.deletedCount,
          deletedSize: result.deletedSize,
          duration: result.duration || 'unknown'
        });

        // Log storage stats after cleanup
        const stats = await getDirectoryStats();
        logger.info('Storage stats after cleanup', {
          jobId,
          totalImages: stats.totalImages,
          totalSize: stats.totalSize,
          totalSizeMB: stats.totalSizeMB
        });

      } catch (error) {
        logger.error('Automatic image cleanup failed', {
          jobId,
          error: error.message,
          stack: error.stack
        });
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: config.jobs?.timezone || 'UTC'
    });

    this.jobs.set('imageCleanup', job);
    job.start();
    
    logger.info('Image cleanup job scheduled', { 
      schedule, 
      maxAge, 
      timezone: config.jobs?.timezone || 'UTC' 
    });
  }

  /**
   * Schedule storage monitoring
   */
  scheduleStorageMonitoring() {
    const schedule = config.jobs?.monitoring?.schedule || '*/15 * * * *'; // Every 15 minutes
    const enabled = config.jobs?.monitoring?.enabled !== false; // Default enabled
    
    if (!enabled) {
      logger.info('Storage monitoring job disabled in configuration');
      return;
    }

    const job = cron.schedule(schedule, async () => {
      const jobId = `monitoring-${Date.now()}`;
      
      try {
        const stats = await getDirectoryStats();
        
        // Check for storage warnings
        const maxSize = config.storage?.maxTotalSize || 1000 * 1024 * 1024; // 1GB default
        const maxFiles = config.storage?.maxTotalFiles || 10000;
        
        const warnings = [];
        
        if (stats.totalSize > maxSize) {
          warnings.push({
            type: 'storage_size',
            message: `Storage size (${stats.totalSizeMB}MB) exceeds limit`,
            value: stats.totalSize,
            limit: maxSize
          });
        }
        
        if (stats.totalImages > maxFiles) {
          warnings.push({
            type: 'file_count',
            message: `File count (${stats.totalImages}) exceeds limit`,
            value: stats.totalImages,
            limit: maxFiles
          });
        }

        if (warnings.length > 0) {
          logger.warn('Storage warnings detected', { jobId, warnings, stats });
        } else {
          logger.debug('Storage monitoring check passed', { jobId, stats });
        }

      } catch (error) {
        logger.error('Storage monitoring failed', {
          jobId,
          error: error.message,
          stack: error.stack
        });
      }
    }, {
      scheduled: false,
      timezone: config.jobs?.timezone || 'UTC'
    });

    this.jobs.set('storageMonitoring', job);
    job.start();
    
    logger.info('Storage monitoring job scheduled', { 
      schedule,
      timezone: config.jobs?.timezone || 'UTC'
    });
  }

  /**
   * Schedule health check reporting
   */
  scheduleHealthCheck() {
    const schedule = config.jobs?.healthCheck?.schedule || '0 */6 * * *'; // Every 6 hours
    const enabled = config.jobs?.healthCheck?.enabled !== false; // Default enabled
    
    if (!enabled) {
      logger.info('Health check job disabled in configuration');
      return;
    }

    const job = cron.schedule(schedule, async () => {
      const jobId = `health-${Date.now()}`;
      
      try {
        const uptime = process.uptime();
        const memory = process.memoryUsage();
        const stats = await getDirectoryStats();
        
        const healthData = {
          jobId,
          uptime: Math.round(uptime),
          uptimeFormatted: formatDuration(uptime * 1000),
          memory: {
            rss: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
            heapTotal: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
            external: Math.round(memory.external / 1024 / 1024 * 100) / 100
          },
          storage: {
            totalImages: stats.totalImages,
            totalSize: stats.totalSize,
            totalSizeMB: stats.totalSizeMB
          },
          timestamp: new Date().toISOString()
        };

        logger.info('Periodic health check', healthData);

      } catch (error) {
        logger.error('Health check failed', {
          jobId,
          error: error.message,
          stack: error.stack
        });
      }
    }, {
      scheduled: false,
      timezone: config.jobs?.timezone || 'UTC'
    });

    this.jobs.set('healthCheck', job);
    job.start();
    
    logger.info('Health check job scheduled', { 
      schedule,
      timezone: config.jobs?.timezone || 'UTC'
    });
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      jobCount: this.jobs.size,
      jobs: {}
    };

    for (const [name, job] of this.jobs) {
      status.jobs[name] = {
        running: job.running,
        scheduled: true
      };
    }

    return status;
  }

  /**
   * Run cleanup manually (for testing or forced cleanup)
   */
  async runCleanupNow(maxAge = null) {
    const cleanupMaxAge = maxAge || config.jobs?.cleanup?.maxAge || 24 * 60 * 60 * 1000;
    
    logger.info('Running manual cleanup', { maxAge: cleanupMaxAge });
    
    try {
      const result = await cleanOldImages(cleanupMaxAge);
      
      logger.info('Manual cleanup completed', {
        deletedCount: result.deletedCount,
        deletedSize: result.deletedSize
      });
      
      return result;
    } catch (error) {
      logger.error('Manual cleanup failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
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

// Create singleton instance
const jobScheduler = new JobScheduler();

module.exports = jobScheduler;