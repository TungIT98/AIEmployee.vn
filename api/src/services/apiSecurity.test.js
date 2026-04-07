/**
 * API Security Service Tests
 * COM-104 / COM-202: OAuth 2.0, Rate Limiting, RBAC
 */

const {
  ApiSecurityService,
  RateLimiter,
  ApiKeyManager,
  RBACService,
  InputSanitizer,
  OAuth2Service,
  ROLES,
  PERMISSIONS
} = require('./apiSecurity');

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
  });

  it('should allow first requests', async () => {
    const result = await limiter.isAllowed('test');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should track request count', async () => {
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');
    const result = await limiter.isAllowed('test');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it('should block when limit exceeded', async () => {
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');
    const result = await limiter.isAllowed('test');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window expires', async () => {
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    const result = await limiter.isAllowed('test');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should track different identifiers separately', async () => {
    await limiter.isAllowed('user1');
    await limiter.isAllowed('user1');
    const result = await limiter.isAllowed('user2');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('should reset limit for identifier', async () => {
    await limiter.isAllowed('test');
    await limiter.isAllowed('test');
    await limiter.reset('test');
    const result = await limiter.isAllowed('test');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });
});

describe('ApiKeyManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ApiKeyManager({ prefix: 'test' });
  });

  it('should generate API key', () => {
    const result = manager.generateKey('user123', ['read', 'write']);

    expect(result.keyId).toMatch(/^test_[a-f0-9]+$/);
    expect(result.key).toMatch(/^test_[a-f0-9]+\.[a-f0-9]+$/);
    expect(result.userId).toBe('user123');
    expect(result.scopes).toEqual(['read', 'write']);
  });

  it('should validate valid key', () => {
    const { key } = manager.generateKey('user123', ['read']);
    const result = manager.validateKey(key);

    expect(result.valid).toBe(true);
    expect(result.userId).toBe('user123');
    expect(result.scopes).toEqual(['read']);
  });

  it('should reject invalid key format', () => {
    const result = manager.validateKey('invalid');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid key format');
  });

  it('should reject unknown key', () => {
    const result = manager.validateKey('test_abc.def');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Key not found');
  });

  it('should revoke key', () => {
    const { keyId, key } = manager.generateKey('user123');
    expect(manager.validateKey(key).valid).toBe(true);

    manager.revokeKey(keyId);
    expect(manager.validateKey(key).valid).toBe(false);
  });

  it('should list keys for user', () => {
    manager.generateKey('user1', ['read']);
    manager.generateKey('user1', ['write']);
    manager.generateKey('user2', ['read']);

    const user1Keys = manager.listKeysForUser('user1');
    expect(user1Keys.length).toBe(2);
    expect(user1Keys[0].userId).toBe('user1');
  });
});

describe('RBACService', () => {
  let rbac;

  beforeEach(() => {
    rbac = new RBACService();
  });

  it('should assign role to user', () => {
    rbac.assignRole('user1', ROLES.USER);
    expect(rbac.getUserRoles('user1')).toEqual([ROLES.USER]);
  });

  it('should assign multiple roles', () => {
    rbac.assignRole('user1', ROLES.USER);
    rbac.assignRole('user1', ROLES.ADMIN);
    expect(rbac.getUserRoles('user1')).toEqual([ROLES.USER, ROLES.ADMIN]);
  });

  it('should not assign duplicate role', () => {
    rbac.assignRole('user1', ROLES.USER);
    rbac.assignRole('user1', ROLES.USER);
    expect(rbac.getUserRoles('user1')).toEqual([ROLES.USER]);
  });

  it('should remove role from user', () => {
    rbac.assignRole('user1', ROLES.USER);
    rbac.assignRole('user1', ROLES.ADMIN);
    rbac.removeRole('user1', ROLES.ADMIN);
    expect(rbac.getUserRoles('user1')).toEqual([ROLES.USER]);
  });

  it('should check permission for user with role', () => {
    rbac.assignRole('user1', ROLES.ADMIN);
    expect(rbac.hasPermission('user1', 'users:write')).toBe(true);
    expect(rbac.hasPermission('user1', 'users:delete')).toBe(true);
  });

  it('should deny permission for user without role', () => {
    rbac.assignRole('user1', ROLES.USER);
    expect(rbac.hasPermission('user1', 'users:write')).toBe(false);
  });

  it('should throw error when requiring denied permission', () => {
    rbac.assignRole('user1', ROLES.USER);
    expect(() => rbac.requirePermission('user1', 'users:delete')).toThrow('Permission denied');
  });

  it('should get user permissions', () => {
    rbac.assignRole('user1', ROLES.USER);
    const permissions = rbac.getUserPermissions('user1');
    expect(permissions).toContain('users:read');
    expect(permissions).toContain('tasks:read');
    expect(permissions).not.toContain('users:delete');
  });
});

describe('InputSanitizer', () => {
  let sanitizer;

  beforeEach(() => {
    sanitizer = new InputSanitizer({ maxLength: 100, stripHtml: true });
  });

  it('should sanitize string by trimming and limiting length', () => {
    const input = '  hello world  ';
    const result = sanitizer.sanitizeString(input);
    expect(result).toBe('hello world');
  });

  it('should strip HTML tags', () => {
    const input = 'Hello <script>alert("xss")</script> World';
    const result = sanitizer.sanitizeString(input);
    expect(result).toBe('Hello alert(\"xss\") World');
  });

  it('should remove null bytes', () => {
    const input = 'Hello\0World';
    const result = sanitizer.sanitizeString(input);
    expect(result).toBe('HelloWorld');
  });

  it('should truncate long strings', () => {
    const input = 'a'.repeat(200);
    const result = sanitizer.sanitizeString(input);
    expect(result.length).toBe(100);
  });

  it('should sanitize object fields', () => {
    const input = { name: '<script>alert(1)</script>John', email: 'john@example.com' };
    const result = sanitizer.sanitizeObject(input, ['name']);
    expect(result.name).toBe('alert(1)John'); // HTML tags stripped
    expect(result.email).toBe('john@example.com');
  });

  it('should sanitize email', () => {
    expect(sanitizer.sanitizeEmail('  JOHN@EXAMPLE.COM  ')).toBe('john@example.com');
    expect(sanitizer.sanitizeEmail('invalid')).toBeNull();
  });

  it('should sanitize URL', () => {
    expect(sanitizer.sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
    expect(sanitizer.sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizer.sanitizeUrl('not-a-url')).toBeNull();
  });
});

describe('OAuth2Service', () => {
  let oauth;

  beforeEach(() => {
    oauth = new OAuth2Service();
    oauth.registerClient('client1', 'secret1', ['https://example.com/callback']);
  });

  it('should generate authorization URL', () => {
    const url = oauth.getAuthorizationUrl('client1', 'https://example.com/callback', 'read write', 'state123');
    expect(url).toContain('client_id=client1');
    expect(url).toContain('scope=read+write');
    expect(url).toContain('state=state123');
    expect(url).toContain('response_type=code');
  });

  it('should exchange authorization code', () => {
    const redirectUri = 'https://example.com/callback';
    // The getAuthorizationUrl stores the code internally
    oauth.getAuthorizationUrl('client1', redirectUri);

    // Get the code from internal state (simulating what callback would receive)
    const authCodeEntry = Array.from(oauth.authorizationCodes.entries())[0];
    const code = authCodeEntry[0];

    const result = oauth.exchangeCode(code, 'client1', 'secret1', redirectUri);

    expect(result.access_token).toBeDefined();
    expect(result.token_type).toBe('Bearer');
    expect(result.refresh_token).toBeDefined();
    expect(result.expires_in).toBe(3600);
  });

  it('should validate access token', () => {
    const redirectUri = 'https://example.com/callback';
    oauth.getAuthorizationUrl('client1', redirectUri);

    const authCodeEntry = Array.from(oauth.authorizationCodes.entries())[0];
    const code = authCodeEntry[0];

    const { access_token } = oauth.exchangeCode(code, 'client1', 'secret1', redirectUri);

    const result = oauth.validateToken(access_token);
    expect(result.valid).toBe(true);
  });

  it('should refresh access token', () => {
    const redirectUri = 'https://example.com/callback';
    oauth.getAuthorizationUrl('client1', redirectUri);

    const authCodeEntry = Array.from(oauth.authorizationCodes.entries())[0];
    const code = authCodeEntry[0];

    const { refresh_token } = oauth.exchangeCode(code, 'client1', 'secret1', redirectUri);

    const newTokens = oauth.refreshAccessToken(refresh_token, 'client1');
    expect(newTokens.access_token).toBeDefined();
    expect(newTokens.refresh_token).toBeDefined();
  });

  it('should revoke token', () => {
    const redirectUri = 'https://example.com/callback';
    oauth.getAuthorizationUrl('client1', redirectUri);

    const authCodeEntry = Array.from(oauth.authorizationCodes.entries())[0];
    const code = authCodeEntry[0];

    const { access_token } = oauth.exchangeCode(code, 'client1', 'secret1', redirectUri);

    oauth.revokeToken(access_token);

    const result = oauth.validateToken(access_token);
    expect(result.valid).toBe(false);
  });
});

describe('ApiSecurityService', () => {
  let service;

  beforeEach(() => {
    service = new ApiSecurityService({
      rateLimit: { windowMs: 1000, maxRequests: 3 }
    });
  });

  it('should return operational status', () => {
    const status = service.getStatus();
    expect(status.service).toBe('ApiSecurity');
    expect(status.status).toBe('operational');
    expect(status.components.rateLimiter).toBe('operational');
    expect(status.components.apiKeyManager).toBe('operational');
    expect(status.components.rbac).toBe('operational');
    expect(status.components.oauth2).toBe('operational');
  });

  it('should create rate limit middleware', () => {
    const middleware = service.rateLimitMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create auth middleware', () => {
    const middleware = service.authMiddleware();
    expect(typeof middleware).toBe('function');
  });

  it('should create sanitize middleware', () => {
    const middleware = service.sanitizeMiddleware(['name', 'email']);
    expect(typeof middleware).toBe('function');
  });

  it('should create permission middleware', () => {
    const middleware = service.requirePermission('users:read');
    expect(typeof middleware).toBe('function');
  });
});

describe('PERMISSIONS constant', () => {
  it('should have admin-only permissions', () => {
    expect(PERMISSIONS['users:delete']).toEqual([ROLES.ADMIN]);
    expect(PERMISSIONS['reports:read']).toEqual([ROLES.ADMIN]);
  });

  it('should have user+admin permissions', () => {
    expect(PERMISSIONS['users:read']).toContain(ROLES.ADMIN);
    expect(PERMISSIONS['users:read']).toContain(ROLES.USER);
  });

  it('should have guest permissions', () => {
    expect(PERMISSIONS['tasks:read']).toContain(ROLES.GUEST);
  });
});
