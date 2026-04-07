/**
 * Logging Service Tests
 * COM-105 / COM-203: 4 Log Types - Login, Access, Error, Change
 */

const {
  LoggingService,
  LogEntry,
  LogStore,
  LOG_TYPES,
  LOG_LEVELS
} = require('./logging');

describe('LogEntry', () => {
  it('should create a log entry with defaults', () => {
    const entry = new LogEntry({
      type: LOG_TYPES.LOGIN,
      message: 'Test login'
    });

    expect(entry.id).toMatch(/^log_/);
    expect(entry.timestamp).toBeDefined();
    expect(entry.type).toBe(LOG_TYPES.LOGIN);
    expect(entry.level).toBe(LOG_LEVELS.INFO);
    expect(entry.message).toBe('Test login');
  });

  it('should generate unique IDs', () => {
    const entry1 = new LogEntry({ type: LOG_TYPES.LOGIN, message: '1' });
    const entry2 = new LogEntry({ type: LOG_TYPES.LOGIN, message: '2' });
    expect(entry1.id).not.toBe(entry2.id);
  });

  it('should serialize to JSON correctly', () => {
    const entry = new LogEntry({
      type: LOG_TYPES.ERROR,
      level: LOG_LEVELS.ERROR,
      message: 'Test error',
      userId: 'user123',
      error: 'Something went wrong'
    });

    const json = entry.toJSON();
    expect(json.type).toBe(LOG_TYPES.ERROR);
    expect(json.level).toBe(LOG_LEVELS.ERROR);
    expect(json.userId).toBe('user123');
    expect(json.error).toBe('Something went wrong');
  });
});

describe('LogStore', () => {
  let store;

  beforeEach(() => {
    store = new LogStore({ maxEntries: 100 });
  });

  it('should add entries', () => {
    const entry = store.add(new LogEntry({
      type: LOG_TYPES.LOGIN,
      message: 'Test'
    }));

    expect(store.entries.length).toBe(1);
    expect(entry.id).toBeDefined();
  });

  it('should auto-create LogEntry from object', () => {
    store.add({
      type: LOG_TYPES.LOGIN,
      message: 'Test'
    });

    expect(store.entries.length).toBe(1);
  });

  it('should enforce max entries', () => {
    store.maxEntries = 5;

    for (let i = 0; i < 10; i++) {
      store.add({ type: LOG_TYPES.LOGIN, message: `Log ${i}` });
    }

    expect(store.entries.length).toBe(5);
  });

  it('should query by type', () => {
    store.add({ type: LOG_TYPES.LOGIN, message: 'Login 1' });
    store.add({ type: LOG_TYPES.LOGIN, message: 'Login 2' });
    store.add({ type: LOG_TYPES.ERROR, message: 'Error 1' });

    const results = store.query({ type: LOG_TYPES.LOGIN });
    expect(results.length).toBe(2);
  });

  it('should query by level', () => {
    store.add({ type: LOG_TYPES.ERROR, level: LOG_LEVELS.ERROR, message: 'Error' });
    store.add({ type: LOG_TYPES.ERROR, level: LOG_LEVELS.WARN, message: 'Warn' });

    const results = store.query({ level: LOG_LEVELS.ERROR });
    expect(results.length).toBe(1);
  });

  it('should query by userId', () => {
    store.add({ type: LOG_TYPES.LOGIN, userId: 'user1', message: 'User1' });
    store.add({ type: LOG_TYPES.LOGIN, userId: 'user2', message: 'User2' });
    store.add({ type: LOG_TYPES.LOGIN, userId: 'user1', message: 'User1 again' });

    const results = store.query({ userId: 'user1' });
    expect(results.length).toBe(2);
  });

  it('should query by date range', () => {
    store.add({ type: LOG_TYPES.LOGIN, message: 'Old', timestamp: '2024-01-01T00:00:00Z' });
    store.add({ type: LOG_TYPES.LOGIN, message: 'New', timestamp: '2024-01-02T00:00:00Z' });

    const results = store.query({
      startDate: '2024-01-01T12:00:00Z',
      endDate: '2024-01-03T00:00:00Z'
    });

    expect(results.length).toBe(1);
    expect(results[0].message).toBe('New');
  });

  it('should search in message and error', () => {
    store.add({ type: LOG_TYPES.ERROR, message: 'Database error', error: 'Connection failed' });
    store.add({ type: LOG_TYPES.ERROR, message: 'Auth error', error: 'Invalid token' });
    store.add({ type: LOG_TYPES.LOGIN, message: 'User logged in' });

    const results = store.query({ search: 'error' });
    expect(results.length).toBe(2);
  });

  it('should paginate results', () => {
    // Add entries with explicit timestamps to ensure correct ordering
    const baseTime = Date.now();
    for (let i = 0; i < 20; i++) {
      store.add({
        type: LOG_TYPES.LOGIN,
        message: `Log ${i}`,
        timestamp: new Date(baseTime + i * 1000).toISOString()
      });
    }

    const page1 = store.query({ limit: 5, offset: 0 });
    const page2 = store.query({ limit: 5, offset: 5 });

    expect(page1.length).toBe(5);
    expect(page2.length).toBe(5);
    expect(page1[0].message).toBe('Log 19'); // Newest first
    expect(page2[0].message).toBe('Log 14');
  });

  it('should get stats', () => {
    store.add({ type: LOG_TYPES.LOGIN, level: LOG_LEVELS.INFO, message: 'Login 1' });
    store.add({ type: LOG_TYPES.LOGIN, level: LOG_LEVELS.INFO, message: 'Login 2' });
    store.add({ type: LOG_TYPES.ERROR, level: LOG_LEVELS.ERROR, message: 'Error 1' });

    const stats = store.getStats();

    expect(stats.total).toBe(3);
    expect(stats.byType[LOG_TYPES.LOGIN]).toBe(2);
    expect(stats.byType[LOG_TYPES.ERROR]).toBe(1);
    expect(stats.byLevel[LOG_LEVELS.INFO]).toBe(2);
    expect(stats.byLevel[LOG_LEVELS.ERROR]).toBe(1);
  });

  it('should clear all entries', () => {
    store.add({ type: LOG_TYPES.LOGIN, message: 'Test' });
    store.clear();
    expect(store.entries.length).toBe(0);
  });
});

describe('LoggingService', () => {
  let service;

  beforeEach(() => {
    service = new LoggingService({ maxEntries: 100 });
  });

  describe('logLogin', () => {
    it('should log successful login', () => {
      const entry = service.logLogin({
        userId: 'user123',
        sessionId: 'sess_abc',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        success: true,
        provider: 'password'
      });

      expect(entry.type).toBe(LOG_TYPES.LOGIN);
      expect(entry.level).toBe(LOG_LEVELS.INFO);
      expect(entry.userId).toBe('user123');
      expect(entry.tags).toContain('success');
    });

    it('should log failed login with WARN level', () => {
      const entry = service.logLogin({
        userId: 'user123',
        success: false,
        reason: 'Invalid password'
      });

      expect(entry.type).toBe(LOG_TYPES.LOGIN);
      expect(entry.level).toBe(LOG_LEVELS.WARN);
      expect(entry.tags).toContain('failed');
    });
  });

  describe('logAccess', () => {
    it('should log API access', () => {
      const entry = service.logAccess({
        userId: 'user123',
        method: 'POST',
        path: '/api/contacts',
        statusCode: 201,
        duration: 150
      });

      expect(entry.type).toBe(LOG_TYPES.ACCESS);
      expect(entry.method).toBe('POST');
      expect(entry.path).toBe('/api/contacts');
      expect(entry.statusCode).toBe(201);
      expect(entry.duration).toBe(150);
    });

    it('should set ERROR level for 5xx status', () => {
      const entry = service.logAccess({
        statusCode: 500
      });

      expect(entry.level).toBe(LOG_LEVELS.ERROR);
    });

    it('should set WARN level for 4xx status', () => {
      const entry = service.logAccess({
        statusCode: 404
      });

      expect(entry.level).toBe(LOG_LEVELS.WARN);
    });
  });

  describe('logError', () => {
    it('should log error with stack trace', () => {
      const error = new Error('Something went wrong');

      const entry = service.logError({
        message: 'Operation failed',
        error,
        resource: 'UserService',
        resourceId: 'user123'
      });

      expect(entry.type).toBe(LOG_TYPES.ERROR);
      expect(entry.level).toBe(LOG_LEVELS.ERROR);
      expect(entry.error).toBe('Something went wrong');
      expect(entry.stack).toBeDefined();
      expect(entry.resource).toBe('UserService');
    });
  });

  describe('logChange', () => {
    it('should log data change', () => {
      const entry = service.logChange({
        userId: 'admin1',
        resource: 'employee',
        resourceId: 'emp_001',
        action: 'update',
        previousValue: { name: 'Old Name' },
        newValue: { name: 'New Name' }
      });

      expect(entry.type).toBe(LOG_TYPES.CHANGE);
      expect(entry.level).toBe(LOG_LEVELS.INFO);
      expect(entry.resource).toBe('employee');
      expect(entry.action).toBe('update');
      expect(entry.previousValue).toEqual({ name: 'Old Name' });
      expect(entry.newValue).toEqual({ name: 'New Name' });
    });
  });

  describe('search and retrieval', () => {
    beforeEach(() => {
      service.logLogin({ userId: 'user1', success: true });
      service.logLogin({ userId: 'user2', success: false });
      service.logError({ message: 'Test error', userId: 'user1' });
      service.logAccess({ method: 'GET', path: '/api/test', statusCode: 200 });
    });

    it('should get login logs', () => {
      const logs = service.getLoginLogs();
      expect(logs.length).toBe(2);
    });

    it('should get error logs', () => {
      const logs = service.getErrorLogs();
      expect(logs.length).toBe(1);
    });

    it('should get access logs', () => {
      const logs = service.getAccessLogs();
      expect(logs.length).toBe(1);
    });

    it('should search logs', () => {
      const results = service.search({ userId: 'user1' });
      expect(results.length).toBe(2);
    });
  });

  describe('stats and metrics', () => {
    beforeEach(() => {
      service.clear(); // Clear from previous tests
      service.logLogin({ userId: 'user1', success: true });
      service.logLogin({ userId: 'user1', success: true });
      service.logLogin({ userId: 'user2', success: false });
      service.logError({ message: 'Error 1' });
      service.logError({ message: 'Error 2' });
      service.logAccess({ path: '/api/test' });
    });

    it('should get stats', () => {
      const stats = service.getStats();

      expect(stats.total).toBe(6);
      expect(stats.byType[LOG_TYPES.LOGIN]).toBe(3);
      expect(stats.byType[LOG_TYPES.ERROR]).toBe(2);
      expect(stats.byType[LOG_TYPES.ACCESS]).toBe(1);
    });

    it('should get metrics with analytics', () => {
      const metrics = service.getMetrics();

      expect(metrics.stats).toBeDefined();
      expect(metrics.errorPatterns).toBeDefined();
      expect(metrics.topUsers).toBeDefined();
      expect(metrics.anomalies).toBeDefined();
    });

    it('should detect error rate anomaly', () => {
      // Add many errors to trigger anomaly
      for (let i = 0; i < 20; i++) {
        service.logError({ message: `Error ${i}` });
      }

      const metrics = service.getMetrics();
      expect(metrics.anomalies.hasAnomaly).toBe(true);
      expect(metrics.anomalies.errorRate).toBeGreaterThan(0.1);
    });
  });

  describe('export', () => {
    beforeEach(() => {
      service.logLogin({ userId: 'user1', success: true });
    });

    it('should export as JSON', () => {
      const json = service.export('json');
      expect(json).toContain('login');
      expect(json).toContain('user1');
    });

    it('should export as CSV', () => {
      const csv = service.export('csv');
      expect(csv).toContain('id,timestamp,type,level,message');
      expect(csv).toContain('login');
    });

    it('should throw for unsupported format', () => {
      expect(() => service.export('xml')).toThrow('Unsupported export format');
    });
  });

  describe('getStatus', () => {
    it('should return operational status', () => {
      const status = service.getStatus();

      expect(status.service).toBe('Logging');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
      expect(status.stats).toBeDefined();
    });
  });
});

describe('LOG_TYPES and LOG_LEVELS', () => {
  it('should have all required log types', () => {
    expect(LOG_TYPES.LOGIN).toBe('login');
    expect(LOG_TYPES.ACCESS).toBe('access');
    expect(LOG_TYPES.ERROR).toBe('error');
    expect(LOG_TYPES.CHANGE).toBe('change');
  });

  it('should have all required log levels', () => {
    expect(LOG_LEVELS.DEBUG).toBe('debug');
    expect(LOG_LEVELS.INFO).toBe('info');
    expect(LOG_LEVELS.WARN).toBe('warn');
    expect(LOG_LEVELS.ERROR).toBe('error');
    expect(LOG_LEVELS.CRITICAL).toBe('critical');
  });
});
