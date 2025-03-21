require('dotenv').config();

/**
 * SMTP Server Configuration
 * Add your SMTP servers here with their respective IPs
 * Format:
 * {
 *   host: 'smtp-server-hostname',
 *   port: 25,
 *   sourceIp: 'xxx.xxx.xxx.xxx'
 * }
 */

const smtpConfig = {
  // Default configuration
  defaultSettings: {
    timeout: 5000,
    maxRetries: 2,
    retryDelay: 1000
  },

  // SMTP Servers configuration
  servers: [
    // Example configuration (replace with your servers)
    /*
    {
      host: 'smtp1.yourdomain.com',
      port: 25,
      sourceIp: '192.168.1.10',
      region: 'us-east',
      priority: 1
    },
    {
      host: 'smtp2.yourdomain.com',
      port: 25,
      sourceIp: '192.168.1.11',
      region: 'eu-west',
      priority: 2
    }
    */
  ],

  // Sender domains for rotation
  senderDomains: [
    'outlook.com',
    'yahoo.com',
    'aol.com',
    'hotmail.com'
  ],

  // Rate limiting settings
  rateLimits: {
    perIp: {
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      maxRequests: 500  // requests per IP per day
    },
    perServer: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30     // requests per minute
    }
  },

  // Provider-specific settings
  providerSettings: {
    gmail: {
      maxPerIp: 400,
      delayMs: 4000,
      rotateEvery: 100
    },
    yahoo: {
      maxPerIp: 500,
      delayMs: 3000,
      rotateEvery: 120
    },
    outlook: {
      maxPerIp: 450,
      delayMs: 3500,
      rotateEvery: 110
    },
    default: {
      maxPerIp: 600,
      delayMs: 2000,
      rotateEvery: 150
    }
  }
};

module.exports = smtpConfig;
