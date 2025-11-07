const express = require('express');
const authRoutes = require('./auth');
const imageRoutes = require('./image');
const { basicAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// API Information endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Renderize API',
    version: 'v1',
    description: 'HTML to Image Conversion Service',
    endpoints: {
      auth: '/v1/auth/*',
      image: '/v1/image',
      health: '/health',
      docs: '/v1'
    },
    timestamp: new Date().toISOString()
  });
});

// Authentication routes (public access for testing)
router.use('/auth', authRoutes);

// Image conversion routes (protected)
router.use('/image', basicAuth, imageRoutes);

// API Status endpoint
router.get('/status', (req, res) => {
  res.json({
    status: 'operational',
    version: 'v1',
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100,
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;