const net = require('net');
const { getDomainFromEmail } = require('./emailValidator');

const SMTP_TIMEOUT = 5000;

const checkEmailExistence = async (email) => {
  const domain = getDomainFromEmail(email);
  if (!domain) return { valid: false, message: 'Invalid email format' };

  return new Promise((resolve, reject) => {
    const client = net.createConnection(
      { host: domain, port: 25 },
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
};

module.exports = { checkEmailExistence };
