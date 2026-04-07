/**
 * Centralized Logging Service
 * COM-105 / COM-203: 4 Log Types - Login, Access, Error, Change
 *
 * Features:
 * 1. Login logs - auth events
 * 2. Access logs - API requests
 * 3. Error logs - exceptions
 * 4. Change logs - data modifications
 * 5. Log aggregation & search
 */

const crypto = require('crypto');
const { ElasticsearchTransport } = require('./elasticsearchTransport');

// ============================================
// LOG TYPES
// ============================================

const LOG_TYPES = {
  LOGIN: 'login',       // Authentication events
  ACCESS: 'access',     // API requests
  ERROR: 'error',        // Exceptions and errors
  CHANGE: 'change'     // Data modifications
};

const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical'
};

// ============================================
// LOG ENTRY
// ============================================

class LogEntry {
  constructor(options = {}) {
    this.id = options.id || this.generateId();
    this.timestamp = options.timestamp || new Date().toISOString();
    this.type = options.type;
    this.level = options.level || LOG_LEVELS.INFO;
    this.message = options.message;
    this.userId = options.userId || null;
    this.sessionId = options.sessionId || null;
    this.ipAddress = options.ipAddress || null;
    this.userAgent = options.userAgent || null;
    this.method = options.method || null;
    this.path = options.path || null;
    this.statusCode = options.statusCode || null;
    this.duration = options.duration || null;
    this.resource = options.resource || null;
    this.resourceId = options.resourceId || null;
    this.action = options.action || null;
    this.previousValue = options.previousValue || null;
    this.newValue = options.newValue || null;
    this.error = options.error || null;
    this.stack = options.stack || null;
    this.metadata = options.metadata || {};
    this.tags = options.tags || [];
  }

  generateId() {
    return `log_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  toJSON() {
    return {
      id: this.id,
      timestamp: this.timestamp,
      type: this.type,
      level: this.level,
      message: this.message,
      userId: this.userId,
      sessionId: this.sessionId,
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      method: this.method,
      path: this.path,
      statusCode: this.statusCode,
      duration: this.duration,
      resource: this.resource,
      resourceId: this.resourceId,
      action: this.action,
      previousValue: this.previousValue,
      newValue: this.newValue,
      error: this.error,
      stack: this.stack,
      metadata: this.metadata,
      tags: this.tags
    };
  }
}

// ============================================
// LOG STORE
// ============================================

class LogStore {
  constructor(options = {}) {
    this.maxEntries = options.maxEntries || 10000;
    this.entries = [];
    this.index = new Map(); // For fast lookups
  }

  add(entry) {
    if (!(entry instanceof LogEntry)) {
      entry = new LogEntry(entry);
    }

    this.entries.push(entry);

    // Build index
    this.indexEntry(entry);

    // Trim if over max
    if (this.entries.length > this.maxEntries) {
      const removed = this.entries.shift();
      this.unindexEntry(removed);
    }

    return entry;
  }

  indexEntry(entry) {
    // Index by timestamp (for range queries)
    const dateKey = entry.timestamp.split('T')[0];
    if (!this.index.has(dateKey)) {
      this.index.set(dateKey, new Set());
    }
    this.index.get(dateKey).add(entry.id);

    // Index by type
    if (!this.index.has(`type:${entry.type}`)) {
      this.index.set(`type:${entry.type}`, new Set());
    }
    this.index.get(`type:${entry.type}`).add(entry.id);

    // Index by level
    if (!this.index.has(`level:${entry.level}`)) {
      this.index.set(`level:${entry.level}`, new Set());
    }
    this.index.get(`level:${entry.level}`).add(entry.id);

    // Index by user
    if (entry.userId) {
      if (!this.index.has(`user:${entry.userId}`)) {
        this.index.set(`user:${entry.userId}`, new Set());
      }
      this.index.get(`user:${entry.userId}`).add(entry.id);
    }
  }

  unindexEntry(entry) {
    const dateKey = entry.timestamp.split('T')[0];
    if (this.index.has(dateKey)) {
      this.index.get(dateKey).delete(entry.id);
    }
    if (this.index.has(`type:${entry.type}`)) {
      this.index.get(`type:${entry.type}`).delete(entry.id);
    }
    if (this.index.has(`level:${entry.level}`)) {
      this.index.get(`level:${entry.level}`).delete(entry.id);
    }
    if (entry.userId && this.index.has(`user:${entry.userId}`)) {
      this.index.get(`user:${entry.userId}`).delete(entry.id);
    }
  }

  query(criteria = {}) {
    let results = [...this.entries];

    if (criteria.type) {
      results = results.filter(e => e.type === criteria.type);
    }

    if (criteria.level) {
      results = results.filter(e => e.level === criteria.level);
    }

    if (criteria.userId) {
      results = results.filter(e => e.userId === criteria.userId);
    }

    if (criteria.startDate) {
      results = results.filter(e => e.timestamp >= criteria.startDate);
    }

    if (criteria.endDate) {
      results = results.filter(e => e.timestamp <= criteria.endDate);
    }

    if (criteria.search) {
      const term = criteria.search.toLowerCase();
      results = results.filter(e =>
        e.message.toLowerCase().includes(term) ||
        (e.error && e.error.toLowerCase().includes(term))
      );
    }

    if (criteria.resource) {
      results = results.filter(e => e.resource === criteria.resource);
    }

    // Sort by timestamp descending (newest first)
    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Pagination - offset first, then limit
    if (criteria.offset) {
      results = results.slice(criteria.offset);
    }

    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  getStats() {
    const stats = {
      total: this.entries.length,
      byType: {},
      byLevel: {},
      byDate: {}
    };

    for (const entry of this.entries) {
      // By type
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1;

      // By level
      stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;

      // By date
      const dateKey = entry.timestamp.split('T')[0];
      stats.byDate[dateKey] = (stats.byDate[dateKey] || 0) + 1;
    }

    return stats;
  }

  clear() {
    this.entries = [];
    this.index.clear();
  }
}

// ============================================
// LOG AGGREGATION
// ============================================

class LogAggregator {
  constructor(store) {
    this.store = store;
  }

  /**
   * Count events by time window
   */
  countByTimeWindow(windowMinutes = 60) {
    const now = Date.now();
    const windowMs = windowMinutes * 60 * 1000;
    const buckets = new Map();

    for (const entry of this.store.entries) {
      const entryTime = new Date(entry.timestamp).getTime();
      const bucketKey = Math.floor(entryTime / windowMs) * windowMs;
      buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + 1);
    }

    return Array.from(buckets.entries())
      .map(([time, count]) => ({
        timestamp: new Date(time).toISOString(),
        count
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Find error patterns
   */
  findErrorPatterns(limit = 10) {
    const errors = this.store.query({ type: LOG_TYPES.ERROR });
    const patterns = new Map();

    for (const error of errors) {
      // Use error message as pattern key
      const key = error.error || error.message;
      if (!patterns.has(key)) {
        patterns.set(key, { pattern: key, count: 0, lastSeen: null, entries: [] });
      }
      const pattern = patterns.get(key);
      pattern.count++;
      if (!pattern.lastSeen || error.timestamp > pattern.lastSeen) {
        pattern.lastSeen = error.timestamp;
      }
      if (pattern.entries.length < 3) {
        pattern.entries.push({ id: error.id, timestamp: error.timestamp });
      }
    }

    return Array.from(patterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get top users by activity
   */
  getTopUsers(limit = 10) {
    const activity = new Map();

    for (const entry of this.store.entries) {
      if (entry.userId) {
        activity.set(entry.userId, (activity.get(entry.userId) || 0) + 1);
      }
    }

    return Array.from(activity.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Detect anomalies (high error rate)
   */
  detectAnomalies(threshold = 0.1) {
    const errors = this.store.query({ type: LOG_TYPES.ERROR });
    const total = this.store.entries.length;

    if (total === 0) return { hasAnomaly: false };

    const errorRate = errors.length / total;
    const recentErrors = errors.slice(0, 10);

    return {
      hasAnomaly: errorRate > threshold,
      errorRate,
      totalEntries: total,
      totalErrors: errors.length,
      threshold,
      recentErrors
    };
  }
}

// ============================================
// MAIN LOGGING SERVICE
// ============================================

class LoggingService {
  constructor(options = {}) {
    this.store = new LogStore({
      maxEntries: options.maxEntries || 50000
    });
    this.aggregator = new LogAggregator(this.store);

    // Initialize Elasticsearch transport for shipping logs to ELK
    this.elasticsearchTransport = new ElasticsearchTransport({
      logstashHost: options.logstashHost || process.env.LOGSTASH_HOST || 'localhost',
      logstashPort: options.logstashPort || parseInt(process.env.LOGSTASH_PORT, 10) || 5044,
      enabled: options.elasticsearchEnabled !== false,
      bufferSize: options.bufferSize || 100,
      flushInterval: options.flushInterval || 5000,
      serviceName: options.serviceName || 'aiemployee-api'
    });
  }

  // ============================================
  // LOG CREATION METHODS
  // ============================================

  /**
   * Log authentication event
   */
  logLogin(options = {}) {
    const entry = new LogEntry({
      type: LOG_TYPES.LOGIN,
      level: options.success ? LOG_LEVELS.INFO : LOG_LEVELS.WARN,
      message: options.message || `Login ${options.success ? 'successful' : 'failed'}`,
      userId: options.userId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        provider: options.provider,
        method: options.method,
        reason: options.reason
      },
      tags: ['auth', options.success ? 'success' : 'failed']
    });

    const stored = this.store.add(entry);

    // Ship to Elasticsearch
    this.elasticsearchTransport.sendLogin({
      userId: options.userId,
      sessionId: options.sessionId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      success: options.success,
      provider: options.provider,
      method: options.method,
      reason: options.reason
    }).catch(err => console.error('Failed to ship login log to ELK:', err.message));

    return stored;
  }

  /**
   * Log API access
   */
  logAccess(options = {}) {
    const level = options.statusCode >= 500 ? LOG_LEVELS.ERROR :
                  options.statusCode >= 400 ? LOG_LEVELS.WARN :
                  LOG_LEVELS.INFO;

    const entry = new LogEntry({
      type: LOG_TYPES.ACCESS,
      level,
      message: options.message || `${options.method} ${options.path}`,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
      duration: options.duration,
      metadata: {
        query: options.query,
        body: options.body ? '[BODY]' : null,
        responseSize: options.responseSize
      },
      tags: ['api', `status-${options.statusCode}`]
    });

    const stored = this.store.add(entry);

    // Ship to Elasticsearch
    this.elasticsearchTransport.sendAccess({
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      method: options.method,
      path: options.path,
      statusCode: options.statusCode,
      duration: options.duration,
      query: options.query,
      body: options.body,
      responseSize: options.responseSize
    }).catch(err => console.error('Failed to ship access log to ELK:', err.message));

    return stored;
  }

  /**
   * Log error/exception
   */
  logError(options = {}) {
    const entry = new LogEntry({
      type: LOG_TYPES.ERROR,
      level: options.level || LOG_LEVELS.ERROR,
      message: options.message,
      userId: options.userId,
      sessionId: options.sessionId,
      error: options.error ? (options.error.message || options.error.toString()) : null,
      stack: options.error ? options.error.stack : null,
      resource: options.resource,
      resourceId: options.resourceId,
      metadata: options.metadata || {},
      tags: ['error', options.code ? `code-${options.code}` : 'exception']
    });

    const stored = this.store.add(entry);

    // Ship to Elasticsearch
    this.elasticsearchTransport.sendError({
      message: options.message,
      level: options.level,
      userId: options.userId,
      sessionId: options.sessionId,
      error: options.error,
      resource: options.resource,
      resourceId: options.resourceId,
      metadata: options.metadata
    }).catch(err => console.error('Failed to ship error log to ELK:', err.message));

    return stored;
  }

  /**
   * Log data change
   */
  logChange(options = {}) {
    const entry = new LogEntry({
      type: LOG_TYPES.CHANGE,
      level: LOG_LEVELS.INFO,
      message: options.message || `${options.action} on ${options.resource}`,
      userId: options.userId,
      sessionId: options.sessionId,
      resource: options.resource,
      resourceId: options.resourceId,
      action: options.action,
      previousValue: options.previousValue,
      newValue: options.newValue,
      metadata: options.metadata || {},
      tags: ['change', options.action, options.resource]
    });

    const stored = this.store.add(entry);

    // Ship to Elasticsearch
    this.elasticsearchTransport.sendChange({
      message: options.message,
      userId: options.userId,
      sessionId: options.sessionId,
      resource: options.resource,
      resourceId: options.resourceId,
      action: options.action,
      previousValue: options.previousValue,
      newValue: options.newValue,
      metadata: options.metadata
    }).catch(err => console.error('Failed to ship change log to ELK:', err.message));

    return stored;
  }

  // ============================================
  // LOG RETRIEVAL METHODS
  // ============================================

  /**
   * Search logs
   */
  search(criteria = {}) {
    return this.store.query(criteria);
  }

  /**
   * Get logs by type
   */
  getByType(type, options = {}) {
    return this.store.query({ type, ...options });
  }

  /**
   * Get login logs
   */
  getLoginLogs(options = {}) {
    return this.getByType(LOG_TYPES.LOGIN, options);
  }

  /**
   * Get access logs
   */
  getAccessLogs(options = {}) {
    return this.getByType(LOG_TYPES.ACCESS, options);
  }

  /**
   * Get error logs
   */
  getErrorLogs(options = {}) {
    return this.getByType(LOG_TYPES.ERROR, options);
  }

  /**
   * Get change logs
   */
  getChangeLogs(options = {}) {
    return this.getByType(LOG_TYPES.CHANGE, options);
  }

  // ============================================
  // AGGREGATION & ANALYTICS
  // ============================================

  /**
   * Get log statistics
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * Get aggregated metrics
   */
  getMetrics() {
    return {
      stats: this.store.getStats(),
      timeSeries: this.aggregator.countByTimeWindow(60),
      errorPatterns: this.aggregator.findErrorPatterns(),
      topUsers: this.aggregator.getTopUsers(),
      anomalies: this.aggregator.detectAnomalies()
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clear all logs
   */
  clear() {
    this.store.clear();
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Logging',
      version: '1.0.0',
      status: 'operational',
      stats: this.store.getStats(),
      elasticsearch: this.elasticsearchTransport.getStatus()
    };
  }

  /**
   * Log a security event (rate limit, failed auth, suspicious activity)
   */
  logSecurityEvent(options = {}) {
    // Also store in local log store for redundancy
    const entry = new LogEntry({
      type: 'security',
      level: options.level || LOG_LEVELS.WARN,
      message: options.message,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      metadata: {
        eventType: options.eventType,
        blocked: options.blocked,
        reason: options.reason,
        ...options.metadata
      },
      tags: ['security', options.eventType, 'security_event']
    });

    const stored = this.store.add(entry);

    // Ship to Elasticsearch
    this.elasticsearchTransport.sendSecurityEvent({
      message: options.message,
      level: options.level,
      userId: options.userId,
      ipAddress: options.ipAddress,
      userAgent: options.userAgent,
      eventType: options.eventType,
      blocked: options.blocked,
      reason: options.reason,
      metadata: options.metadata
    }).catch(err => console.error('Failed to ship security event to ELK:', err.message));

    return stored;
  }

  /**
   * Flush all pending logs to Elasticsearch
   */
  async flushToElasticsearch() {
    await this.elasticsearchTransport.flush();
  }

  /**
   * Graceful shutdown - flush logs and close connections
   */
  async shutdown() {
    await this.elasticsearchTransport.shutdown();
  }

  /**
   * Export logs
   */
  export(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.store.entries.map(e => e.toJSON()), null, 2);
    }

    if (format === 'csv') {
      const headers = ['id', 'timestamp', 'type', 'level', 'message', 'userId', 'ipAddress'];
      const rows = [headers.join(',')];

      for (const entry of this.store.entries) {
        const row = headers.map(h => {
          const val = entry[h];
          if (val === null || val === undefined) return '';
          if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
          return val;
        });
        rows.push(row.join(','));
      }

      return rows.join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }
}

// ============================================
// EXPRESS MIDDLEWARE
// ============================================

function accessLogMiddleware(loggingService, options = {}) {
  return function(req, res, next) {
    const startTime = Date.now();

    const originalEnd = res.end;

    res.end = function(...args) {
      const duration = Date.now() - startTime;

      loggingService.logAccess({
        userId: req.user && req.user.id ? req.user.id : null,
        ipAddress: req.ip || (req.connection && req.connection.remoteAddress),
        userAgent: req.get('user-agent'),
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode: res.statusCode,
        duration: duration,
        query: req.query,
        body: req.body ? '[BODY]' : null,
        responseSize: res.get('content-length')
      });

      originalEnd.apply(res, args);
    };

    next();
  };
}

module.exports = {
  LoggingService,
  LogEntry,
  LogStore,
  LogAggregator,
  accessLogMiddleware,
  ElasticsearchTransport,
  LOG_TYPES,
  LOG_LEVELS
};
