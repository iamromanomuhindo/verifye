const dns = require('dns').promises;
const { getDomainFromEmail } = require('../utils/emailUtils');
const { logger } = require('../utils/logger');

const SMTP_TIMEOUT = 5000;

const checkEmailExistence = async (email) => {
  try {
    const domain = getDomainFromEmail(email);
    if (!domain) return { valid: false, message: 'Invalid email format' };

    const mxRecords = await dns.resolveMx(domain);
    
    if (!mxRecords || mxRecords.length === 0) {
      return {
        valid: false,
        message: 'No MX records found'
      };
    }

    // Sort MX records by priority
    const sortedMxRecords = mxRecords.sort((a, b) => a.priority - b.priority);
    const primaryMx = sortedMxRecords[0].exchange;

    return new Promise((resolve, reject) => {
      const client = require('net').createConnection(
        { host: primaryMx, port: 25 },
        () => {
          client.write('EHLO verifye.com\r\n');
          client.write(`MAIL FROM: <test@verifye.com>\r\n`);
          client.write(`RCPT TO: <${email}>\r\n`);
        }
      );

      let response = '';
      client.setTimeout(SMTP_TIMEOUT, () => {
        client.destroy();
        reject(new Error('SMTP timeout'));
      });

      client.on('data', (chunk) => {
        response += chunk.toString();
        // Improved response code checking
        if (response.includes('250')) {
          client.write('RSET\r\n');
          client.end();
          resolve({ valid: true, message: 'Email accepted by server' });
        } else if (response.includes('550') || response.includes('554')) {
          client.end();
          resolve({ valid: false, message: 'Email rejected by server' });
        } else if (response.includes('450') || response.includes('451') || response.includes('452')) {
          // Temporary errors
          client.end();
          resolve({ valid: null, message: 'Temporary server issue' });
        } else {
          client.end();
          resolve({ valid: null, message: 'Unknown server response' });
        }
      });

      client.on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    logger.error('SMTP check error:', error);
    return {
      valid: false,
      message: error.message
    };
  }
};

module.exports = { checkEmailExistence };
