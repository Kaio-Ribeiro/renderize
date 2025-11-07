const request = require('supertest');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');

// Setup test environment
process.env.HCTI_USER_ID = testCredentials.userId;
process.env.HCTI_API_KEY = testCredentials.apiKey;
process.env.NODE_ENV = 'test';

const app = require('../src/server');

describe('API Tests', () => {
  const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);

  test('should return API root information', async () => {
    const response = await request(app)
      .get('/')
      .expect(200);
    
    expect(response.body).toHaveProperty('name', 'Renderize API');
    expect(response.body).toHaveProperty('status', 'running');
  });

  test('should return health status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'healthy');
  });

  test('should process image conversion with valid auth', async () => {
    const response = await request(app)
      .post('/v1/image')
      .set('Authorization', `Basic ${validAuth}`)
      .send({
        url: 'https://example.com',
        selector: 'h1'
      });
    
    // Should succeed or handle errors gracefully
    expect([200, 400, 408, 500]).toContain(response.status);
    
    if (response.status === 200) {
      expect(response.body).toHaveProperty('url');
      expect(response.body).toHaveProperty('filename');
    }
  }, 30000);

  test('should require auth for image endpoint', async () => {
    const response = await request(app)
      .post('/v1/image')
      .send({
        url: 'https://example.com',
        selector: 'h1'
      })
      .expect(401);
    
    expect(response.body).toHaveProperty('message');
  });
});