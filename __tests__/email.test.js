const request = require('supertest');
const app = require('../server');

describe('Email Validation API', () => {
  describe('POST /api/validate', () => {
    it('should validate a correct email address', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({ email: 'test@example.com' });

      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('valid');
      expect(response.body).toHaveProperty('details');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({ email: 'invalid-email' });

      expect(response.statusCode).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    it('should handle missing email parameter', async () => {
      const response = await request(app)
        .post('/api/validate')
        .send({});

      expect(response.statusCode).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.statusCode).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });
});
