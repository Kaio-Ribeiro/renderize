module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: false,
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000
};