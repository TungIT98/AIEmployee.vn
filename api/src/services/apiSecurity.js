/**
 * API Security Service
 * COM-104 / COM-202: OAuth 2.0, Rate Limiting, RBAC
 *
 * Features:
 * 1. OAuth 2.0 authentication
 * 2. Rate limiting per endpoint/user
 * 3. Role-based access control (RBAC)
 * 4. API key management
 * 5. Input sanitization
 */

const crypto = require('crypto');

// ============================================
// RATE LIMITING
// ============================================

// Redis-backed distributed rate limiter (supports sliding window)
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minute default
    this.maxRequests = options.maxRequests || 100;
    this.store = new Map(); // Fallback in-memory store
    this.redis = null;
    this.redisAvailable = false;

    // Initialize Redis if connection string provided
    if (options.redisUrl) {
      this._initRedis(options.redisUrl);
    }
  }

  async _initRedis(redisUrl) {
    try {
      const Redis = require('ioredis');
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryDelayOnFailover: 100,
        lazyConnect: true
      });

      this.redis.on('connect', () => {
        this.redisAvailable = true;
        console.log('Rate limiter: Redis connected');
      });

      this.redis.on('error', (err) => {
        this.redisAvailable = false;
        console.warn('Rate limiter: Redis error, using in-memory fallback:', err.message);
      });

      await this.redis.connect().catch(() => {
        // Silently fail - will use in-memory fallback
      });
    } catch (err) {
      console.warn('Rate limiter: Redis initialization failed, using in-memory fallback');
      this.redisAvailable = false;
    }
  }

  /**
   * Check if request is allowed (Redis-backed sliding window)
   */
  async isAllowed(identifier) {
    const now = Date.now();
    const key = `rate:${identifier}`;
    const windowStart = now - this.windowMs;

    // Try Redis first
    if (this.redis && this.redisAvailable) {
      return this._redisCheck(key, now, windowStart);
    }

    // Fallback to in-memory
    return this._memoryCheck(key, now);
  }

  async _redisCheck(key, now, windowStart) {
    try {
      const multi = this.redis.multi();

      // Remove old entries outside the window
      multi.zremrangebyscore(key, 0, windowStart);

      // Count current requests in window
      multi.zcard(key);

      // Add current request
      multi.zadd(key, now, `${now}-${Math.random()}`);

      // Set expiry on the key
      multi.expire(key, Math.ceil(this.windowMs / 1000) + 1);

      const results = await multi.exec();
      const count = results[1][1]; // zcard result

      if (count >= this.maxRequests) {
        // Get oldest entry to calculate reset time
        const oldest = await this.redis.zrange(key, 0, 0, 'WITHSCORES');
        const resetAt = oldest.length >= 2 ? parseInt(oldest[1]) + this.windowMs : now + this.windowMs;

        return {
          allowed: false,
          remaining: 0,
          resetAt,
          distributed: true
        };
      }

      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - count - 1),
        resetAt: now + this.windowMs,
        distributed: true
      };
    } catch (err) {
      console.warn('Rate limiter Redis error, falling back to memory:', err.message);
      this.redisAvailable = false;
      return this._memoryCheck(key, now);
    }
  }

  _memoryCheck(key, now) {
    if (!this.store.has(key)) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs, requests: [now] });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs };
    }

    const record = this.store.get(key);

    // Reset if window expired
    if (now >= record.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs, requests: [now] });
      return { allowed: true, remaining: this.maxRequests - 1, resetAt: now + this.windowMs };
    }

    // Check limit
    if (record.count >= this.maxRequests) {
      return { allowed: false, remaining: 0, resetAt: record.resetAt };
    }

    record.count++;
    record.requests.push(now);
    return { allowed: true, remaining: this.maxRequests - record.count, resetAt: record.resetAt };
  }

  /**
   * Reset limit for identifier
   */
  async reset(identifier) {
    const key = `rate:${identifier}`;

    if (this.redis && this.redisAvailable) {
      try {
        await this.redis.del(key);
      } catch (err) {
        console.warn('Redis reset error:', err.message);
      }
    }

    this.store.delete(key);
  }

  /**
   * Cleanup expired entries (memory store only)
   */
  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now >= record.resetAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get rate limit status for an identifier
   */
  async getStatus(identifier) {
    const key = `rate:${identifier}`;
    const now = Date.now();

    if (this.redis && this.redisAvailable) {
      try {
        const windowStart = now - this.windowMs;
        await this.redis.zremrangebyscore(key, 0, windowStart);
        const count = await this.redis.zcard(key);
        return {
          count,
          limit: this.maxRequests,
          remaining: Math.max(0, this.maxRequests - count),
          windowMs: this.windowMs,
          distributed: true
        };
      } catch (err) {
        // Fall through to memory
      }
    }

    const record = this.store.get(key);
    if (!record || now >= record.resetAt) {
      return { count: 0, limit: this.maxRequests, remaining: this.maxRequests, windowMs: this.windowMs, distributed: false };
    }

    return {
      count: record.count,
      limit: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - record.count),
      windowMs: this.windowMs,
      distributed: false
    };
  }
}

// ============================================
// API KEY MANAGEMENT
// ============================================

class ApiKeyManager {
  constructor(options = {}) {
    this.keys = new Map(); // key -> { keyId, secretHash, userId, scopes, createdAt, expiresAt }
    this.prefix = options.prefix || 'sk';
  }

  /**
   * Generate new API key
   */
  generateKey(userId, scopes = [], options = {}) {
    const keyId = `${this.prefix}_${crypto.randomBytes(8).toString('hex')}`;
    const secret = crypto.randomBytes(32).toString('hex');
    const key = `${keyId}.${secret}`;

    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

    const record = {
      keyId,
      secretHash,
      userId,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt: options.expiresAt || null,
      lastUsedAt: null
    };

    this.keys.set(keyId, record);

    return {
      keyId,
      key, // Only returned once!
      userId,
      scopes,
      expiresAt: record.expiresAt
    };
  }

  /**
   * Validate API key
   */
  validateKey(key) {
    if (!key || typeof key !== 'string') {
      return { valid: false, error: 'Key is required' };
    }

    const parts = key.split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid key format' };
    }

    const [keyId, secret] = parts;
    const record = this.keys.get(keyId);

    if (!record) {
      return { valid: false, error: 'Key not found' };
    }

    // Check expiration
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return { valid: false, error: 'Key expired' };
    }

    // Verify secret
    const secretHash = crypto.createHash('sha256').update(secret).digest('hex');
    if (secretHash !== record.secretHash) {
      return { valid: false, error: 'Invalid key' };
    }

    // Update last used
    record.lastUsedAt = new Date().toISOString();

    return {
      valid: true,
      keyId: record.keyId,
      userId: record.userId,
      scopes: record.scopes
    };
  }

  /**
   * Revoke API key
   */
  revokeKey(keyId) {
    return this.keys.delete(keyId);
  }

  /**
   * List keys for user
   */
  listKeysForUser(userId) {
    const result = [];
    for (const [keyId, record] of this.keys.entries()) {
      if (record.userId === userId) {
        result.push({
          keyId,
          userId: record.userId,
          scopes: record.scopes,
          createdAt: record.createdAt,
          expiresAt: record.expiresAt,
          lastUsedAt: record.lastUsedAt
        });
      }
    }
    return result;
  }
}

// ============================================
// RBAC - ROLE-BASED ACCESS CONTROL
// ============================================

const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest'
};

const PERMISSIONS = {
  'users:read': [ROLES.ADMIN, ROLES.USER],
  'users:write': [ROLES.ADMIN],
  'users:delete': [ROLES.ADMIN],
  'employees:read': [ROLES.ADMIN, ROLES.USER],
  'employees:write': [ROLES.ADMIN, ROLES.USER],
  'employees:delete': [ROLES.ADMIN],
  'tasks:read': [ROLES.ADMIN, ROLES.USER, ROLES.GUEST],
  'tasks:write': [ROLES.ADMIN, ROLES.USER],
  'tasks:delete': [ROLES.ADMIN],
  'contacts:read': [ROLES.ADMIN, ROLES.USER],
  'contacts:write': [ROLES.ADMIN, ROLES.USER],
  'contacts:delete': [ROLES.ADMIN],
  'invoices:read': [ROLES.ADMIN, ROLES.USER],
  'invoices:write': [ROLES.ADMIN, ROLES.USER],
  'invoices:delete': [ROLES.ADMIN],
  'reports:read': [ROLES.ADMIN],
  'settings:read': [ROLES.ADMIN],
  'settings:write': [ROLES.ADMIN],
  'admin:all': [ROLES.ADMIN]
};

class RBACService {
  constructor(options = {}) {
    this.userRoles = new Map(); // userId -> roles[]
    this.rolePermissions = PERMISSIONS;
  }

  /**
   * Assign role to user
   */
  assignRole(userId, role) {
    if (!Object.values(ROLES).includes(role)) {
      throw new Error(`Invalid role: ${role}`);
    }

    if (!this.userRoles.has(userId)) {
      this.userRoles.set(userId, []);
    }

    const roles = this.userRoles.get(userId);
    if (!roles.includes(role)) {
      roles.push(role);
    }
  }

  /**
   * Remove role from user
   */
  removeRole(userId, role) {
    if (!this.userRoles.has(userId)) return;

    const roles = this.userRoles.get(userId);
    const index = roles.indexOf(role);
    if (index > -1) {
      roles.splice(index, 1);
    }
  }

  /**
   * Check if user has permission
   */
  hasPermission(userId, permission) {
    const roles = this.userRoles.get(userId) || [];
    const allowedRoles = this.rolePermissions[permission] || [];

    // Check if any of user's roles have the permission
    return roles.some(role => allowedRoles.includes(role));
  }

  /**
   * Check permission and throw if not allowed
   */
  requirePermission(userId, permission) {
    if (!this.hasPermission(userId, permission)) {
      const error = new Error(`Permission denied: ${permission}`);
      error.code = 'FORBIDDEN';
      error.status = 403;
      throw error;
    }
  }

  /**
   * Get user's roles
   */
  getUserRoles(userId) {
    return this.userRoles.get(userId) || [];
  }

  /**
   * Get user's permissions
   */
  getUserPermissions(userId) {
    const roles = this.getUserRoles(userId);
    const permissions = new Set();

    for (const [permission, allowedRoles] of Object.entries(this.rolePermissions)) {
      if (roles.some(role => allowedRoles.includes(role))) {
        permissions.add(permission);
      }
    }

    return Array.from(permissions);
  }
}

// ============================================
// INPUT SANITIZATION
// ============================================

class InputSanitizer {
  constructor(options = {}) {
    this.maxLength = options.maxLength || 10000;
    this.stripHtml = options.stripHtml !== false;
  }

  /**
   * Sanitize string input
   */
  sanitizeString(input) {
    if (typeof input !== 'string') return input;

    let sanitized = input;

    // Trim whitespace
    sanitized = sanitized.trim();

    // Limit length
    if (sanitized.length > this.maxLength) {
      sanitized = sanitized.substring(0, this.maxLength);
    }

    // Strip HTML tags if enabled
    if (this.stripHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Normalize Unicode
    sanitized = sanitized.normalize('NFC');

    return sanitized;
  }

  /**
   * Sanitize object input
   */
  sanitizeObject(obj, fields = []) {
    const sanitized = {};

    for (const [key, value] of Object.entries(obj)) {
      if (fields.length > 0 && !fields.includes(key)) {
        sanitized[key] = value;
        continue;
      }

      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value, fields);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize SQL-like input (prevent injection)
   */
  sanitizeForSQL(input) {
    if (typeof input !== 'string') return input;
    // Escape special characters
    return input
      .replace(/'/g, "''")
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
  }

  /**
   * Validate and sanitize email
   */
  sanitizeEmail(email) {
    if (typeof email !== 'string') return null;
    const sanitized = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(sanitized) ? sanitized : null;
  }

  /**
   * Validate and sanitize URL
   */
  sanitizeUrl(url) {
    if (typeof url !== 'string') return null;
    try {
      const urlObj = new URL(url);
      // Only allow http and https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return null;
      }
      return urlObj.toString();
    } catch {
      return null;
    }
  }
}

// ============================================
// OAUTH 2.0 SERVICE (Simplified)
// ============================================

class OAuth2Service {
  constructor(options = {}) {
    this.clients = new Map(); // clientId -> { clientSecret, redirectUris, grants }
    this.accessTokens = new Map(); // token -> { clientId, userId, scopes, expiresAt }
    this.refreshTokens = new Map(); // token -> { clientId, userId, expiresAt }
    this.authorizationCodes = new Map(); // code -> { clientId, userId, redirectUri, scopes, expiresAt }
  }

  /**
   * Register OAuth client
   */
  registerClient(clientId, clientSecret, redirectUris = [], grants = ['authorization_code', 'refresh_token']) {
    this.clients.set(clientId, {
      clientSecret: crypto.createHash('sha256').update(clientSecret).digest('hex'),
      redirectUris,
      grants,
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Generate authorization URL
   */
  getAuthorizationUrl(clientId, redirectUri, scope = '', state = '') {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Invalid client');
    }

    if (!client.redirectUris.includes(redirectUri)) {
      throw new Error('Invalid redirect URI');
    }

    const code = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.authorizationCodes.set(code, {
      clientId,
      redirectUri,
      scope,
      state,
      expiresAt
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope,
      state
    });

    return `${redirectUri.split('/')[0]}//${redirectUri.split('/').slice(2).join('/')}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  exchangeCode(code, clientId, clientSecret, redirectUri) {
    const client = this.clients.get(clientId);
    if (!client) {
      throw new Error('Invalid client');
    }

    const authCode = this.authorizationCodes.get(code);
    if (!authCode) {
      throw new Error('Invalid authorization code');
    }

    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      throw new Error('Authorization code mismatch');
    }

    if (new Date(authCode.expiresAt) < new Date()) {
      this.authorizationCodes.delete(code);
      throw new Error('Authorization code expired');
    }

    // Delete used code
    this.authorizationCodes.delete(code);

    // Generate tokens
    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();

    const tokenResult = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: refreshToken
    };

    // Store access token
    this.accessTokens.set(accessToken, {
      clientId,
      userId: authCode.scope, // In real impl, would have userId from auth
      scopes: authCode.scope.split(' '),
      expiresAt: new Date(Date.now() + 3600 * 1000)
    });

    // Store refresh token
    this.refreshTokens.set(refreshToken, {
      clientId,
      userId: authCode.scope,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) // 7 days
    });

    return tokenResult;
  }

  /**
   * Validate access token
   */
  validateToken(token) {
    const tokenData = this.accessTokens.get(token);
    if (!tokenData) {
      return { valid: false, error: 'Invalid token' };
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      this.accessTokens.delete(token);
      return { valid: false, error: 'Token expired' };
    }

    return {
      valid: true,
      clientId: tokenData.clientId,
      userId: tokenData.userId,
      scopes: tokenData.scopes
    };
  }

  /**
   * Refresh access token
   */
  refreshAccessToken(refreshToken, clientId) {
    const tokenData = this.refreshTokens.get(refreshToken);
    if (!tokenData) {
      throw new Error('Invalid refresh token');
    }

    if (tokenData.clientId !== clientId) {
      throw new Error('Client mismatch');
    }

    if (new Date(tokenData.expiresAt) < new Date()) {
      this.refreshTokens.delete(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Delete old refresh token (rotation)
    this.refreshTokens.delete(refreshToken);

    // Generate new tokens
    const accessToken = this.generateToken();
    const newRefreshToken = this.generateToken();

    this.accessTokens.set(accessToken, {
      clientId: tokenData.clientId,
      userId: tokenData.userId,
      scopes: tokenData.scopes,
      expiresAt: new Date(Date.now() + 3600 * 1000)
    });

    this.refreshTokens.set(newRefreshToken, {
      clientId: tokenData.clientId,
      userId: tokenData.userId,
      scopes: tokenData.scopes,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000)
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: newRefreshToken
    };
  }

  /**
   * Revoke token
   */
  revokeToken(token) {
    this.accessTokens.delete(token);
    this.refreshTokens.delete(token);
  }

  /**
   * Generate random token
   */
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

// ============================================
// MAIN API SECURITY SERVICE
// ============================================

class ApiSecurityService {
  constructor(options = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.apiKeyManager = new ApiKeyManager(options.apiKey);
    this.rbac = new RBACService();
    this.sanitizer = new InputSanitizer(options.sanitizer);
    this.oauth2 = new OAuth2Service(options.oauth);

    // Default rate limit config
    this.defaultRateLimit = {
      windowMs: options.rateLimit?.windowMs || 60 * 1000,
      maxRequests: options.rateLimit?.maxRequests || 100
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'ApiSecurity',
      version: '1.0.0',
      status: 'operational',
      components: {
        rateLimiter: 'operational',
        apiKeyManager: 'operational',
        rbac: 'operational',
        sanitizer: 'operational',
        oauth2: 'operational'
      }
    };
  }

  /**
   * Express middleware for rate limiting with per-IP and per-endpoint configuration
   * Supports sliding window algorithm via Redis, falls back to in-memory
   */
  rateLimitMiddleware(options = {}) {
    const config = { ...this.defaultRateLimit, ...options };

    return async (req, res, next) => {
      try {
        // Use IP + user ID if available, include endpoint for per-endpoint limiting
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        const userId = req.user?.id || '';
        const endpoint = req.path || '/';
        const method = req.method || 'GET';

        // Create composite identifier: user > IP > endpoint
        const identifier = userId ? `${userId}:${endpoint}` : `${ip}:${endpoint}`;

        // Apply endpoint-specific overrides if configured
        const endpointLimit = config.endpoints?.[endpoint];
        const methodLimit = config.methods?.[method];
        const effectiveMaxRequests = endpointLimit?.maxRequests || methodLimit?.maxRequests || config.maxRequests;
        const effectiveWindowMs = endpointLimit?.windowMs || methodLimit?.windowMs || config.windowMs;

        // Configure limiter with effective values
        const limiter = this.rateLimiter;
        limiter.maxRequests = effectiveMaxRequests;
        limiter.windowMs = effectiveWindowMs;

        const result = await limiter.isAllowed(identifier);

        // Set standard rate limit headers
        res.set({
          'X-RateLimit-Limit': effectiveMaxRequests,
          'X-RateLimit-Remaining': result.remaining,
          'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
          'X-RateLimit-Window': Math.ceil(effectiveWindowMs / 1000) + 's'
        });

        if (!result.allowed) {
          res.set('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
          return res.status(429).json({
            error: 'Too many requests',
            message: `Rate limit exceeded. Try again in ${Math.ceil((result.resetAt - Date.now()) / 1000)} seconds.`,
            retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
            limit: effectiveMaxRequests,
            windowMs: effectiveWindowMs
          });
        }

        next();
      } catch (error) {
        // On error, allow the request but log
        console.error('Rate limiter error:', error);
        next();
      }
    };
  }

  /**
   * Create rate limiter with preset configurations for different endpoint types
   */
  createTieredRateLimiter() {
    const tieredConfig = {
      // Default: 100 requests per minute
      windowMs: 60 * 1000,
      maxRequests: 100,
      endpoints: {
        // Stricter for auth endpoints (prevent brute force)
        '/api/auth/login': { maxRequests: 10, windowMs: 60 * 1000 },
        '/api/auth/register': { maxRequests: 10, windowMs: 60 * 1000 },
        '/api/auth/reset-password': { maxRequests: 5, windowMs: 60 * 1000 },
        // Standard for API endpoints
        '/api/contacts': { maxRequests: 30, windowMs: 60 * 1000 },
        '/api/subscriptions': { maxRequests: 30, windowMs: 60 * 1000 },
        '/api/employees': { maxRequests: 50, windowMs: 60 * 1000 },
        '/api/tasks': { maxRequests: 50, windowMs: 60 * 1000 },
        // Stricter for write operations
        '/api/contacts': { maxRequests: 20, windowMs: 60 * 1000, methods: { POST: 10, PUT: 10, DELETE: 5 } }
      },
      methods: {
        'POST': { maxRequests: 50, windowMs: 60 * 1000 },
        'PUT': { maxRequests: 30, windowMs: 60 * 1000 },
        'DELETE': { maxRequests: 20, windowMs: 60 * 1000 }
      }
    };

    return this.rateLimitMiddleware(tieredConfig);
  }

  /**
   * Express middleware for authentication
   */
  authMiddleware(options = {}) {
    return (req, res, next) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        if (options.required) {
          return res.status(401).json({ error: 'Authorization required' });
        }
        return next();
      }

      const [type, credentials] = authHeader.split(' ');

      try {
        if (type === 'Bearer') {
          // OAuth2 token
          const tokenResult = this.oauth2.validateToken(credentials);
          if (tokenResult.valid) {
            req.user = {
              id: tokenResult.userId,
              clientId: tokenResult.clientId,
              scopes: tokenResult.scopes
            };
          }
        } else if (type === 'ApiKey') {
          // API Key
          const keyResult = this.apiKeyManager.validateKey(credentials);
          if (keyResult.valid) {
            req.user = {
              id: keyResult.userId,
              keyId: keyResult.keyId,
              scopes: keyResult.scopes
            };
          }
        }

        if (options.required && !req.user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        next();
      } catch (error) {
        next(error);
      }
    };
  }

  /**
   * Express middleware for RBAC authorization
   */
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      try {
        this.rbac.requirePermission(req.user.id, permission);
        next();
      } catch (error) {
        res.status(403).json({ error: error.message });
      }
    };
  }

  /**
   * Express middleware for input sanitization
   */
  sanitizeMiddleware(fields = []) {
    return (req, res, next) => {
      if (req.body && typeof req.body === 'object') {
        req.body = this.sanitizer.sanitizeObject(req.body, fields);
      }
      next();
    };
  }
}

module.exports = {
  ApiSecurityService,
  RateLimiter,
  ApiKeyManager,
  RBACService,
  InputSanitizer,
  OAuth2Service,
  ROLES,
  PERMISSIONS
};
