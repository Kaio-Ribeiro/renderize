const request = require('supertest');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');

// Setup test environment variables before importing the app
process.env.HCTI_USER_ID = testCredentials.userId;
process.env.HCTI_API_KEY = testCredentials.apiKey;
process.env.NODE_ENV = 'test';

const app = require('../src/server');

describe('Authentication Tests', () => {
  test('should reject requests without authentication', async () => {
    const response = await request(app)
      .get('/auth/test')
      .expect(401);
    
    expect(response.body).toHaveProperty('message');
  });

  test('should accept requests with valid credentials', async () => {
    const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
    
    const response = await request(app)
      .get('/auth/test')
      .set('Authorization', `Basic ${validAuth}`)
      .expect(200);
    
    expect(response.body).toHaveProperty('message', 'Authentication successful');
  });
});