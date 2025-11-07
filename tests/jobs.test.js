const request = require('supertest');
const app = require('../src/server');
const { testCredentials, generateBasicAuth } = require('./helpers/testConfig');
const jobScheduler = require('../src/services/jobScheduler');

describe('Job Scheduler API', () => {
  let validAuth;
  
  beforeAll(() => {
    process.env.HCTI_USER_ID = testCredentials.userId;
    process.env.HCTI_API_KEY = testCredentials.apiKey;
    process.env.NODE_ENV = 'test';
    
    validAuth = generateBasicAuth(testCredentials.userId, testCredentials.apiKey);
  });
  
  afterAll(() => {
    // Ensure job scheduler is stopped
    try {
      jobScheduler.stop();
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('GET /v1/jobs/status', () => {
    test('should return job scheduler status with auth', async () => {
      const response = await request(app)
        .get('/v1/jobs/status')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('isRunning');
      expect(response.body.data).toHaveProperty('jobCount');
      expect(response.body.data).toHaveProperty('jobs');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .get('/v1/jobs/status')
        .expect(401);
      
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('GET /v1/jobs/info', () => {
    test('should return job configuration info', async () => {
      const response = await request(app)
        .get('/v1/jobs/info')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('cleanup');
      expect(response.body.data).toHaveProperty('monitoring');
      expect(response.body.data).toHaveProperty('healthCheck');
      expect(response.body.data).toHaveProperty('timezone');
      
      // Check cleanup job config
      expect(response.body.data.cleanup).toHaveProperty('enabled');
      expect(response.body.data.cleanup).toHaveProperty('schedule');
      expect(response.body.data.cleanup).toHaveProperty('maxAge');
      expect(response.body.data.cleanup).toHaveProperty('description');
    });
  });

  describe('POST /v1/jobs/cleanup/run', () => {
    test('should run manual cleanup successfully', async () => {
      const response = await request(app)
        .post('/v1/jobs/cleanup/run')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          maxAge: 1000 // 1 second
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data).toHaveProperty('deletedSize');
      expect(response.body.data).toHaveProperty('executedAt');
      expect(typeof response.body.data.deletedCount).toBe('number');
    });

    test('should run cleanup with default settings', async () => {
      const response = await request(app)
        .post('/v1/jobs/cleanup/run')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body.data).toHaveProperty('deletedCount');
      expect(response.body.data.maxAge).toBe('default');
    });

    test('should validate maxAge parameter', async () => {
      const response = await request(app)
        .post('/v1/jobs/cleanup/run')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          maxAge: -1 // Invalid
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /v1/jobs/start', () => {
    test('should start job scheduler', async () => {
      // First stop it
      jobScheduler.stop();
      
      const response = await request(app)
        .post('/v1/jobs/start')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('message', 'Job scheduler started');
      expect(response.body.data).toHaveProperty('isRunning');
    });
  });

  describe('POST /v1/jobs/stop', () => {
    test('should stop job scheduler', async () => {
      // First ensure it's running
      jobScheduler.start();
      
      const response = await request(app)
        .post('/v1/jobs/stop')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('status', 'success');
      expect(response.body).toHaveProperty('message', 'Job scheduler stopped');
      expect(response.body.data).toHaveProperty('isRunning');
    });
  });

  describe('Job Scheduler Functionality', () => {
    test('should be able to run cleanup manually', async () => {
      // This tests the direct jobScheduler functionality
      const result = await jobScheduler.runCleanupNow(1000); // 1 second
      
      expect(result).toHaveProperty('deletedCount');
      expect(result).toHaveProperty('deletedSize');
      expect(typeof result.deletedCount).toBe('number');
      expect(typeof result.deletedSize).toBe('number');
    });

    test('should provide status information', () => {
      const status = jobScheduler.getStatus();
      
      expect(status).toHaveProperty('isRunning');
      expect(status).toHaveProperty('jobCount');
      expect(status).toHaveProperty('jobs');
      expect(typeof status.isRunning).toBe('boolean');
      expect(typeof status.jobCount).toBe('number');
    });

    test('should start and stop correctly', () => {
      // Stop first
      jobScheduler.stop();
      let status = jobScheduler.getStatus();
      expect(status.isRunning).toBe(false);
      
      // Start
      jobScheduler.start();
      status = jobScheduler.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.jobCount).toBeGreaterThan(0);
      
      // Stop again
      jobScheduler.stop();
      status = jobScheduler.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });
});