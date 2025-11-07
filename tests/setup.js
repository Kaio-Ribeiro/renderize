// Jest setup file
require('dotenv').config({ path: '.env.example' });

// Setup test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Different port for testing
process.env.LOG_LEVEL = 'silent'; // Reduce log noise during tests

// Global test timeout
jest.setTimeout(10000);

// Cleanup after all tests
afterAll(async () => {
  // Give time for any async operations to complete
  await new Promise(resolve => setTimeout(resolve, 100));
});