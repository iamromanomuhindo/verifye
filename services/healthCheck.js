const net = require('net');
const dns = require('dns').promises;
const { logger } = require('../utils/logger');

class HealthChecker {
    constructor(config) {
        this.config = config;
        this.healthStatus = new Map();
        this.initializeHealthStatus();
    }

    initializeHealthStatus() {
        this.config.servers.forEach(server => {
            this.healthStatus.set(server.sourceIp, {
                status: 'unknown',
                lastCheck: null,
                responseTime: null,
                consecutiveFailures: 0,
                lastError: null
            });
        });
    }

    async checkServer(server) {
        const startTime = Date.now();
        const status = this.healthStatus.get(server.sourceIp);

        try {
            // Test DNS resolution
            await dns.resolve(server.host);

            // Test SMTP connection
            await this.testSmtpConnection(server);

            // Update health status
            status.status = 'healthy';
            status.lastCheck = Date.now();
            status.responseTime = Date.now() - startTime;
            status.consecutiveFailures = 0;
            status.lastError = null;

            logger.debug(`Health check passed for ${server.host} (${server.sourceIp})`);
            return true;

        } catch (error) {
            status.status = 'unhealthy';
            status.lastCheck = Date.now();
            status.responseTime = Date.now() - startTime;
            status.consecutiveFailures++;
            status.lastError = error.message;

            logger.warn(`Health check failed for ${server.host} (${server.sourceIp}): ${error.message}`);
            return false;
        }
    }

    async testSmtpConnection(server) {
        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let connected = false;

            socket.setTimeout(this.config.defaultSettings.timeout);

            socket.on('connect', () => {
                connected = true;
                socket.destroy();
                resolve();
            });

            socket.on('timeout', () => {
                socket.destroy();
                reject(new Error('Connection timeout'));
            });

            socket.on('error', (err) => {
                if (!connected) {
                    reject(err);
                }
            });

            const connectionOptions = {
                port: server.port,
                host: server.host,
                localAddress: server.sourceIp
            };

            socket.connect(connectionOptions);
        });
    }

    async checkAllServers() {
        const results = await Promise.all(
            this.config.servers.map(async server => {
                const isHealthy = await this.checkServer(server);
                return {
                    server: server.host,
                    ip: server.sourceIp,
                    healthy: isHealthy,
                    status: this.healthStatus.get(server.sourceIp)
                };
            })
        );

        return {
            timestamp: Date.now(),
            totalServers: this.config.servers.length,
            healthyServers: results.filter(r => r.healthy).length,
            results
        };
    }

    getServerHealth(sourceIp) {
        return this.healthStatus.get(sourceIp) || {
            status: 'unknown',
            lastCheck: null,
            responseTime: null,
            consecutiveFailures: 0
        };
    }

    isServerHealthy(sourceIp) {
        const status = this.healthStatus.get(sourceIp);
        return status && status.status === 'healthy' && status.consecutiveFailures < 3;
    }

    startPeriodicChecks(interval = 300000) { // Default 5 minutes
        setInterval(async () => {
            try {
                await this.checkAllServers();
            } catch (error) {
                logger.error('Error in periodic health check:', error);
            }
        }, interval);

        logger.info(`Started periodic health checks with interval ${interval}ms`);
    }
}

module.exports = HealthChecker;
