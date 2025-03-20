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
  constructor(domain, options = {}) {
    this.domain = domain;
    this.options = {
      timeout: options.timeout || 5000,
      port: options.port || 25,
      maxRetries: options.maxRetries || 2,
      retryDelay: options.retryDelay || 1000,
      // Use different sender domains to avoid pattern detection
      senderDomains: [
        'outlook.com',
        'yahoo.com',
        'aol.com',
        'hotmail.com'
      ],
      // Rotate user agents to look more like a mail client
      userAgents: [
        'Mozilla/5.0 Thunderbird',
        'Microsoft Outlook',
        'Apple Mail',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ]
    };
    this.socket = null;
  }

  async connect(host) {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      
      // Set a shorter timeout for initial connection
      this.socket.setTimeout(this.options.timeout);

      this.socket.on('timeout', () => {
        this.socket.destroy();
        reject(new Error('Connection timeout'));
      });

      this.socket.on('error', (err) => {
        reject(err);
      });

      this.socket.connect(this.options.port, host, () => {
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
        
        // Handle multiline responses (begin with XXX-)
        if (expectMultiline) {
          if (response.match(/^\d{3}-[\s\S]*\r\n\d{3} /)) {
            responseComplete = true;
          }
        } else if (response.includes('\r\n')) {
          responseComplete = true;
        }

        if (responseComplete) {
          this.socket.removeListener('data', responseHandler);
          resolve(response.trim());
        }
      };

      this.socket.on('data', responseHandler);
      
      if (cmd) {
        this.socket.write(cmd + '\r\n');
      }
    });
  }

  getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  async checkEmail(email) {
    const mxRecords = await dns.resolveMx(this.domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'No MX records' };
    }

    // Sort MX records by priority
    const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
    
    for (const mx of sortedMx) {
      try {
        // Connect to the mail server
        await this.connect(mx.exchange);
        
        // Get initial greeting
        const greeting = await this.sendCommand('');
        if (this.isBlocked(greeting)) {
          this.socket.destroy();
          continue;
        }

        // Send EHLO instead of HELO and capture capabilities
        const senderDomain = this.getRandomItem(this.options.senderDomains);
        const ehloResponse = await this.sendCommand(`EHLO ${senderDomain}`, true);
        if (this.isBlocked(ehloResponse)) {
          this.socket.destroy();
          continue;
        }

        // Add random delays between commands to appear more natural
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

        // Send MAIL FROM with a legitimate-looking address
        const randomUser = Math.random().toString(36).substring(7);
        const fromCmd = `MAIL FROM:<${randomUser}@${senderDomain}>`;
        const fromResponse = await this.sendCommand(fromCmd);
        if (this.isBlocked(fromResponse)) {
          this.socket.destroy();
          continue;
        }

        // Add another random delay
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

        // Send RCPT TO
        const rcptCmd = `RCPT TO:<${email}>`;
        const rcptResponse = await this.sendCommand(rcptCmd);
        
        // Clean up
        await this.sendCommand('QUIT');
        this.socket.destroy();

        // Analyze the response
        if (this.isBlocked(rcptResponse)) {
          return { 
            valid: null, 
            reason: 'Server blocked validation attempt',
            response: rcptResponse
          };
        }

        if (this.indicatesExistence(rcptResponse)) {
          return { 
            valid: true, 
            reason: 'Server indicates email exists',
            response: rcptResponse
          };
        }

        if (this.indicatesNonexistence(rcptResponse)) {
          return { 
            valid: false, 
            reason: 'Server indicates email does not exist',
            response: rcptResponse
          };
        }

        return {
          valid: null,
          reason: 'Server response unclear',
          response: rcptResponse
        };

      } catch (error) {
        logger.error(`SMTP error with ${mx.exchange}:`, error);
        if (this.socket) {
          this.socket.destroy();
        }
        continue;
      }
    }

    return {
      valid: null,
      reason: 'Unable to verify with any mail server',
      servers: sortedMx.map(mx => mx.exchange)
    };
  }

  isBlocked(response) {
    return BLOCK_PATTERNS.some(pattern => pattern.test(response));
  }

  indicatesExistence(response) {
    return EXISTENCE_PATTERNS.some(pattern => pattern.test(response));
  }

  indicatesNonexistence(response) {
    return NONEXISTENCE_PATTERNS.some(pattern => pattern.test(response));
  }
}

const checkEmailExistence = async (email, timeout = 5000) => {
  try {
    const [localPart, domain] = email.split('@');
    const checker = new SmartSMTPChecker(domain, { timeout });
    const result = await checker.checkEmail(email);

    if (result.valid === true) {
      return {
        valid: true,
        message: 'Email address exists',
        details: {
          reason: result.reason,
          response: result.response
        }
      };
    } else if (result.valid === false) {
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
