/**
 * Elasticsearch Transport for Logging Service
 * Ships structured JSON logs to Logstash/Elasticsearch
 */

const http = require('http');
const https = require('https');

const LOG_TYPES = {
  LOGIN: 'login',
  ACCESS: 'access',
  ERROR: 'error',
  CHANGE: 'change'
};

class ElasticsearchTransport {
  constructor(options = {}) {
    this.logstashHost = options.logstashHost || process.env.LOGSTASH_HOST || 'localhost';
    this.logstashPort = options.logstashPort || process.env.LOGSTASH_PORT || 5044;
    this.logstashPath = options.logstashPath || '';
    this.enabled = options.enabled !== false;
    this.bufferSize = options.bufferSize || 100;
    this.flushInterval = options.flushInterval || 5000;
    this.buffer = [];
    this.flushTimer = null;
    this.useHttps = options.useHttps || false;
    this.serviceName = options.serviceName || 'aiemployee-api';

    if (this.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Send log entry to Logstash via HTTP
   */
  async send(logEntry) {
    if (!this.enabled) {
      return;
    }

    const entry = this.ensureLogEntry(logEntry);

    // Add service metadata
    entry.metadata = entry.metadata || {};
    entry.metadata.service = this.serviceName;
    entry.metadata.serviceVersion = '1.0.0';
    entry.metadata.environment = process.env.NODE_ENV || 'development';

    this.buffer.push(entry);

    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Send login/auth event
   */
  async sendLogin(options = {}) {
    const entry = {
      type: LOG_TYPES.LOGIN,
      level: options.success ? 'info' : 'warn',
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
      tags: ['auth', options.success ? 'success' : 'failed', 'security']
    };

    return this.send(entry);
  }

  /**
   * Send access log
   */
  async sendAccess(options = {}) {
    const level = options.statusCode >= 500 ? 'error' :
                  options.statusCode >= 400 ? 'warn' : 'info';

    const entry = {
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
      tags: ['api', `status-${options.statusCode}`, 'access']
    };

    return this.send(entry);
  }

  /**
   * Send error log
   */
  async sendError(options = {}) {
    const entry = {
      type: LOG_TYPES.ERROR,
      level: options.level || 'error',
      message: options.message,
      userId: options.userId,
      sessionId: options.sessionId,
      error: options.error ? (options.error.message || options.error.toString()) : null,
      stack: options.error ? options.error.stack : null,
      resource: options.resource,
      resourceId: options.resourceId,
      metadata: options.metadata || {},
      tags: ['error', options.code ? `code-${options.code}` : 'exception', 'api']
    };

    return this.send(entry);
  }

  /**
   * Send change log
   */
  async sendChange(options = {}) {
    const entry = {
      type: LOG_TYPES.CHANGE,
      level: 'info',
      message: options.message || `${options.action} on ${options.resource}`,
      userId: options.userId,
      sessionId: options.sessionId,
      resource: options.resource,
      resourceId: options.resourceId,
      action: options.action,
      previousValue: options.previousValue,
      newValue: options.newValue,
      metadata: options.metadata || {},
      tags: ['change', options.action, options.resource, 'data']
    };

    return this.send(entry);
  }

  /**
   * Send security event (rate limit, failed auth, etc.)
   */
  async sendSecurityEvent(options = {}) {
    const entry = {
      type: 'security',
      level: options.level || 'warn',
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
    };

    return this.send(entry);
  }

  /**
   * Flush buffer to Logstash
   */
  async flush() {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    const payload = entries.map(entry => ({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      '@timestamp': entry.timestamp || new Date().toISOString()
    }));

    try {
      await this.httpRequest(payload);
    } catch (error) {
      // Re-add entries to buffer on failure (simple retry)
      console.error('Failed to send logs to Logstash:', error.message);
      this.buffer = [...entries, ...this.buffer];
    }
  }

  /**
   * Make HTTP request to Logstash
   */
  httpRequest(data) {
    return new Promise((resolve, reject) => {
      const dataString = JSON.stringify(data);
      const transport = this.useHttps ? https : http;

      const options = {
        hostname: this.logstashHost,
        port: this.logstashPort,
        path: this.logstashPath,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(dataString)
        },
        timeout: 5000
      };

      const req = transport.request(options, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, sent: data.length });
        } else {
          reject(new Error(`Logstash responded with status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Logstash request timeout'));
      });

      req.write(dataString);
      req.end();
    });
  }

  /**
   * Start periodic flush timer
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(async () => {
      try {
        await this.flush();
      } catch (error) {
        console.error('Periodic flush failed:', error.message);
      }
    }, this.flushInterval);
  }

  /**
   * Stop transport and flush remaining logs
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    await this.flush();
  }

  /**
   * Ensure log entry has required fields
   */
  ensureLogEntry(entry) {
    const now = new Date().toISOString();

    if (typeof entry.toJSON === 'function') {
      const obj = entry.toJSON();
      obj.timestamp = obj.timestamp || now;
      return obj;
    }

    return {
      id: entry.id || `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: entry.timestamp || now,
      type: entry.type,
      level: entry.level || 'info',
      message: entry.message,
      userId: entry.userId || null,
      sessionId: entry.sessionId || null,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      method: entry.method || null,
      path: entry.path || null,
      statusCode: entry.statusCode || null,
      duration: entry.duration || null,
      resource: entry.resource || null,
      resourceId: entry.resourceId || null,
      action: entry.action || null,
      error: entry.error || null,
      stack: entry.stack || null,
      metadata: entry.metadata || {},
      tags: entry.tags || [],
      ...entry
    };
  }

  /**
   * Get transport status
   */
  getStatus() {
    return {
      service: 'ElasticsearchTransport',
      enabled: this.enabled,
      logstashHost: this.logstashHost,
      logstashPort: this.logstashPort,
      bufferSize: this.buffer.length,
      flushInterval: this.flushInterval
    };
  }
}

module.exports = {
  ElasticsearchTransport,
  LOG_TYPES
};
