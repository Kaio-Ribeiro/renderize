module.exports = {
  testCredentials: {
    userId: 'test_user_id',
    apiKey: 'test_api_key_12345'
  },
  
  generateBasicAuth: (username, password) => {
    const credentials = `${username}:${password}`;
    return Buffer.from(credentials).toString('base64');
  }
};