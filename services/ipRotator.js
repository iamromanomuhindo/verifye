const { logger } = require('../utils/logger');

class IPRotator {
    constructor(config) {
        this.config = config;
        this.servers = config.servers;
        this.currentIndex = 0;
        this.usageStats = new Map();
        this.blockList = new Set();
        
        // Initialize usage stats for each IP
        this.servers.forEach(server => {
            this.usageStats.set(server.sourceIp, {
                requests: 0,
                lastUsed: 0,
                successRate: 1,
                consecutiveFailures: 0
            });
        });

        // Start the health check interval
        this.startHealthChecks();
    }

    getNextServer() {
        const availableServers = this.servers.filter(server => 
            !this.blockList.has(server.sourceIp) &&
            this.isWithinRateLimit(server.sourceIp)
        );

        if (availableServers.length === 0) {
            throw new Error('No available servers');
        }

        // Sort by usage and success rate
        availableServers.sort((a, b) => {
            const statsA = this.usageStats.get(a.sourceIp);
            const statsB = this.usageStats.get(b.sourceIp);
            
            // Consider both request count and success rate
            const scoreA = (statsA.requests * -1) * statsA.successRate;
            const scoreB = (statsB.requests * -1) * statsB.successRate;
            
            return scoreB - scoreA;
        });

        return availableServers[0];
    }

    isWithinRateLimit(ip) {
        const stats = this.usageStats.get(ip);
        const provider = this.getProviderFromIP(ip);
        const limit = this.config.providerSettings[provider]?.maxPerIp || 
                     this.config.providerSettings.default.maxPerIp;

        return stats.requests < limit;
    }

    recordSuccess(ip) {
        const stats = this.usageStats.get(ip);
        stats.requests++;
        stats.lastUsed = Date.now();
        stats.consecutiveFailures = 0;
        stats.successRate = (stats.successRate * 0.9) + 0.1; // Weighted average
        
        logger.debug(`IP ${ip} success recorded. Success rate: ${stats.successRate}`);
    }

    recordFailure(ip, error) {
        const stats = this.usageStats.get(ip);
        stats.requests++;
        stats.lastUsed = Date.now();
        stats.consecutiveFailures++;
        stats.successRate = (stats.successRate * 0.9); // Decrease success rate
        
        logger.warn(`IP ${ip} failure recorded. Success rate: ${stats.successRate}. Error: ${error}`);

        // Block IP if too many consecutive failures
        if (stats.consecutiveFailures >= 5) {
            this.blockIP(ip);
        }
    }

    blockIP(ip) {
        this.blockList.add(ip);
        logger.warn(`IP ${ip} blocked due to consecutive failures`);
        
        // Unblock after cooldown period
        setTimeout(() => {
            this.blockList.delete(ip);
            this.usageStats.get(ip).consecutiveFailures = 0;
            logger.info(`IP ${ip} unblocked after cooldown`);
        }, this.config.defaultSettings.retryDelay * 10);
    }

    getProviderFromIP(ip) {
        // This should be implemented based on your IP allocation strategy
        // For now, return 'default'
        return 'default';
    }

    resetDailyStats() {
        this.servers.forEach(server => {
            this.usageStats.set(server.sourceIp, {
                requests: 0,
                lastUsed: 0,
                successRate: 1,
                consecutiveFailures: 0
            });
        });
        this.blockList.clear();
        logger.info('Daily IP stats reset');
    }

    startHealthChecks() {
        // Reset stats daily
        setInterval(() => {
            this.resetDailyStats();
        }, 24 * 60 * 60 * 1000);

        // Rotate IPs periodically
        setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.servers.length;
        }, this.config.rotationSettings.ipRotationInterval);
    }

    getStats() {
        return {
            totalServers: this.servers.length,
            availableServers: this.servers.length - this.blockList.size,
            blockedIPs: Array.from(this.blockList),
            usageStats: Object.fromEntries(this.usageStats)
        };
    }
}

module.exports = IPRotator;
