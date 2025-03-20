# Verifye - Professional Email Validation API

A robust and professional-grade email validation API that performs comprehensive checks without relying on third-party services. Similar to services offered by Twilio and Mailgun, but self-hosted and privacy-focused.

## Features

### 1. Comprehensive Email Validation
- **Syntax Validation**: RFC 5322 compliant validation
- **DNS Validation**: Checks MX, A, SPF records, and DMARC policies
- **SMTP Validation**: Smart SMTP checking with anti-blocking measures
- **Catch-all Detection**: Identifies catch-all email domains
- **Disposable Email Detection**: Blocks temporary email addresses
- **Role-Based Detection**: Identifies role-based emails (e.g., admin@, support@)
- **Typo Detection**: Suggests corrections for common typos

### 2. Advanced Features
- **Smart Response Handling**: Interprets various SMTP responses
- **Connection Pooling**: Efficient connection management
- **Rate Limiting**: Prevents abuse and blocking
- **Detailed Results**: Comprehensive validation reports
- **Quality Scoring**: 0-100 score based on multiple factors

### 3. Infrastructure
- **Custom SMTP Server**: For testing and development
- **Catch-all Detection**: Advanced domain policy detection
- **Error Handling**: Robust error management
- **Logging System**: Structured logging for debugging

## Project Structure

```
verifye/
├── controllers/
│   └── emailController.js    # API endpoint handlers
├── services/
│   ├── emailValidator.js     # Main validation logic
│   ├── smtpChecker.js       # SMTP verification
│   ├── catchAllDetector.js  # Catch-all domain detection
│   └── smtpServer.js        # Test SMTP server
├── utils/
│   ├── disposableDomains.js # Disposable email list
│   ├── emailUtils.js        # Email utilities
│   ├── logger.js           # Logging configuration
│   └── regexValidator.js    # Regex patterns
└── server.js               # Express server setup
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/iamromanomuhindo/verifye.git
```

2. Install dependencies:
```bash
cd verifye
npm install
```

3. Create a `.env` file:
```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Usage

Start the server:
```bash
npm start
```

Make a validation request:
```bash
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

## Current Status

✅ Completed:
- Basic API setup with Express
- RFC 5322 compliant email validation
- DNS record validation (MX, A, SPF, DMARC)
- SMTP verification with smart response handling
- Disposable email detection
- Role-based email detection
- Catch-all domain detection
- Test SMTP server implementation
- Basic rate limiting and security

🚧 In Progress:
- Multiple SMTP server setup
- OAuth integration for major providers
- Advanced retry logic with backoff
- API documentation
- Performance optimization

## Next Steps

1. Set up distributed SMTP servers
2. Implement OAuth for major providers
3. Enhance retry logic
4. Add comprehensive API documentation
5. Add more test coverage
6. Set up monitoring and analytics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
