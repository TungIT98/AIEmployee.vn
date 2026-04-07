/**
 * Data Quality Service
 * COM-102 / COM-200: Real-time Data Validation System
 *
 * Features:
 * 1. Real-time input validation
 * 2. Data normalization (trim, standardize formats)
 * 3. Schema validation (JSON Schema)
 * 4. Data freshness checks
 * 5. Duplicate detection
 */

class DataQualityService {
  constructor(options = {}) {
    this.config = {
      // Default freshness threshold: 24 hours
      freshnessThresholdMs: options.freshnessThresholdMs || 24 * 60 * 60 * 1000,
      // Duplicate detection window: 5 minutes
      duplicateWindowMs: options.duplicateWindowMs || 5 * 60 * 1000,
      // Max field length
      maxFieldLength: options.maxFieldLength || 1000,
      ...options
    };

    // Track recent entries for duplicate detection
    this.recentEntries = [];
  }

  // ============================================
  // 1. REAL-TIME INPUT VALIDATION
  // ============================================

  /**
   * Validate a single field value
   */
  validateField(value, rules) {
    const errors = [];

    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push('Field is required');
      return { valid: false, errors };
    }

    if (value === undefined || value === null || value === '') {
      return { valid: true, errors: [] };
    }

    // Type validation
    if (rules.type) {
      const typeValid = this.validateType(value, rules.type);
      if (!typeValid) {
        errors.push(`Expected type ${rules.type}, got ${typeof value}`);
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`Minimum length is ${rules.minLength}`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`Maximum length is ${rules.maxLength}`);
      }
      if (rules.pattern && !rules.pattern.test(value)) {
        errors.push(`Value does not match required pattern`);
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) {
        errors.push(`Minimum value is ${rules.min}`);
      }
      if (rules.max !== undefined && value > rules.max) {
        errors.push(`Maximum value is ${rules.max}`);
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (rules.minItems && value.length < rules.minItems) {
        errors.push(`Minimum ${rules.minItems} items required`);
      }
      if (rules.maxItems && value.length > rules.maxItems) {
        errors.push(`Maximum ${rules.maxItems} items allowed`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate value type
   */
  validateType(value, expectedType) {
    const actualType = typeof value;
    if (actualType === expectedType) return true;

    // Handle special cases
    if (expectedType === 'integer' && Number.isInteger(value)) return true;
    if (expectedType === 'number' && typeof value === 'number') return true;
    if (expectedType === 'string' && typeof value === 'string') return true;
    if (expectedType === 'boolean' && typeof value === 'boolean') return true;
    if (expectedType === 'array' && Array.isArray(value)) return true;
    if (expectedType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) return true;

    return false;
  }

  /**
   * Validate multiple fields
   */
  validateInput(data, schema) {
    const results = {};
    let allValid = true;

    for (const [fieldName, rules] of Object.entries(schema)) {
      const value = data[fieldName];
      const fieldResult = this.validateField(value, rules);
      results[fieldName] = fieldResult;
      if (!fieldResult.valid) allValid = false;
    }

    // Check for unknown fields if strict mode
    if (schema.__strict !== false) {
      const knownFields = Object.keys(schema).filter(k => k !== '__strict');
      for (const fieldName of Object.keys(data)) {
        if (!knownFields.includes(fieldName)) {
          results[fieldName] = results[fieldName] || { valid: true, errors: [] };
          // Could add warning here for unknown fields
        }
      }
    }

    return {
      valid: allValid,
      fields: results,
      totalErrors: Object.values(results).reduce((sum, r) => sum + r.errors.length, 0)
    };
  }

  // ============================================
  // 2. DATA NORMALIZATION
  // ============================================

  /**
   * Normalize a string value
   */
  normalizeString(value, options = {}) {
    if (typeof value !== 'string') return value;

    let normalized = value;

    // Trim whitespace
    if (options.trim !== false) {
      normalized = normalized.trim();
    }

    // Collapse multiple spaces
    if (options.collapseSpaces) {
      normalized = normalized.replace(/\s+/g, ' ');
    }

    // Remove special characters
    if (options.removeSpecialChars) {
      normalized = normalized.replace(/[^\w\s\-]/g, '');
    }

    // Convert case
    if (options.toLowerCase) {
      normalized = normalized.toLowerCase();
    }
    if (options.toUpperCase) {
      normalized = normalized.toUpperCase();
    }

    // Standardize Unicode (NFC normalization)
    if (options.unicodeNormalize) {
      normalized = normalized.normalize('NFC');
    }

    // Standardize phone numbers
    if (options.standardizePhone) {
      normalized = this.standardizePhone(normalized);
    }

    // Standardize email
    if (options.standardizeEmail) {
      normalized = this.standardizeEmail(normalized);
    }

    // Standardize tax codes
    if (options.standardizeTaxCode) {
      normalized = this.standardizeTaxCode(normalized);
    }

    return normalized;
  }

  /**
   * Standardize phone number format
   */
  standardizePhone(phone) {
    if (typeof phone !== 'string') return phone;
    // Remove all non-digit characters except leading +
    let standardized = phone.replace(/[^\d+]/g, '');

    // Convert Vietnamese formats
    // +84 -> 0
    if (standardized.startsWith('+84')) {
      standardized = '0' + standardized.slice(3);
    }
    // 84 -> 0
    if (standardized.startsWith('84') && standardized.length > 10) {
      standardized = '0' + standardized.slice(2);
    }

    return standardized;
  }

  /**
   * Standardize email format
   */
  standardizeEmail(email) {
    if (typeof email !== 'string') return email;
    return email.trim().toLowerCase();
  }

  /**
   * Standardize Vietnamese tax code format
   */
  standardizeTaxCode(taxCode) {
    if (typeof taxCode !== 'string') return taxCode;
    // Remove hyphens and spaces
    return taxCode.replace(/[-\s]/g, '').toUpperCase();
  }

  /**
   * Normalize an object/record
   */
  normalizeRecord(data, normalizationRules) {
    const normalized = {};

    for (const [fieldName, value] of Object.entries(data)) {
      const rules = normalizationRules[fieldName];

      if (typeof value === 'string' && rules) {
        normalized[fieldName] = this.normalizeString(value, rules);
      } else {
        normalized[fieldName] = value;
      }
    }

    return normalized;
  }

  // ============================================
  // 3. JSON SCHEMA VALIDATION
  // ============================================

  /**
   * Validate data against a JSON Schema (simplified implementation)
   */
  validateSchema(data, schema) {
    const errors = [];
    this.validateSchemaRecursive(data, schema, '', errors);
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Recursive schema validation helper
   */
  validateSchemaRecursive(value, schema, path, errors) {
    // Handle null
    if (value === null) {
      if (schema.type && !schema.type.includes('null')) {
        errors.push({ path: path || 'root', message: `Value cannot be null`, schemaPath: path });
      }
      return;
    }

    // Type checking
    if (schema.type) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

      if (!allowedTypes.includes(actualType)) {
        errors.push({
          path: path || 'root',
          message: `Type mismatch: expected ${schema.type}, got ${actualType}`,
          schemaPath: path
        });
        return;
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push({ path, message: `String too short: min ${schema.minLength}`, schemaPath: path });
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push({ path, message: `String too long: max ${schema.maxLength}`, schemaPath: path });
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          errors.push({ path, message: `String does not match pattern: ${schema.pattern}`, schemaPath: path });
        }
      }
      if (schema.format) {
        const formatValid = this.validateFormat(value, schema.format);
        if (!formatValid) {
          errors.push({ path, message: `Invalid format: ${schema.format}`, schemaPath: path });
        }
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errors.push({ path, message: `Value not in enum: [${schema.enum.join(', ')}]`, schemaPath: path });
      }
    }

    // Number validations
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push({ path, message: `Number too small: min ${schema.minimum}`, schemaPath: path });
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push({ path, message: `Number too large: max ${schema.maximum}`, schemaPath: path });
      }
      if (schema.multipleOf !== undefined && value % schema.multipleOf !== 0) {
        errors.push({ path, message: `Number not multiple of ${schema.multipleOf}`, schemaPath: path });
      }
    }

    // Object validations
    if (typeof value === 'object' && !Array.isArray(value)) {
      // Required properties
      if (schema.required) {
        for (const reqProp of schema.required) {
          if (value[reqProp] === undefined) {
            errors.push({ path, message: `Missing required property: ${reqProp}`, schemaPath: path });
          }
        }
      }

      // Property validations
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          if (value[propName] !== undefined) {
            this.validateSchemaRecursive(value[propName], propSchema, `${path}.${propName}`, errors);
          }
        }
      }

      // Additional properties
      if (schema.additionalProperties === false) {
        const extraProps = Object.keys(value).filter(k => !schema.properties || !schema.properties[k]);
        if (extraProps.length > 0) {
          errors.push({ path, message: `Additional properties not allowed: ${extraProps.join(', ')}`, schemaPath: path });
        }
      }
    }

    // Array validations
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push({ path, message: `Array too short: min ${schema.minItems} items`, schemaPath: path });
      }
      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push({ path, message: `Array too long: max ${schema.maxItems} items`, schemaPath: path });
      }
      if (schema.uniqueItems && new Set(value.map(v => JSON.stringify(v))).size !== value.length) {
        errors.push({ path, message: `Array items must be unique`, schemaPath: path });
      }
      if (schema.items) {
        value.forEach((item, index) => {
          this.validateSchemaRecursive(item, schema.items, `${path}[${index}]`, errors);
        });
      }
    }
  }

  /**
   * Validate format strings
   */
  validateFormat(value, format) {
    const formats = {
      'date-time': /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?$/,
      'date': /^\d{4}-\d{2}-\d{2}$/,
      'time': /^\d{2}:\d{2}:\d{2}(\.\d{3})?$/,
      'email': /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'uri': /^https?:\/\/.+/,
      'uuid': /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'phone': /^[\d\s\-\+\(\)]{8,}$/,
      'tax-code': /^[\d\-]{10,14}$/
    };

    if (!formats[format]) return true; // Unknown format, skip validation
    return formats[format].test(value);
  }

  // ============================================
  // 4. DATA FRESHNESS CHECKS
  // ============================================

  /**
   * Check if data is fresh (recently updated)
   */
  checkFreshness(data, options = {}) {
    const threshold = options.thresholdMs || this.config.freshnessThresholdMs;
    const timestampField = options.timestampField || 'updatedAt';
    const createdField = options.createdField || 'createdAt';

    const now = Date.now();
    let lastUpdated = null;
    let ageMs = null;
    let isFresh = false;

    if (data[timestampField]) {
      lastUpdated = new Date(data[timestampField]).getTime();
      ageMs = now - lastUpdated;
      isFresh = ageMs <= threshold;
    } else if (data[createdField]) {
      lastUpdated = new Date(data[createdField]).getTime();
      ageMs = now - lastUpdated;
      isFresh = ageMs <= threshold;
    }

    return {
      isFresh,
      ageMs,
      lastUpdated,
      threshold,
      message: isFresh ? 'Data is fresh' : `Data is stale (age: ${this.formatAge(ageMs)})`
    };
  }

  /**
   * Format age in human-readable format
   */
  formatAge(ms) {
    if (ms === null || ms === undefined) return 'unknown';
    if (ms < 0) return 'future';

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }

  /**
   * Batch freshness check
   */
  checkBatchFreshness(items, options = {}) {
    return items.map(item => ({
      id: item.id || item._id,
      ...this.checkFreshness(item, options)
    }));
  }

  // ============================================
  // 5. DUPLICATE DETECTION
  // ============================================

  /**
   * Check for duplicate based on key fields
   */
  checkDuplicate(data, options = {}) {
    const keyFields = options.keyFields || ['email', 'phone'];
    const windowMs = options.windowMs || this.config.duplicateWindowMs;
    const now = Date.now();

    // Clean old entries outside the window
    this.recentEntries = this.recentEntries.filter(
      entry => (now - entry.timestamp) <= windowMs
    );

    // Build lookup key
    const lookupKey = keyFields.map(field => {
      const value = this.normalizeString(data[field], { trim: true, toLowerCase: true });
      return value || '';
    }).join('|');

    // Check for existing entry
    const existing = this.recentEntries.find(entry => entry.key === lookupKey);

    if (existing) {
      return {
        isDuplicate: true,
        originalId: existing.id,
        originalTimestamp: existing.timestamp,
        keyFields,
        key: lookupKey
      };
    }

    // Add to recent entries
    const newEntry = {
      id: data.id || data._id || `dq_${now}_${Math.random().toString(36).substr(2, 9)}`,
      key: lookupKey,
      timestamp: now,
      data: keyFields.reduce((acc, field) => ({ ...acc, [field]: data[field] }), {})
    };

    this.recentEntries.push(newEntry);

    // Limit memory usage
    if (this.recentEntries.length > 10000) {
      this.recentEntries = this.recentEntries.slice(-5000);
    }

    return {
      isDuplicate: false,
      keyFields,
      key: lookupKey
    };
  }

  /**
   * Check for duplicates within a dataset
   */
  findDuplicatesInDataset(items, keyFields = ['email', 'phone']) {
    const seen = new Map();
    const duplicates = [];

    for (const item of items) {
      const key = keyFields.map(field => {
        const value = this.normalizeString(item[field], { trim: true, toLowerCase: true });
        return value || '';
      }).join('|');

      if (seen.has(key)) {
        duplicates.push({
          current: item,
          original: seen.get(key),
          key
        });
      } else {
        seen.set(key, item);
      }
    }

    return {
      duplicates,
      count: duplicates.length,
      uniqueCount: items.length - duplicates.length
    };
  }

  /**
   * Clear duplicate detection cache
   */
  clearDuplicateCache() {
    this.recentEntries = [];
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'DataQuality',
      version: '1.0.0',
      status: 'operational',
      config: this.config,
      recentEntriesCount: this.recentEntries.length
    };
  }

  /**
   * Get supported validation types
   */
  getSupportedTypes() {
    return ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
  }

  /**
   * Get supported formats
   */
  getSupportedFormats() {
    return ['date-time', 'date', 'time', 'email', 'uri', 'uuid', 'phone', 'tax-code'];
  }
}

module.exports = DataQualityService;
