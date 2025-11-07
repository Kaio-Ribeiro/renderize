const crypto = require('crypto');

/**
 * Authentication utility functions
 */
class AuthUtils {
  /**
   * Generate Base64 encoded credentials for Basic Auth
   * @param {string} username - User ID
   * @param {string} password - API Key
   * @returns {string} Base64 encoded credentials
   */
  static encodeCredentials(username, password) {
    const credentials = `${username}:${password}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Decode Base64 credentials
   * @param {string} encodedCredentials - Base64 encoded credentials
   * @returns {object} Decoded credentials {username, password}
   */
  static decodeCredentials(encodedCredentials) {
    const credentials = Buffer.from(encodedCredentials, 'base64').toString('ascii');
    const [username, password] = credentials.split(':');
    return { username, password };
  }

  /**
   * Generate Authorization header value
   * @param {string} username - User ID
   * @param {string} password - API Key
   * @returns {string} Authorization header value
   */
  static createAuthHeader(username, password) {
    const encoded = this.encodeCredentials(username, password);
    return `Basic ${encoded}`;
  }

  /**
   * Generate secure random API key
   * @param {number} length - Key length (default: 32)
   * @returns {string} Random API key
   */
  static generateApiKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random User ID
   * @param {number} length - ID length (default: 16)
   * @returns {string} Random User ID
   */
  static generateUserId(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Validate credential format
   * @param {string} userId - User ID to validate
   * @param {string} apiKey - API Key to validate
   * @returns {object} Validation result {isValid, errors}
   */
  static validateCredentials(userId, apiKey) {
    const errors = [];

    if (!userId || typeof userId !== 'string') {
      errors.push('User ID is required and must be a string');
    } else if (userId.length < 4) {
      errors.push('User ID must be at least 4 characters long');
    }

    if (!apiKey || typeof apiKey !== 'string') {
      errors.push('API Key is required and must be a string');
    } else if (apiKey.length < 16) {
      errors.push('API Key must be at least 16 characters long');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = AuthUtils;