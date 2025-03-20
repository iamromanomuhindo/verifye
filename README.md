# Verifye - Email Validation API

A robust and secure email validation API that performs comprehensive email address verification including syntax validation, MX record checking, and SMTP verification.

## Features

- ✅ Email syntax validation
- 🔍 MX record verification
- 📨 SMTP email existence check
- 🚫 Disposable email detection
- ⚡ Rate limiting protection
- 📝 Comprehensive logging
- 🔒 Security best practices
- 🏥 Health monitoring

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/iamromanomuhindo/verifye.git
cd verifye
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Documentation

### Validate Email
```http
POST /api/validate
```

Request body:
```json
{
  "email": "test@example.com"
}
```

Response:
```json
{
  "valid": true,
  "details": {
    "syntax": { "valid": true },
    "mx": { "valid": true },
    "smtp": { "valid": true }
  }
}
```

### Health Check
```http
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2025-03-20T00:51:35.000Z",
  "uptime": 1234,
  "memory": {
    "heapUsed": 123456,
    "heapTotal": 789012
  }
}
```

## Testing

Run the test suite:
```bash
npm test

# Watch mode
npm run test:watch
```

## Security

- Helmet.js for secure HTTP headers
- Rate limiting to prevent abuse
- CORS protection
- Input validation
- Error handling middleware

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.

## Author

Romano Muhindo
