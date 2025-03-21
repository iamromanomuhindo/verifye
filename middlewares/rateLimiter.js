const rateLimit = require('express-rate-limit');
const loadSmtpConfig = require('../config/loadSmtpConfig');
const { logger } = require('../utils/logger');

const config = loadSmtpConfig();

// API Rate Limiter
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    handler: (req, res) => {
        logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(req.rateLimit.resetTime / 1000)
        });
    }
});

// SMTP Rate Limiter (per source IP)
const smtpLimiter = new Map();

const getSmtpLimit = (sourceIp) => {
    if (!smtpLimiter.has(sourceIp)) {
        smtpLimiter.set(sourceIp, {
            requests: 0,
            windowStart: Date.now(),
            blocked: false
        });
    }
    return smtpLimiter.get(sourceIp);
};

const checkSmtpLimit = (sourceIp, provider = 'default') => {
    const limit = getSmtpLimit(sourceIp);
    const now = Date.now();
    const { maxPerIp } = config.providerSettings[provider] || config.providerSettings.default;

    // Reset counter if window has passed
    if (now - limit.windowStart >= 24 * 60 * 60 * 1000) {
        limit.requests = 0;
        limit.windowStart = now;
        limit.blocked = false;
    }

    // Check if blocked
    if (limit.blocked) {
        return false;
    }

    // Check if limit exceeded
    if (limit.requests >= maxPerIp) {
        limit.blocked = true;
        logger.warn(`SMTP rate limit exceeded for IP: ${sourceIp}`);
        return false;
    }

    // Increment counter
    limit.requests++;
    return true;
};

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [ip, limit] of smtpLimiter.entries()) {
        if (now - limit.windowStart >= 24 * 60 * 60 * 1000) {
            smtpLimiter.delete(ip);
        }
    }
}, 60 * 60 * 1000); // Clean up every hour

module.exports = {
    apiLimiter,
    checkSmtpLimit,
    getSmtpLimit
};
