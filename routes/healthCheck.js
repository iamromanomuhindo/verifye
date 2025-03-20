const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

router.get('/deep', async (req, res) => {
  try {
    // Add your deep health checks here (e.g., database connection)
    res.json({
      status: 'healthy',
      services: {
        api: 'up',
        // Add other service checks here
      }
    });
  } catch (error) {
    logger.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

module.exports = router;
