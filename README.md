# Verifye - Independent Email Validation Service

A high-performance, distributed email validation service capable of validating millions of emails per day without relying on third-party services.

## Project Status

### Completed Features

1. **Core Infrastructure**
   - SMTP checker implementation
   - IP rotation system
   - Health monitoring
   - Rate limiting
   - Server configuration management

2. **Validation Features**
   - Email syntax validation
   - DNS validation
   - SMTP verification
   - Catch-all detection
   - Disposable email detection

3. **System Architecture**
   - Distributed SMTP servers
   - IP rotation strategy
   - Rate limiting per IP/provider
   - Health monitoring system

### Next Steps

1. **Server Setup**
   ```bash
   # 1. Set up your SMTP servers
   # 2. Configure IPs on each server
   # 3. Update .env file with server details:
   SMTP_SERVERS=smtp1.yourdomain.com:25:192.168.1.10:us-east,smtp2.yourdomain.com:25:192.168.1.11:eu-west
   ```

2. **Configuration**
   - [ ] Create `.env` file from `.env.example`
   - [ ] Add your SMTP server details
   - [ ] Configure rate limits for each provider
   - [ ] Set up IP rotation intervals

3. **Testing**
   - [ ] Test each SMTP server connection
   - [ ] Verify IP rotation works
   - [ ] Test rate limiting
   - [ ] Run validation tests

4. **Monitoring**
   - [ ] Set up server monitoring
   - [ ] Configure alerts
   - [ ] Monitor IP reputation
   - [ ] Track success rates

## Quick Start

1. **Installation**
   ```bash
   npm install
   cp .env.example .env
   ```

2. **Configuration**
   ```bash
   # Edit .env file with your SMTP servers
   nano .env
   ```

3. **Start the Service**
   ```bash
   npm start
   ```

## API Endpoints

### Email Validation
```bash
POST /api/validate
Content-Type: application/json

{
  "email": "test@example.com"
}
```

### Health Checks
```bash
# Basic health check
GET /health

# Detailed health status
GET /health/deep

# SMTP server status
GET /health/smtp

# IP rotation status
GET /health/ips
```

## Monitoring Dashboard

Access the monitoring dashboard at:
```
http://your-server:3000/dashboard
```

## System Requirements

- Node.js 16+
- 1GB RAM minimum per SMTP server
- Multiple IP addresses (recommended: 5-16 IPs per server)
- Stable network connection

## Performance

- Single Server (1GB RAM, 16 IPs):
  - ~6,000-7,000 validations/day
  - ~180,000-210,000 validations/month
  - Cost per 1000: $0.23

## Documentation

- [Implementation Strategy](docs/IMPLEMENTATION_STRATEGY.md)
- [API Documentation](docs/API.md)
- [Server Setup Guide](docs/SERVER_SETUP.md)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
