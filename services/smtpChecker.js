const net = require('net');
const dns = require('dns').promises;
const { logger } = require('../utils/logger');

// Response patterns that indicate an email exists
const EXISTENCE_PATTERNS = [
  /user.*exist/i,
  /account.*exist/i,
  /recipient.*valid/i,
  /address.*valid/i,
  /^250/,
  /^251/
];

// Response patterns that indicate an email doesn't exist
const NONEXISTENCE_PATTERNS = [
  /user.*not.*exist/i,
  /no.*user/i,
  /no.*mailbox/i,
  /user.*unknown/i,
  /recipient.*reject/i,
  /address.*reject/i,
  /^550/,
  /^551/,
  /^553/,
  /^554/
];

// Response patterns that indicate we should stop probing
const BLOCK_PATTERNS = [
  /spam/i,
  /abuse/i,
  /blocked/i,
  /blacklist/i,
  /denied/i,
  /rejected/i,
  /tempfail/i,
  /timeout/i,
  /too.*many.*connection/i
];

class SmartSMTPChecker {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 5000,
      port: options.port || 25,
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      // SMTP server configurations - will be populated later
      servers: options.servers || [],
      currentServerIndex: 0,
      // Use different sender domains to avoid pattern detection
      senderDomains: options.senderDomains || [
        'outlook.com',
        'yahoo.com',
        'aol.com',
        'hotmail.com'
      ],
      // Rotate user agents to look more like a mail client
      userAgents: options.userAgents || [
        'Mozilla/5.0 Thunderbird',
        'Microsoft Outlook',
        'Apple Mail',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    };
    this.socket = null;
    this.currentServer = null;
  }

  rotateServer() {
    if (this.options.servers.length === 0) {
      throw new Error('No SMTP servers configured');
    }
    this.options.currentServerIndex = (this.options.currentServerIndex + 1) % this.options.servers.length;
    this.currentServer = this.options.servers[this.options.currentServerIndex];
    logger.info(`Rotating to SMTP server: ${this.currentServer.host}`);
  }

  async connect() {
    if (!this.currentServer) {
      this.rotateServer();
    }

    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      this.socket.setTimeout(this.options.timeout);

      this.socket.on('timeout', () => {
        this.socket.destroy();
        reject(new Error('Connection timeout'));
      });

      this.socket.on('error', (err) => {
        reject(err);
      });

      const { host, port = this.options.port, sourceIp } = this.currentServer;

      const connectionOptions = {
        port,
        host,
        localAddress: sourceIp // Use specific IP if provided
      };

      this.socket.connect(connectionOptions, () => {
        logger.info(`Connected to SMTP server ${host} from IP ${sourceIp || 'default'}`);
        resolve();
      });
    });
  }

  async sendCommand(cmd, expectMultiline = false) {
    return new Promise((resolve, reject) => {
      let response = '';
      let responseComplete = false;
      
      const responseHandler = (data) => {
        response += data.toString();
        
        // Handle multiline responses
        if (expectMultiline) {
          if (response.match(/^\d{3}-[\s\S]*\r\n\d{3} /)) {
            responseComplete = true;
          }
        } else {
          // Single line response
          if (response.match(/^\d{3} /)) {
            responseComplete = true;
          }
        }
        
        if (responseComplete) {
          this.socket.removeListener('data', responseHandler);
          resolve(response.trim());
        }
      };

      this.socket.on('data', responseHandler);
      
      this.socket.write(cmd + '\r\n');
      
      // Set timeout for response
      setTimeout(() => {
        if (!responseComplete) {
          this.socket.removeListener('data', responseHandler);
          reject(new Error('Response timeout'));
        }
      }, this.options.timeout);
    });
  }

  async verifyEmail(email, retryCount = 0) {
    try {
      // Extract domain from email
      const [, domain] = email.split('@');
      
      // Get MX records
      const mxRecords = await dns.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        return { exists: false, reason: 'No MX records' };
      }

      // Sort MX records by priority
      mxRecords.sort((a, b) => a.priority - b.priority);
      const mxHost = mxRecords[0].exchange;

      // Connect to SMTP server
      await this.connect();

      // Initial greeting
      const greeting = await this.sendCommand('');
      if (!greeting.startsWith('220')) {
        throw new Error('Invalid greeting: ' + greeting);
      }

      // HELO command
      const randomDomain = this.options.senderDomains[Math.floor(Math.random() * this.options.senderDomains.length)];
      const helo = await this.sendCommand(`HELO ${randomDomain}`);
      if (!helo.startsWith('250')) {
        throw new Error('HELO failed: ' + helo);
      }

      // MAIL FROM command
      const from = `verify@${randomDomain}`;
      const mailFrom = await this.sendCommand(`MAIL FROM:<${from}>`);
      if (!mailFrom.startsWith('250')) {
        throw new Error('MAIL FROM failed: ' + mailFrom);
      }

      // RCPT TO command
      const rcptTo = await this.sendCommand(`RCPT TO:<${email}>`);
      
      // Clean up
      await this.sendCommand('QUIT');
      this.socket.destroy();

      // Analyze response
      if (BLOCK_PATTERNS.some(pattern => pattern.test(rcptTo))) {
        if (retryCount < this.options.maxRetries) {
          logger.warn(`Blocked by server, retrying with different IP... (${retryCount + 1}/${this.options.maxRetries})`);
          this.rotateServer();
          return await this.verifyEmail(email, retryCount + 1);
        }
        return { exists: null, reason: 'Blocked by server' };
      }

      if (EXISTENCE_PATTERNS.some(pattern => pattern.test(rcptTo))) {
        return { exists: true, reason: rcptTo };
      }

      if (NONEXISTENCE_PATTERNS.some(pattern => pattern.test(rcptTo))) {
        return { exists: false, reason: rcptTo };
      }

      return { exists: null, reason: 'Ambiguous response: ' + rcptTo };

    } catch (error) {
      logger.error(`Error verifying email ${email}: ${error.message}`);
      
      if (retryCount < this.options.maxRetries) {
        logger.info(`Retrying with different server... (${retryCount + 1}/${this.options.maxRetries})`);
        this.rotateServer();
        return await this.verifyEmail(email, retryCount + 1);
      }

      return { exists: null, reason: error.message };
    }
  }
}

// Example server configuration format:
const serverConfig = {
  servers: [
    {
      host: 'smtp1.example.com',
      port: 25,
      sourceIp: '192.168.1.10'
    },
    {
      host: 'smtp2.example.com',
      port: 25,
      sourceIp: '192.168.1.11'
    }
  ]
};

const checkEmailExistence = async (email, timeout = 5000) => {
  try {
    const checker = new SmartSMTPChecker({ timeout, ...serverConfig });
    const result = await checker.verifyEmail(email);

    if (result.exists === true) {
      return {
        valid: true,
        message: 'Email address exists',
        details: {
          reason: result.reason,
          response: result.response
        }
      };
    } else if (result.exists === false) {
      return {
        valid: false,
        message: 'Email address does not exist',
        details: {
          reason: result.reason,
          response: result.response
        }
      };
    } else {
      return {
        valid: null,
        message: result.reason,
        details: result
      };
    }

  } catch (error) {
    logger.error('SMTP check error:', error);
    return {
      valid: null,
      message: 'SMTP verification failed',
      details: {
        error: error.message
      }
    };
  }
};

module.exports = { checkEmailExistence };
