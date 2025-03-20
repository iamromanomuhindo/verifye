const net = require('net');
const { logger } = require('../utils/logger');

class SMTPServer {
    constructor(options = {}) {
        this.options = {
            port: options.port || 2525,
            hostname: options.hostname || 'localhost',
            banner: options.banner || 'ESMTP Verifye Mail Service',
            maxConnections: options.maxConnections || 10,
            timeout: options.timeout || 60000,
            // Valid email addresses (for testing)
            validEmails: new Set(options.validEmails || []),
            // Whether to act as a catch-all server
            catchAll: options.catchAll || false
        };

        this.connections = new Set();
        this.server = null;
    }

    start() {
        return new Promise((resolve, reject) => {
            this.server = net.createServer((socket) => {
                if (this.connections.size >= this.options.maxConnections) {
                    socket.write('421 Too many connections\r\n');
                    socket.destroy();
                    return;
                }

                this.handleConnection(socket);
            });

            this.server.on('error', (err) => {
                logger.error('SMTP Server error:', err);
                reject(err);
            });

            this.server.listen(this.options.port, this.options.hostname, () => {
                logger.info(`SMTP Server listening on port ${this.options.port}`);
                resolve();
            });
        });
    }

    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                // Close all active connections
                for (const socket of this.connections) {
                    socket.destroy();
                }
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    handleConnection(socket) {
        let session = {
            id: Math.random().toString(36).substring(7),
            stage: 'init',
            from: null,
            to: null,
            data: '',
            isSecure: false
        };

        this.connections.add(socket);

        // Set timeout
        socket.setTimeout(this.options.timeout);

        // Send greeting
        socket.write(`220 ${this.options.hostname} ${this.options.banner}\r\n`);

        socket.on('data', (data) => {
            const command = data.toString().trim();
            this.handleCommand(socket, session, command);
        });

        socket.on('error', (err) => {
            logger.error(`SMTP Connection error [${session.id}]:`, err);
            this.connections.delete(socket);
        });

        socket.on('timeout', () => {
            socket.write('421 Timeout\r\n');
            socket.destroy();
            this.connections.delete(socket);
        });

        socket.on('close', () => {
            this.connections.delete(socket);
        });
    }

    handleCommand(socket, session, command) {
        const cmd = command.split(' ')[0].toUpperCase();
        const arg = command.slice(cmd.length).trim();

        switch (cmd) {
            case 'HELO':
            case 'EHLO':
                session.stage = 'hello';
                socket.write('250-Hello ' + arg + '\r\n');
                socket.write('250-SIZE 35882577\r\n');
                socket.write('250-8BITMIME\r\n');
                socket.write('250 STARTTLS\r\n');
                break;

            case 'STARTTLS':
                socket.write('220 Ready to start TLS\r\n');
                session.isSecure = true;
                break;

            case 'MAIL':
                if (session.stage !== 'hello') {
                    socket.write('503 Bad sequence of commands\r\n');
                    return;
                }
                const fromMatch = arg.match(/<(.+)>/);
                if (fromMatch) {
                    session.from = fromMatch[1];
                    session.stage = 'mail';
                    socket.write('250 Ok\r\n');
                } else {
                    socket.write('501 Syntax error in parameters\r\n');
                }
                break;

            case 'RCPT':
                if (session.stage !== 'mail' && session.stage !== 'rcpt') {
                    socket.write('503 Bad sequence of commands\r\n');
                    return;
                }

                const toMatch = arg.match(/<(.+)>/);
                if (toMatch) {
                    const recipient = toMatch[1];
                    session.to = recipient;
                    session.stage = 'rcpt';

                    // Check if email is valid
                    if (this.isValidRecipient(recipient)) {
                        socket.write('250 Ok\r\n');
                    } else {
                        socket.write('550 No such user here\r\n');
                    }
                } else {
                    socket.write('501 Syntax error in parameters\r\n');
                }
                break;

            case 'DATA':
                if (session.stage !== 'rcpt') {
                    socket.write('503 Bad sequence of commands\r\n');
                    return;
                }
                session.stage = 'data';
                socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
                break;

            case 'QUIT':
                socket.write('221 Goodbye\r\n');
                socket.end();
                break;

            case 'RSET':
                session = {
                    id: session.id,
                    stage: 'hello',
                    from: null,
                    to: null,
                    data: '',
                    isSecure: session.isSecure
                };
                socket.write('250 Ok\r\n');
                break;

            case 'NOOP':
                socket.write('250 Ok\r\n');
                break;

            default:
                socket.write('500 Unknown command\r\n');
        }
    }

    isValidRecipient(email) {
        if (this.options.catchAll) {
            return true; // Accept all recipients
        }

        // Check if email is in valid emails set
        return this.options.validEmails.has(email);
    }

    addValidEmail(email) {
        this.options.validEmails.add(email);
    }

    removeValidEmail(email) {
        this.options.validEmails.delete(email);
    }

    setCatchAll(enabled) {
        this.options.catchAll = enabled;
    }
}

module.exports = { SMTPServer };
