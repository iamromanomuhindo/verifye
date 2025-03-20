const net = require('net');
const dns = require('dns').promises;
const { logger } = require('../utils/logger');

class CatchAllDetector {
    constructor(domain, options = {}) {
        this.domain = domain;
        this.options = {
            timeout: options.timeout || 5000,
            port: options.port || 25,
            maxRetries: options.maxRetries || 2,
            retryDelay: options.retryDelay || 1000,
            // Test addresses that should never exist
            probeAddresses: [
                `not-exist-${Date.now()}`,
                `invalid-${Math.random().toString(36).substring(7)}`,
                `probe-${Math.random().toString(36).substring(7)}`
            ],
            // For testing local SMTP servers
            skipDNS: options.skipDNS || false,
            server: options.server || null
        };
    }

    async checkCatchAll() {
        try {
            let server = this.options.server;
            
            if (!this.options.skipDNS) {
                const mxRecords = await dns.resolveMx(this.domain);
                if (!mxRecords || mxRecords.length === 0) {
                    return {
                        isCatchAll: false,
                        confidence: 1,
                        reason: 'No MX records found'
                    };
                }
                // Sort MX records by priority
                const sortedMx = mxRecords.sort((a, b) => a.priority - b.priority);
                server = sortedMx[0].exchange;
            }

            if (!server) {
                return {
                    isCatchAll: null,
                    confidence: 0,
                    reason: 'No server specified'
                };
            }

            const results = [];

            // Test multiple non-existent addresses
            for (const probeAddress of this.options.probeAddresses) {
                const testEmail = `${probeAddress}@${this.domain}`;
                const result = await this.testAddress(testEmail, server);
                results.push(result);

                // Add delay between checks
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // Analyze results
            const acceptCount = results.filter(r => r.accepted).length;
            const totalTests = results.length;
            const acceptRatio = acceptCount / totalTests;

            if (acceptRatio > 0.8) {
                return {
                    isCatchAll: true,
                    confidence: acceptRatio,
                    reason: 'Domain accepts non-existent addresses',
                    details: results
                };
            } else if (acceptRatio > 0.3) {
                return {
                    isCatchAll: true,
                    confidence: acceptRatio,
                    reason: 'Domain likely has catch-all policy',
                    details: results
                };
            } else {
                return {
                    isCatchAll: false,
                    confidence: 1 - acceptRatio,
                    reason: 'Domain rejects non-existent addresses',
                    details: results
                };
            }

        } catch (error) {
            logger.error('Catch-all detection error:', error);
            return {
                isCatchAll: null,
                confidence: 0,
                reason: 'Unable to determine catch-all status',
                error: error.message
            };
        }
    }

    async testAddress(email, server) {
        const socket = new net.Socket();
        let response = {
            email,
            server,
            accepted: false,
            responses: []
        };

        return new Promise((resolve) => {
            socket.setTimeout(this.options.timeout);

            socket.on('error', (err) => {
                response.error = err.message;
                socket.destroy();
                resolve(response);
            });

            socket.on('timeout', () => {
                response.error = 'Connection timeout';
                socket.destroy();
                resolve(response);
            });

            let stage = 0;
            const stages = [
                { cmd: null, expect: '220' }, // Initial connection
                { cmd: `HELO verifier.local`, expect: '250' }, // HELO
                { cmd: `MAIL FROM:<verify@verifier.local>`, expect: '250' }, // MAIL FROM
                { cmd: `RCPT TO:<${email}>`, expect: '250' }, // RCPT TO
                { cmd: 'QUIT', expect: '221' } // QUIT
            ];

            socket.on('data', async (data) => {
                const responseText = data.toString();
                response.responses.push(responseText);

                // Check if response indicates rejection
                if (responseText.match(/^(554|501|503|550)/m)) {
                    response.accepted = false;
                    socket.destroy();
                    resolve(response);
                    return;
                }

                // Check if response matches expected code
                if (!responseText.match(new RegExp(`^${stages[stage].expect}`, 'm'))) {
                    response.accepted = false;
                    socket.destroy();
                    resolve(response);
                    return;
                }

                // Move to next stage
                stage++;
                if (stage >= stages.length) {
                    response.accepted = true;
                    socket.destroy();
                    resolve(response);
                    return;
                }

                // Send next command
                if (stages[stage].cmd) {
                    socket.write(stages[stage].cmd + '\r\n');
                }
            });

            // Connect to server
            socket.connect(this.options.port, server, () => {
                // Connection successful, initial stage
                response.connected = true;
            });
        });
    }
}

module.exports = { CatchAllDetector };
