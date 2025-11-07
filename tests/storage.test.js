const request = require('supertest');
const app = require('../src/server');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');
const { cleanupTestImages, createTestImage } = require('./helpers/images');

describe('Storage Management API', () => {
  const testCredentials = {
    userId: 'test_user_id',
    apiKey: 'test_api_key'
  };
  
  let validAuth;
  
  beforeAll(() => {
    process.env.HCTI_USER_ID = testCredentials.userId;
    process.env.HCTI_API_KEY = testCredentials.apiKey;
    process.env.NODE_ENV = 'test';
    
    validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
  });
  
  afterAll(async () => {
    await cleanupTestImages();
  });

  describe('GET /v1/storage/stats', () => {
    test('should return storage statistics with auth', async () => {
      const response = await request(app)
        .get('/v1/storage/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalImages');
      expect(response.body.data).toHaveProperty('totalSize');
      expect(response.body.data).toHaveProperty('totalSizeMB');
      expect(response.body.data).toHaveProperty('directory');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/v1/storage/stats')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
    });

    test('should return detailed stats when requested', async () => {
      const response = await request(app)
        .get('/v1/storage/stats?details=true')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body.data).toHaveProperty('images');
      expect(Array.isArray(response.body.data.images)).toBe(true);
    });
  });

  describe('GET /v1/storage/images', () => {
    test('should list images with pagination', async () => {
      const response = await request(app)
        .get('/v1/storage/images')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('images');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('page');
      expect(response.body.data.pagination).toHaveProperty('limit');
      expect(response.body.data.pagination).toHaveProperty('total');
    });

    test('should respect pagination parameters', async () => {
      const response = await request(app)
        .get('/v1/storage/images?page=1&limit=5')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.images.length).toBeLessThanOrEqual(5);
    });

    test('should support sorting', async () => {
      const response = await request(app)
        .get('/v1/storage/images?sortBy=size&order=desc')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body.data.sort.sortBy).toBe('size');
      expect(response.body.data.sort.order).toBe('desc');
    });
  });

  describe('POST /v1/storage/cleanup', () => {
    test('should clean old images', async () => {
      const response = await request(app)
        .post('/v1/storage/cleanup')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          maxAge: 1000 // 1 second
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data).toHaveProperty('deletedSize');
      expect(typeof response.body.data.deletedCount).toBe('number');
    });

    test('should clean by file count', async () => {
      // First create some test images
      await createTestImage('test-cleanup-1.png');
      await createTestImage('test-cleanup-2.png');
      await createTestImage('test-cleanup-3.png');
      
      const response = await request(app)
        .post('/v1/storage/cleanup')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          maxFiles: 1
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.deletedCount).toBeGreaterThanOrEqual(0);
    });

    test('should validate cleanup parameters', async () => {
      const response = await request(app)
        .post('/v1/storage/cleanup')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          maxAge: -1 // Invalid
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /v1/storage/images/:filename/validate', () => {
    test('should validate existing image', async () => {
      const filename = await createTestImage('test-validate.png');
      
      const response = await request(app)
        .post(`/v1/storage/images/${filename}/validate`)
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('filename', filename);
      expect(response.body.data).toHaveProperty('valid');
    });

    test('should handle non-existent image', async () => {
      const response = await request(app)
        .post('/v1/storage/images/non-existent.png/validate')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body.data.valid).toBe(false);
      expect(response.body.data.reason).toContain('not exist');
    });
  });

  describe('DELETE /v1/storage/images/:filename', () => {
    test('should delete existing image', async () => {
      const filename = await createTestImage('test-delete.png');
      
      const response = await request(app)
        .delete(`/v1/storage/images/${filename}`)
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('filename', filename);
    });

    test('should handle non-existent image', async () => {
      const response = await request(app)
        .delete('/v1/storage/images/non-existent.png')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(404);
      
      expect(response.body).toHaveProperty('message', 'Image not found');
    });

    test('should validate filename format', async () => {
      const response = await request(app)
        .delete('/v1/storage/images/invalid-filename!')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(400);
      
      expect(response.body).toHaveProperty('message', 'Invalid filename format');
    });
  });

  describe('Static Image Serving', () => {
    test('should serve existing images', async () => {
      const filename = await createTestImage('test-serve.png');
      
      const response = await request(app)
        .get(`/images/${filename}`)
        .expect(200);
      
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.headers).toHaveProperty('content-length');
      expect(response.headers).toHaveProperty('last-modified');
    });

    test('should return 404 for non-existent images', async () => {
      const response = await request(app)
        .get('/images/non-existent.png')
        .expect(404);
      
      expect(response.body).toHaveProperty('message', 'Image not found');
    });

    test('should validate filename format for static serving', async () => {
      const response = await request(app)
        .get('/images/invalid-filename!')
        .expect(400);
      
      expect(response.body).toHaveProperty('message', 'Invalid filename format');
    });

    test('should return image info', async () => {
      const filename = await createTestImage('test-info.png');
      
      const response = await request(app)
        .get(`/images/${filename}/info`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('filename', filename);
      expect(response.body).toHaveProperty('size');
      expect(response.body).toHaveProperty('created');
      expect(response.body).toHaveProperty('url');
    });
  });

  describe('Images Directory Listing', () => {
    test('should list images in development mode', async () => {
      // This test may not work in production mode
      if (process.env.NODE_ENV !== 'production') {
        const response = await request(app)
          .get('/images')
          .expect(200);
        
        expect(response.body).toHaveProperty('status', 'success');
        expect(response.body).toHaveProperty('images');
        expect(response.body).toHaveProperty('total');
      }
    });
  });
});