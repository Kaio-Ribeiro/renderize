const request = require('supertest');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');

// Setup test environment variables before importing the app
process.env.HCTI_USER_ID = testCredentials.userId;
process.env.HCTI_API_KEY = testCredentials.apiKey;

const app = require('../src/server');

describe('Authentication Tests', () => {
  test('GET /auth/config - should show authentication configuration', async () => {
    const response = await request(app)
      .get('/auth/config')
      .expect(200);
    
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('configuration');
  });

  test('GET /auth/generate - should generate sample credentials', async () => {
    const response = await request(app)
      .post('/auth/generate')
      .expect(200);
    
    expect(response.body.status).toBe('success');
    expect(response.body.credentials).toHaveProperty('userId');
    expect(response.body.credentials).toHaveProperty('apiKey');
    expect(response.body.credentials).toHaveProperty('authHeader');
  });

  test('GET /auth/status - should show not authenticated without credentials', async () => {
    const response = await request(app)
      .get('/auth/status')
      .expect(200);
    
    expect(response.body.status).toBe('not_authenticated');
  });

  test('GET /auth/test - should fail without authentication', async () => {
    const response = await request(app)
      .get('/auth/test')
      .expect(401);
    
    expect(response.body.status).toBe('error');
    expect(response.body.message).toContain('Authentication required');
  });

  test('GET /auth/test - should fail with invalid credentials', async () => {
    const invalidAuth = generateBasicAuth('invalid', 'credentials');
    
    const response = await request(app)
      .get('/auth/test')
      .set('Authorization', `Basic ${invalidAuth}`)
      .expect(401);
    
    expect(response.body.status).toBe('error');
    expect(response.body.message).toContain('Invalid credentials');
  });

  test('GET /auth/test - should succeed with valid credentials', async () => {
    const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
    
    const response = await request(app)
      .get('/auth/test')
      .set('Authorization', `Basic ${validAuth}`)
      .expect(200);
    
    expect(response.body.status).toBe('success');
    expect(response.body.message).toContain('Authentication successful');
  });
});

module.exports = {
  testApp: app
};