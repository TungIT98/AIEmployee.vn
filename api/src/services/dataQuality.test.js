/**
 * Data Quality Service Tests
 * COM-102 / COM-200: Real-time Data Validation System
 */

const DataQualityService = require('./dataQuality');

describe('DataQualityService', () => {
  let service;

  beforeEach(() => {
    service = new DataQualityService({
      freshnessThresholdMs: 24 * 60 * 60 * 1000,
      duplicateWindowMs: 5 * 60 * 1000
    });
  });

  afterEach(() => {
    service.clearDuplicateCache();
  });

  // ============================================
  // 1. REAL-TIME INPUT VALIDATION TESTS
  // ============================================

  describe('validateField', () => {
    it('should validate required fields', () => {
      const result = service.validateField(null, { required: true });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Field is required');
    });

    it('should pass non-required empty fields', () => {
      const result = service.validateField(null, { required: false });
      expect(result.valid).toBe(true);
    });

    it('should validate string minLength', () => {
      const result = service.validateField('ab', { minLength: 3 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum length is 3');
    });

    it('should validate string maxLength', () => {
      const result = service.validateField('abcdefgh', { maxLength: 5 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum length is 5');
    });

    it('should validate string pattern', () => {
      const result = service.validateField('abc', { pattern: /^[a-z]+$/ });
      expect(result.valid).toBe(true);
    });

    it('should fail string pattern mismatch', () => {
      const result = service.validateField('ABC', { pattern: /^[a-z]+$/ });
      expect(result.valid).toBe(false);
    });

    it('should validate number min', () => {
      const result = service.validateField(5, { min: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum value is 10');
    });

    it('should validate number max', () => {
      const result = service.validateField(15, { max: 10 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum value is 10');
    });

    it('should validate array minItems', () => {
      const result = service.validateField([1], { minItems: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Minimum 2 items required');
    });

    it('should validate array maxItems', () => {
      const result = service.validateField([1, 2, 3], { maxItems: 2 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Maximum 2 items allowed');
    });
  });

  describe('validateInput', () => {
    it('should validate multiple fields', () => {
      const data = { name: 'John', email: 'invalid', age: 25 };
      const rules = {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'string' },
        age: { required: true, type: 'number', min: 0 }
      };

      const result = service.validateInput(data, rules);
      // All fields are valid since type checks pass for each
      expect(result.valid).toBe(true);
      expect(result.fields.name.valid).toBe(true);
      expect(result.fields.email.valid).toBe(true); // "invalid" is a valid string
      expect(result.fields.age.valid).toBe(true);
    });

    it('should fail validation when field does not meet type requirement', () => {
      const data = { name: 'John', email: 123, age: 25 };
      const rules = {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'string' },
        age: { required: true, type: 'number', min: 0 }
      };

      const result = service.validateInput(data, rules);
      expect(result.valid).toBe(false);
      expect(result.fields.email.valid).toBe(false);
    });

    it('should pass valid data', () => {
      const data = { name: 'John', email: 'john@example.com', age: 25 };
      const rules = {
        name: { required: true, minLength: 2 },
        email: { required: true, type: 'string' },
        age: { required: true, type: 'number', min: 0 }
      };

      const result = service.validateInput(data, rules);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================
  // 2. DATA NORMALIZATION TESTS
  // ============================================

  describe('normalizeString', () => {
    it('should trim whitespace', () => {
      const result = service.normalizeString('  hello  ');
      expect(result).toBe('hello');
    });

    it('should collapse multiple spaces', () => {
      const result = service.normalizeString('hello   world', { collapseSpaces: true });
      expect(result).toBe('hello world');
    });

    it('should convert to lowercase', () => {
      const result = service.normalizeString('HELLO', { toLowerCase: true });
      expect(result).toBe('hello');
    });

    it('should convert to uppercase', () => {
      const result = service.normalizeString('hello', { toUpperCase: true });
      expect(result).toBe('HELLO');
    });

    it('should remove special characters', () => {
      const result = service.normalizeString('hello@world!', { removeSpecialChars: true });
      expect(result).toBe('helloworld');
    });
  });

  describe('standardizePhone', () => {
    it('should convert +84 to 0', () => {
      const result = service.standardizePhone('+84912345678');
      expect(result).toBe('0912345678');
    });

    it('should remove formatting characters', () => {
      const result = service.standardizePhone('0912-345-678');
      expect(result).toBe('0912345678');
    });
  });

  describe('standardizeEmail', () => {
    it('should lowercase and trim', () => {
      const result = service.standardizeEmail('  John@EXAMPLE.COM  ');
      expect(result).toBe('john@example.com');
    });
  });

  describe('standardizeTaxCode', () => {
    it('should remove hyphens and spaces', () => {
      const result = service.standardizeTaxCode('12-345-678');
      expect(result).toBe('12345678');
    });
  });

  describe('normalizeRecord', () => {
    it('should normalize specified fields', () => {
      const data = {
        email: '  John@EXAMPLE.COM  ',
        phone: '+84912345678',
        name: 'John'
      };
      const rules = {
        email: { trim: true, toLowerCase: true },
        phone: { trim: true, standardizePhone: true }
      };

      const result = service.normalizeRecord(data, rules);
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('0912345678');
      expect(result.name).toBe('John'); // not in rules, unchanged
    });
  });

  // ============================================
  // 3. JSON SCHEMA VALIDATION TESTS
  // ============================================

  describe('validateSchema', () => {
    it('should validate string type', () => {
      const result = service.validateSchema('hello', { type: 'string' });
      expect(result.valid).toBe(true);
    });

    it('should fail string type for number', () => {
      const result = service.validateSchema(123, { type: 'string' });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate string minLength', () => {
      const result = service.validateSchema('ab', { type: 'string', minLength: 3 });
      expect(result.valid).toBe(false);
    });

    it('should validate string maxLength', () => {
      const result = service.validateSchema('abcdef', { type: 'string', maxLength: 3 });
      expect(result.valid).toBe(false);
    });

    it('should validate string pattern', () => {
      const result = service.validateSchema('hello', { type: 'string', pattern: '^[a-z]+$' });
      expect(result.valid).toBe(true);
    });

    it('should validate string format (email)', () => {
      const result = service.validateSchema('test@example.com', { type: 'string', format: 'email' });
      expect(result.valid).toBe(true);
    });

    it('should fail invalid email format', () => {
      const result = service.validateSchema('notanemail', { type: 'string', format: 'email' });
      expect(result.valid).toBe(false);
    });

    it('should validate number minimum', () => {
      const result = service.validateSchema(5, { type: 'number', minimum: 10 });
      expect(result.valid).toBe(false);
    });

    it('should validate number maximum', () => {
      const result = service.validateSchema(15, { type: 'number', maximum: 10 });
      expect(result.valid).toBe(false);
    });

    it('should validate required properties', () => {
      const result = service.validateSchema(
        { name: 'John' },
        { type: 'object', required: ['name', 'email'] }
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.message.includes('email'))).toBe(true);
    });

    it('should validate nested properties', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2 },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };

      expect(service.validateSchema({ name: 'John', age: 25 }, schema).valid).toBe(true);
      expect(service.validateSchema({ name: 'J', age: 25 }, schema).valid).toBe(false);
      expect(service.validateSchema({ name: 'John', age: -5 }, schema).valid).toBe(false);
    });

    it('should validate array items', () => {
      const schema = {
        type: 'array',
        items: { type: 'number' }
      };

      expect(service.validateSchema([1, 2, 3], schema).valid).toBe(true);
      expect(service.validateSchema([1, 'two', 3], schema).valid).toBe(false);
    });

    it('should validate array minItems', () => {
      const result = service.validateSchema([1], { type: 'array', minItems: 2 });
      expect(result.valid).toBe(false);
    });

    it('should validate enum values', () => {
      const schema = { type: 'string', enum: ['active', 'inactive'] };
      expect(service.validateSchema('active', schema).valid).toBe(true);
      expect(service.validateSchema('pending', schema).valid).toBe(false);
    });
  });

  describe('validateFormat', () => {
    it('should validate date-time format', () => {
      expect(service.validateFormat('2024-01-15T10:30:00Z', 'date-time')).toBe(true);
      expect(service.validateFormat('2024-01-15', 'date-time')).toBe(false);
    });

    it('should validate date format', () => {
      expect(service.validateFormat('2024-01-15', 'date')).toBe(true);
    });

    it('should validate uuid format', () => {
      expect(service.validateFormat('550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe(true);
    });

    it('should validate uri format', () => {
      expect(service.validateFormat('https://example.com', 'uri')).toBe(true);
      expect(service.validateFormat('not-a-url', 'uri')).toBe(false);
    });
  });

  // ============================================
  // 4. DATA FRESHNESS TESTS
  // ============================================

  describe('checkFreshness', () => {
    it('should detect fresh data', () => {
      const data = { updatedAt: new Date().toISOString() };
      const result = service.checkFreshness(data);
      expect(result.isFresh).toBe(true);
    });

    it('should detect stale data', () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const data = { updatedAt: oldDate.toISOString() };
      const result = service.checkFreshness(data, { thresholdMs: 24 * 60 * 60 * 1000 });
      expect(result.isFresh).toBe(false);
    });

    it('should use createdAt if updatedAt not present', () => {
      const data = { createdAt: new Date().toISOString() };
      const result = service.checkFreshness(data);
      expect(result.isFresh).toBe(true);
    });

    it('should format age correctly', () => {
      expect(service.formatAge(5000)).toBe('5 seconds');
      expect(service.formatAge(120000)).toBe('2 minutes');
      expect(service.formatAge(3600000)).toBe('1 hours');
      expect(service.formatAge(86400000)).toBe('1 days');
    });
  });

  describe('checkBatchFreshness', () => {
    it('should check freshness for multiple items', () => {
      const items = [
        { id: 1, updatedAt: new Date().toISOString() },
        { id: 2, updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() }
      ];

      const results = service.checkBatchFreshness(items, { thresholdMs: 24 * 60 * 60 * 1000 });
      expect(results[0].isFresh).toBe(true);
      expect(results[1].isFresh).toBe(false);
    });
  });

  // ============================================
  // 5. DUPLICATE DETECTION TESTS
  // ============================================

  describe('checkDuplicate', () => {
    it('should not detect first entry as duplicate', () => {
      const data = { id: '1', email: 'test@example.com' };
      const result = service.checkDuplicate(data, { keyFields: ['email'] });
      expect(result.isDuplicate).toBe(false);
    });

    it('should detect duplicate entry', () => {
      const data1 = { id: '1', email: 'test@example.com' };
      const data2 = { id: '2', email: 'test@example.com' };

      service.checkDuplicate(data1, { keyFields: ['email'] });
      const result = service.checkDuplicate(data2, { keyFields: ['email'] });

      expect(result.isDuplicate).toBe(true);
      expect(result.originalId).toBe('1');
    });

    it('should use multiple key fields', () => {
      const data1 = { id: '1', email: 'test@example.com', phone: '0912345678' };
      const data2 = { id: '2', email: 'test@example.com', phone: '0912345678' };

      service.checkDuplicate(data1, { keyFields: ['email', 'phone'] });
      const result = service.checkDuplicate(data2, { keyFields: ['email', 'phone'] });

      expect(result.isDuplicate).toBe(true);
    });

    it('should not match different values', () => {
      const data1 = { id: '1', email: 'test1@example.com' };
      const data2 = { id: '2', email: 'test2@example.com' };

      service.checkDuplicate(data1, { keyFields: ['email'] });
      const result = service.checkDuplicate(data2, { keyFields: ['email'] });

      expect(result.isDuplicate).toBe(false);
    });

    it('should normalize before comparison', () => {
      const data1 = { id: '1', email: '  TEST@EXAMPLE.COM  ' };
      const data2 = { id: '2', email: 'test@example.com' };

      service.checkDuplicate(data1, { keyFields: ['email'] });
      const result = service.checkDuplicate(data2, { keyFields: ['email'] });

      expect(result.isDuplicate).toBe(true);
    });
  });

  describe('findDuplicatesInDataset', () => {
    it('should find duplicates in dataset', () => {
      const items = [
        { id: 1, email: 'a@example.com' },
        { id: 2, email: 'b@example.com' },
        { id: 3, email: 'a@example.com' }
      ];

      const result = service.findDuplicatesInDataset(items, ['email']);

      expect(result.count).toBe(1);
      expect(result.duplicates[0].original.id).toBe(1);
      expect(result.duplicates[0].current.id).toBe(3);
    });

    it('should return 0 duplicates for unique dataset', () => {
      const items = [
        { id: 1, email: 'a@example.com' },
        { id: 2, email: 'b@example.com' },
        { id: 3, email: 'c@example.com' }
      ];

      const result = service.findDuplicatesInDataset(items, ['email']);

      expect(result.count).toBe(0);
      expect(result.uniqueCount).toBe(3);
    });
  });

  describe('clearDuplicateCache', () => {
    it('should clear the cache', () => {
      const data = { id: '1', email: 'test@example.com' };
      service.checkDuplicate(data, { keyFields: ['email'] });
      expect(service.recentEntries.length).toBe(1);

      service.clearDuplicateCache();
      expect(service.recentEntries.length).toBe(0);
    });
  });

  // ============================================
  // UTILITY TESTS
  // ============================================

  describe('getStatus', () => {
    it('should return service status', () => {
      const status = service.getStatus();
      expect(status.service).toBe('DataQuality');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
    });
  });

  describe('getSupportedTypes', () => {
    it('should return supported types', () => {
      const types = service.getSupportedTypes();
      expect(types).toContain('string');
      expect(types).toContain('number');
      expect(types).toContain('boolean');
      expect(types).toContain('array');
      expect(types).toContain('object');
    });
  });

  describe('getSupportedFormats', () => {
    it('should return supported formats', () => {
      const formats = service.getSupportedFormats();
      expect(formats).toContain('email');
      expect(formats).toContain('date');
      expect(formats).toContain('uri');
      expect(formats).toContain('uuid');
    });
  });
});
