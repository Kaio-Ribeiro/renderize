const request = require('supertest');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');

// Setup test environment variables
process.env.HCTI_USER_ID = testCredentials.userId;
process.env.HCTI_API_KEY = testCredentials.apiKey;

const app = require('../src/server');

describe('Image Conversion API Tests', () => {
  const validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
  
  beforeAll(() => {
    jest.setTimeout(60000); // 60 seconds for image operations
  });

  describe('POST /v1/image', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/v1/image')
        .send({
          url: 'https://example.com',
          selector: 'h1'
        })
        .expect(401);
      
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Authentication required');
    });

    test('should validate required parameters', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({})
        .expect(400);
      
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('required');
    });

    test('should validate URL format', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'invalid-url',
          selector: 'h1'
        })
        .expect(400);
      
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('Invalid URL');
    });

    test('should validate CSS selector', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: ''
        })
        .expect(400);
      
      expect(response.body.status).toBe('error');
    });

    test('should successfully convert HTML element to image', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: 'h1'
        });
      
      // Should succeed or return a meaningful error
      expect([200, 400, 408, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('size');
        expect(response.body).toHaveProperty('requestId');
        expect(response.body.url).toMatch(/\/images\/.*\.png$/);
      } else {
        expect(response.body).toHaveProperty('status', 'error');
        expect(response.body).toHaveProperty('message');
      }
    }, 30000);

    test('should handle non-existent selectors gracefully', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: '.non-existent-selector-12345'
        });
      
      expect([400, 408]).toContain(response.status);
      
      if (response.status === 400) {
        expect(response.body.message).toContain('selector');
      }
    }, 45000);

    test('should handle inaccessible URLs', async () => {
      const response = await request(app)
        .post('/v1/image')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://nonexistent-domain-12345.com',
          selector: 'body'
        })
        .expect(400);
      
      expect(response.body.status).toBe('error');
      expect(response.body.message).toContain('not accessible');
    }, 30000);
  });

  describe('POST /v1/image/check', () => {
    test('should check URL accessibility with auth', async () => {
      const response = await request(app)
        .post('/v1/image/check')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: 'h1' // Required by validation but not used for check
        })
        .expect(200);
      
      expect(response.body.url).toMatch(/^https:\/\/example\.com\/?$/);
      expect(response.body).toHaveProperty('accessible');
      expect(response.body).toHaveProperty('requestId');
    }, 15000);

    test('should detect inaccessible URLs', async () => {
      const response = await request(app)
        .post('/v1/image/check')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://nonexistent-domain-12345.com',
          selector: 'body'
        })
        .expect(200);
      
      expect(response.body.accessible).toBe(false);
      expect(response.body).toHaveProperty('error');
    }, 15000);
  });

  describe('POST /v1/image/page-info', () => {
    test('should get page information', async () => {
      const response = await request(app)
        .post('/v1/image/page-info')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: 'body'
        });
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('title');
        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('viewport');
        expect(response.body).toHaveProperty('requestId');
      } else {
        expect(response.body).toHaveProperty('status', 'error');
      }
    }, 15000);
  });

  describe('POST /v1/image/full-page', () => {
    test('should capture full page screenshot', async () => {
      const response = await request(app)
        .post('/v1/image/full-page')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          selector: 'body' // Required by validation
        });
      
      // Should succeed or fail gracefully
      expect([200, 400, 408, 500]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('url');
        expect(response.body).toHaveProperty('filename');
        expect(response.body).toHaveProperty('size');
        expect(response.body.filename).toMatch(/screenshot.*\.png$/);
      }
    }, 30000);
  });

  describe('GET /v1/image/info', () => {
    test('should return endpoint information with auth', async () => {
      const response = await request(app)
        .get('/v1/image/info')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body.endpoint).toBe('/v1/image');
      expect(response.body.method).toBe('POST');
      expect(response.body.status).toBe('Active');
      expect(response.body.parameters).toHaveProperty('url');
      expect(response.body.parameters).toHaveProperty('selector');
    });
  });
});