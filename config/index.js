const config = {
  development: {
    port: process.env.PORT || 3000,
    logLevel: 'debug',
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100 // limit each IP to 100 requests per windowMs
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  },
  production: {
    port: process.env.PORT || 3000,
    logLevel: 'info',
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    cors: {
      origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [],
      methods: ['GET', 'POST']
    }
  },
  test: {
    port: 3001,
    logLevel: 'error',
    rateLimit: {
      windowMs: 15 * 60 * 1000,
      max: 100
    },
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  }
};

const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
