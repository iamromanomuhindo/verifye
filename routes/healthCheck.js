const express = require('express');
const router = express.Router();
const { logger } = require('../utils/logger');
const loadSmtpConfig = require('../config/loadSmtpConfig');
const HealthChecker = require('../services/healthCheck');
const IPRotator = require('../services/ipRotator');

// Initialize health checker and IP rotator
const config = loadSmtpConfig();
const healthChecker = new HealthChecker(config);
const ipRotator = new IPRotator(config);

// Start periodic health checks
healthChecker.startPeriodicChecks(300000); // 5 minutes

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
        const healthStatus = await healthChecker.checkAllServers();
        const ipStats = ipRotator.getStats();

        res.json({
            status: healthStatus.healthyServers > 0 ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            services: {
                api: 'up',
                smtp: {
                    status: healthStatus.healthyServers > 0 ? 'up' : 'degraded',
                    healthyServers: healthStatus.healthyServers,
                    totalServers: healthStatus.totalServers,
                    details: healthStatus.results
                },
                ipRotation: {
                    totalServers: ipStats.totalServers,
                    availableServers: ipStats.availableServers,
                    blockedIPs: ipStats.blockedIPs
                }
            },
            memory: process.memoryUsage(),
            uptime: process.uptime()
        });
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Detailed SMTP server status
router.get('/smtp', async (req, res) => {
    try {
        const healthStatus = await healthChecker.checkAllServers();
        
        res.json({
            timestamp: new Date().toISOString(),
            servers: healthStatus.results.map(server => ({
                host: server.server,
                ip: server.ip,
                status: server.healthy ? 'healthy' : 'unhealthy',
                lastCheck: server.status.lastCheck,
                responseTime: server.status.responseTime,
                consecutiveFailures: server.status.consecutiveFailures,
                lastError: server.status.lastError
            }))
        });
    } catch (error) {
        logger.error('SMTP status check error:', error);
        res.status(500).json({
            error: 'Failed to check SMTP servers',
            message: error.message
        });
    }
});

// IP rotation status
router.get('/ips', (req, res) => {
    const stats = ipRotator.getStats();
    res.json({
        timestamp: new Date().toISOString(),
        totalIPs: stats.totalServers,
        availableIPs: stats.availableServers,
        blockedIPs: stats.blockedIPs,
        usageStats: stats.usageStats
    });
});

module.exports = router;
