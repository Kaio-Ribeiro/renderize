require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

// Import configuration
const config = require('./config');
const logger = require('./utils/logger');

// Import routes and middleware
const apiRoutes = require('./routes');
const { 
  validateRequest, 
  requestTimeout, 
  rateLimit, 
  errorHandler, 
  notFoundHandler,
  requestLogger 
} = require('./middleware/common');
const { createStaticMiddleware } = require('./middleware/static');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

// Logging middleware
app.use(morgan(process.env.LOG_FORMAT || 'combined'));

// Request middleware
app.use(validateRequest);
app.use(requestTimeout(30000));
app.use(rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enhanced static file serving
app.use(createStaticMiddleware());
app.use('/public', express.static(path.join(__dirname, '../public')));

// Import routes
const authRoutes = require('./routes/auth');
const storageRoutes = require('./routes/storage');

// Mount routes
app.use('/auth', authRoutes);
app.use('/v1/storage', storageRoutes);

// Basic route for testing
app.get('/', (req, res) => {
  res.json({
    name: 'Renderize API',
    version: '1.0.0',
    description: 'HTML to Image Conversion API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/v1', apiRoutes);

// Health check endpoint (separate from API versioning)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100,
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100,
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      external: Math.round(process.memoryUsage().external / 1024 / 1024 * 100) / 100
    },
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler (must be last)
app.use('*', notFoundHandler);

// Start server only if not in test environment
let server;
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  server = app.listen(PORT, () => {
    logger.info(`🚀 Renderize API running on port ${PORT}`);
    logger.info(`📚 API Documentation: http://localhost:${PORT}`);
    logger.info(`❤️  Health Check: http://localhost:${PORT}/health`);
  });
}

// Graceful shutdown (only if server exists)
if (server) {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

module.exports = app;