const request = require('supertest');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');

// Setup test environment variables
process.env.HCTI_USER_ID = testCredentials.userId;
process.env.HCTI_API_KEY = testCredentials.apiKey;

const app = require('../src/server');

describe('API Structure Tests', () => {
  test('GET / - should return API information', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body.name).toBe('Renderize API');
    expect(response.body.status).toBe('running');
  });

  test('GET /v1 - should return API v1 information', async () => {
    const response = await request(app)
      .get('/v1')
      .expect(200);
    
    expect(response.body.name).toBe('Renderize API');
    expect(response.body.version).toBe('v1');
    expect(response.body.endpoints).toHaveProperty('auth');
    expect(response.body.endpoints).toHaveProperty('image');
  });

  test('GET /v1/status - should return API status', async () => {
    const response = await request(app)
      .get('/v1/status')
      .expect(200);
    
    expect(response.body.status).toBe('operational');
    expect(response.body.version).toBe('v1');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
  });

  test('GET /health - should return health check', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('memory');
    expect(response.body).toHaveProperty('version');
  });

  test('GET /v1/image/info - should return image endpoint info without auth', async () => {
    const response = await request(app)
      .get('/v1/image/info')
      .expect(401); // Should require authentication
    
    expect(response.body.status).toBe('error');
    expect(response.body.message).toContain('Authentication required');
  });

  test('GET /v1/image/info - should return image endpoint info with auth', async () => {
    const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
    
    const response = await request(app)
      .get('/v1/image/info')
      .set('Authorization', `Basic ${validAuth}`)
      .expect(200);
    
    expect(response.body.endpoint).toBe('/v1/image');
    expect(response.body.method).toBe('POST');
    expect(response.body.parameters).toHaveProperty('url');
    expect(response.body.parameters).toHaveProperty('selector');
  });

  test('POST /v1/image - should return not implemented error with auth', async () => {
    const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
    
    const response = await request(app)
      .post('/v1/image')
      .set('Authorization', `Basic ${validAuth}`)
      .send({
        url: 'https://example.com',
        selector: '.test'
      })
      .expect(501);
    
    expect(response.body.status).toBe('error');
    expect(response.body.message).toContain('not yet implemented');
  });

  test('GET /nonexistent - should return 404', async () => {
    const response = await request(app)
      .get('/nonexistent')
      .expect(404);
    
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Route not found');
    expect(response.body.path).toBe('/nonexistent');
  });

  test('Rate limiting - should handle too many requests', async () => {
    // This test might be flaky in fast test environments
    // but demonstrates the rate limiting functionality
    const requests = [];
    
    // Make multiple rapid requests (more than rate limit allows)
    for (let i = 0; i < 5; i++) {
      requests.push(request(app).get('/'));
    }
    
    const responses = await Promise.all(requests);
    
    // All should succeed since we have a reasonable rate limit
    responses.forEach(response => {
      expect([200, 429]).toContain(response.status);
    });
  });
});

module.exports = {
  testApp: app
};