require('dotenv').config();
const logger = require('../utils/logger');

/**
 * Load and parse SMTP server configuration from environment variables
 * @returns {Object} Parsed SMTP configuration
 */
function loadSmtpConfig() {
  try {
    const smtpServers = process.env.SMTP_SERVERS || '';
    const servers = smtpServers.split(',')
      .filter(server => server.trim())
      .map(server => {
        const [host, port, sourceIp, region] = server.split(':');
        return {
          host: host.trim(),
          port: parseInt(port, 10) || 25,
          sourceIp: sourceIp.trim(),
          region: region.trim()
        };
      });

    return {
      defaultSettings: {
        timeout: parseInt(process.env.SMTP_TIMEOUT, 10) || 5000,
        maxRetries: parseInt(process.env.SMTP_MAX_RETRIES, 10) || 2,
        retryDelay: parseInt(process.env.SMTP_RETRY_DELAY, 10) || 1000
      },
      
      servers,
      
      rateLimits: {
        perIp: {
          windowMs: 24 * 60 * 60 * 1000, // 24 hours
          maxRequests: parseInt(process.env.DEFAULT_RATE_LIMIT, 10) || 500
        },
        perServer: {
          windowMs: 60 * 1000, // 1 minute
          maxRequests: 30 // requests per minute
        }
      },

      providerSettings: {
        gmail: {
          maxPerIp: parseInt(process.env.GMAIL_RATE_LIMIT, 10) || 400,
          delayMs: 4000,
          rotateEvery: 100
        },
        yahoo: {
          maxPerIp: parseInt(process.env.YAHOO_RATE_LIMIT, 10) || 500,
          delayMs: 3000,
          rotateEvery: 120
        },
        outlook: {
          maxPerIp: parseInt(process.env.OUTLOOK_RATE_LIMIT, 10) || 450,
          delayMs: 3500,
          rotateEvery: 110
        },
        default: {
          maxPerIp: parseInt(process.env.DEFAULT_RATE_LIMIT, 10) || 600,
          delayMs: 2000,
          rotateEvery: 150
        }
      },

      rotationSettings: {
        ipRotationInterval: parseInt(process.env.IP_ROTATION_INTERVAL, 10) || 3600000,
        serverRotationInterval: parseInt(process.env.SERVER_ROTATION_INTERVAL, 10) || 600000
      }
    };
  } catch (error) {
    logger.error('Error loading SMTP configuration:', error);
    throw new Error('Failed to load SMTP configuration');
  }
}

module.exports = loadSmtpConfig;
