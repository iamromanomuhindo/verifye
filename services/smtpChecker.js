const net = require('net');
const dns = require('dns').promises;
const { getDomainFromEmail } = require('../utils/emailUtils');
const { logger } = require('../utils/logger');

// Connection pool to reuse connections
const connectionPool = new Map();

// SMTP response codes and their meanings
const SMTP_CODES = {
  // Success codes
  '250': 'Requested action completed',
  '251': 'User not local, will forward',
  // Temporary error codes
  '450': 'Mailbox busy or unavailable',
  '451': 'Local error in processing',
  '452': 'Insufficient system storage',
  // Permanent error codes
  '550': 'Mailbox unavailable',
  '551': 'User not local',
  '552': 'Exceeded storage allocation',
  '553': 'Mailbox name invalid',
  '554': 'Transaction failed'
};

class SMTPConnection {
  constructor(host, port = 25, timeout = 5000) {
    this.host = host;
    this.port = port;
    this.timeout = timeout;
    this.socket = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection({
        host: this.host,
        port: this.port
      });

      this.socket.setTimeout(this.timeout);

      this.socket.on('connect', () => {
        this.connected = true;
        resolve();
      });

      this.socket.on('timeout', () => {
        this.socket.destroy();
        reject(new Error('Connection timeout'));
      });

      this.socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  async sendCommand(command) {
    return new Promise((resolve, reject) => {
      let response = '';

      const responseHandler = (chunk) => {
        response += chunk.toString();
        if (response.includes('\r\n')) {
          this.socket.removeListener('data', responseHandler);
          resolve(response.trim());
        }
      };

      this.socket.on('data', responseHandler);
      this.socket.write(command + '\r\n');
    });
  }

  async close() {
    if (this.socket) {
      try {
        await this.sendCommand('QUIT');
      } catch (error) {
        logger.error('Error closing SMTP connection:', error);
      }
      this.socket.destroy();
      this.connected = false;
    }
  }
}

const getResponseCode = (response) => {
  const match = response.match(/^(\d{3})/);
  return match ? match[1] : null;
};

const interpretResponse = (response) => {
  const code = getResponseCode(response);
  return {
    code,
    message: SMTP_CODES[code] || 'Unknown response',
    raw: response
  };
};

const checkEmailExistence = async (email, timeout = 5000) => {
  try {
    const domain = getDomainFromEmail(email);
    if (!domain) {
      return { valid: false, message: 'Invalid email format' };
    }

    // Get MX records
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        message: 'No MX records found',
        details: { mxRecords: [] }
      };
    }

    // Sort MX records by priority
    const sortedMxRecords = mxRecords.sort((a, b) => a.priority - b.priority);
    
    // Try each MX server in order of priority
    for (const mx of sortedMxRecords) {
      try {
        const connection = new SMTPConnection(mx.exchange, 25, timeout);
        await connection.connect();

        // Initial greeting
        const greeting = await connection.sendCommand('');
        const greetingResponse = interpretResponse(greeting);
        
        if (greetingResponse.code !== '220') {
          await connection.close();
          continue;
        }

        // HELO command
        const heloResponse = interpretResponse(
          await connection.sendCommand('HELO verifye.com')
        );
        
        if (heloResponse.code !== '250') {
          await connection.close();
          continue;
        }

        // MAIL FROM command
        const fromResponse = interpretResponse(
          await connection.sendCommand('MAIL FROM:<verify@verifye.com>')
        );
        
        if (fromResponse.code !== '250') {
          await connection.close();
          continue;
        }

        // RCPT TO command
        const rcptResponse = interpretResponse(
          await connection.sendCommand(`RCPT TO:<${email}>`)
        );

        await connection.close();

        // Analyze the response
        const responseCode = rcptResponse.code;
        
        if (responseCode === '250' || responseCode === '251') {
          return {
            valid: true,
            message: 'Email address exists',
            details: {
              code: responseCode,
              response: rcptResponse.message,
              server: mx.exchange
            }
          };
        } else if (responseCode === '550' || responseCode === '553' || responseCode === '554') {
          return {
            valid: false,
            message: 'Email address does not exist',
            details: {
              code: responseCode,
              response: rcptResponse.message,
              server: mx.exchange
            }
          };
        } else if (responseCode.startsWith('45')) {
          // Temporary failure, might be greylisting
          return {
            valid: null,
            message: 'Temporary failure, possibly greylisting',
            details: {
              code: responseCode,
              response: rcptResponse.message,
              server: mx.exchange,
              temporary: true
            }
          };
        }
      } catch (error) {
        logger.error(`SMTP error with ${mx.exchange}:`, error);
        continue;
      }
    }

    // If we've tried all MX servers and none worked
    return {
      valid: null,
      message: 'Unable to verify email existence',
      details: {
        error: 'All MX servers failed',
        servers: sortedMxRecords.map(mx => mx.exchange)
      }
    };

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
