const { 
  validateUrl, 
  validateSelector, 
  validateImageParams, 
  ValidationError,
  sanitizeString,
  validatePagination
} = require('../src/utils/validation');

describe('Validation Utilities Tests', () => {
  describe('validateUrl', () => {
    test('should accept valid HTTP URL', () => {
      const url = 'http://example.com';
      expect(validateUrl(url)).toBe('http://example.com/');
    });

    test('should accept valid HTTPS URL', () => {
      const url = 'https://example.com/path?query=value';
      expect(validateUrl(url)).toBe(url);
    });

    test('should reject invalid URLs', () => {
      expect(() => validateUrl('invalid-url')).toThrow(ValidationError);
      expect(() => validateUrl('')).toThrow(ValidationError);
      expect(() => validateUrl(null)).toThrow(ValidationError);
      expect(() => validateUrl(123)).toThrow(ValidationError);
    });

    test('should reject non-HTTP protocols', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow(ValidationError);
      expect(() => validateUrl('file:///path')).toThrow(ValidationError);
    });
  });

  describe('validateSelector', () => {
    test('should accept valid CSS selectors', () => {
      expect(validateSelector('.class')).toBe('.class');
      expect(validateSelector('#id')).toBe('#id');
      expect(validateSelector('div.class')).toBe('div.class');
      expect(validateSelector('[data-test="value"]')).toBe('[data-test="value"]');
    });

    test('should reject invalid selectors', () => {
      expect(() => validateSelector('')).toThrow(ValidationError);
      expect(() => validateSelector(null)).toThrow(ValidationError);
      expect(() => validateSelector(123)).toThrow(ValidationError);
    });

    test('should reject selectors that are too long', () => {
      const longSelector = '.class'.repeat(200); // > 1000 chars
      expect(() => validateSelector(longSelector)).toThrow(ValidationError);
    });

    test('should trim whitespace', () => {
      expect(validateSelector('  .class  ')).toBe('.class');
    });
  });

  describe('validateImageParams', () => {
    test('should validate valid parameters', () => {
      const params = {
        url: 'https://example.com',
        selector: '.test-class'
      };
      
      const result = validateImageParams(params);
      expect(result.url).toBe('https://example.com/');
      expect(result.selector).toBe(params.selector);
    });

    test('should reject invalid parameters', () => {
      expect(() => validateImageParams({})).toThrow(ValidationError);
      expect(() => validateImageParams({ url: 'invalid' })).toThrow(ValidationError);
      expect(() => validateImageParams({ selector: '.test' })).toThrow(ValidationError);
    });
  });

  describe('sanitizeString', () => {
    test('should remove HTML tags', () => {
      expect(sanitizeString('Hello <script>alert(1)</script> World')).toBe('Hello scriptalert(1)/script World');
    });

    test('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    test('should limit length', () => {
      const longString = 'a'.repeat(2000);
      const result = sanitizeString(longString, 100);
      expect(result.length).toBe(100);
    });

    test('should handle non-strings', () => {
      expect(sanitizeString(123)).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('validatePagination', () => {
    test('should return default values for empty query', () => {
      const result = validatePagination({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.offset).toBe(0);
    });

    test('should parse valid pagination parameters', () => {
      const result = validatePagination({ page: '2', limit: '20' });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(20);
    });

    test('should reject invalid page numbers', () => {
      expect(() => validatePagination({ page: '0' })).toThrow(ValidationError);
      expect(() => validatePagination({ page: '-1' })).toThrow(ValidationError);
    });

    test('should reject invalid limits', () => {
      expect(() => validatePagination({ limit: '0' })).toThrow(ValidationError);
      expect(() => validatePagination({ limit: '101' })).toThrow(ValidationError);
    });
  });
});