/**
 * Alerting Service Tests - COM-201
 */

const AlertingService = require('./alerting');

describe('AlertingService', () => {
  let alerting;

  beforeEach(() => {
    alerting = new AlertingService();
  });

  describe('createAlert', () => {
    test('should create a critical alert', () => {
      const alert = alerting.createAlert({
        title: 'Database Down',
        message: 'Primary database server is not responding',
        level: 'critical',
        source: 'monitoring'
      });

      expect(alert).toBeDefined();
      expect(alert.id).toMatch(/^ALT-/);
      expect(alert.title).toBe('Database Down');
      expect(alert.message).toBe('Primary database server is not responding');
      expect(alert.level).toBe('critical');
      expect(alert.status).toBe('active');
      expect(alert.source).toBe('monitoring');
      expect(alert.createdAt).toBeDefined();
    });

    test('should create an alert with tags', () => {
      const alert = alerting.createAlert({
        title: 'High Memory Usage',
        message: 'Memory usage above 90%',
        level: 'alert',
        tags: ['memory', 'server-1']
      });

      expect(alert.tags).toContain('memory');
      expect(alert.tags).toContain('server-1');
    });

    test('should create an alert with metadata', () => {
      const alert = alerting.createAlert({
        title: 'API Error',
        message: '500 error on /api/users',
        level: 'alert',
        metadata: { endpoint: '/api/users', statusCode: 500 }
      });

      expect(alert.metadata.endpoint).toBe('/api/users');
      expect(alert.metadata.statusCode).toBe(500);
    });

    test('should throw error for missing title', () => {
      expect(() => {
        alerting.createAlert({
          message: 'Test message',
          level: 'warning'
        });
      }).toThrow('Alert title is required');
    });

    test('should throw error for missing message', () => {
      expect(() => {
        alerting.createAlert({
          title: 'Test title',
          level: 'warning'
        });
      }).toThrow('Alert message is required');
    });

    test('should throw error for invalid level', () => {
      expect(() => {
        alerting.createAlert({
          title: 'Test',
          message: 'Test message',
          level: 'invalid'
        });
      }).toThrow('Invalid alert level');
    });

    test('should be case insensitive for level', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'CRITICAL'
      });
      expect(alert.level).toBe('critical');
    });
  });

  describe('getAlert', () => {
    test('should retrieve alert by ID', () => {
      const created = alerting.createAlert({
        title: 'Test Alert',
        message: 'Test message',
        level: 'warning'
      });

      const retrieved = alerting.getAlert(created.id);
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test Alert');
    });

    test('should return null for non-existent ID', () => {
      const alert = alerting.getAlert('ALT-non-existent');
      expect(alert).toBeNull();
    });
  });

  describe('getAlerts', () => {
    beforeEach(() => {
      alerting.createAlert({ title: 'Critical 1', message: 'Msg', level: 'critical' });
      alerting.createAlert({ title: 'Critical 2', message: 'Msg', level: 'critical' });
      alerting.createAlert({ title: 'Alert 1', message: 'Msg', level: 'alert' });
      alerting.createAlert({ title: 'Warning 1', message: 'Msg', level: 'warning' });
    });

    test('should return all alerts', () => {
      const result = alerting.getAlerts();
      expect(result.alerts.length).toBe(4);
      expect(result.total).toBe(4);
    });

    test('should filter by level', () => {
      const result = alerting.getAlerts({ level: 'critical' });
      expect(result.alerts.length).toBe(2);
      expect(result.alerts.every(a => a.level === 'critical')).toBe(true);
    });

    test('should filter by status', () => {
      const critical = alerting.getAlerts({ level: 'critical' }).alerts[0];
      alerting.acknowledgeAlert(critical.id, 'tester');

      const active = alerting.getAlerts({ status: 'active' });
      expect(active.alerts.length).toBe(3);

      const acknowledged = alerting.getAlerts({ status: 'acknowledged' });
      expect(acknowledged.alerts.length).toBe(1);
    });

    test('should filter by source', () => {
      alerting.createAlert({
        title: 'API Alert',
        message: 'Msg',
        level: 'warning',
        source: 'api'
      });

      const result = alerting.getAlerts({ source: 'api' });
      expect(result.alerts.length).toBe(1);
      expect(result.alerts[0].source).toBe('api');
    });

    test('should paginate results', () => {
      const result = alerting.getAlerts({ limit: 2, offset: 0 });
      expect(result.alerts.length).toBe(2);
      expect(result.hasMore).toBe(true);

      const next = alerting.getAlerts({ limit: 2, offset: 2 });
      expect(next.alerts.length).toBe(2);
      expect(next.hasMore).toBe(false);
    });

    test('should sort by priority (critical first)', () => {
      const result = alerting.getAlerts({ limit: 3 });
      expect(result.alerts[0].level).toBe('critical');
    });
  });

  describe('acknowledgeAlert', () => {
    test('should acknowledge an active alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      const acknowledged = alerting.acknowledgeAlert(alert.id, 'john');
      expect(acknowledged.status).toBe('acknowledged');
      expect(acknowledged.acknowledgedBy).toBe('john');
      expect(acknowledged.acknowledgedAt).toBeDefined();
    });

    test('should throw error for non-existent alert', () => {
      expect(() => {
        alerting.acknowledgeAlert('ALT-non-existent', 'john');
      }).toThrow('Alert not found');
    });

    test('should throw error for already acknowledged alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      alerting.acknowledgeAlert(alert.id, 'john');
      expect(() => {
        alerting.acknowledgeAlert(alert.id, 'jane');
      }).toThrow('Alert is already acknowledged');
    });

    test('should throw error for resolved alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      alerting.resolveAlert(alert.id, 'john');
      expect(() => {
        alerting.acknowledgeAlert(alert.id, 'john');
      }).toThrow('Cannot acknowledge a resolved alert');
    });
  });

  describe('resolveAlert', () => {
    test('should resolve an alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      const resolved = alerting.resolveAlert(alert.id, 'john', 'Fixed the issue');
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolvedBy).toBe('john');
      expect(resolved.resolvedAt).toBeDefined();
      expect(resolved.resolutionNote).toBe('Fixed the issue');
    });

    test('should throw error for non-existent alert', () => {
      expect(() => {
        alerting.resolveAlert('ALT-non-existent', 'john');
      }).toThrow('Alert not found');
    });

    test('should throw error for already resolved alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      alerting.resolveAlert(alert.id, 'john');
      expect(() => {
        alerting.resolveAlert(alert.id, 'jane');
      }).toThrow('Alert is already resolved');
    });
  });

  describe('escalateAlert', () => {
    test('should escalate warning to alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      const escalated = alerting.escalateAlert(alert.id);
      expect(escalated.level).toBe('alert');
      expect(escalated.escalationCount).toBe(1);
    });

    test('should escalate alert to critical', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'alert'
      });

      const escalated = alerting.escalateAlert(alert.id);
      expect(escalated.level).toBe('critical');
    });

    test('should throw error when already at critical', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'critical'
      });

      expect(() => {
        alerting.escalateAlert(alert.id);
      }).toThrow('Alert is already at maximum level');
    });
  });

  describe('bulk operations', () => {
    beforeEach(() => {
      for (let i = 0; i < 5; i++) {
        alerting.createAlert({ title: `Alert ${i}`, message: 'Msg', level: 'warning' });
      }
    });

    test('should bulk acknowledge alerts', () => {
      const alerts = alerting.getAlerts({ limit: 5 }).alerts;
      const ids = alerts.slice(0, 3).map(a => a.id);

      const results = alerting.bulkAcknowledge(ids, 'bulk-user');
      expect(results.filter(r => r.success).length).toBe(3);
    });

    test('should bulk resolve alerts', () => {
      const alerts = alerting.getAlerts({ limit: 5 }).alerts;
      const ids = alerts.slice(0, 3).map(a => a.id);

      const results = alerting.bulkResolve(ids, 'bulk-user', 'Bulk resolution');
      expect(results.filter(r => r.success).length).toBe(3);
    });
  });

  describe('addComment', () => {
    test('should add comment to alert', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      const updated = alerting.addComment(alert.id, 'This is a comment', 'john');
      expect(updated.comments.length).toBe(1);
      expect(updated.comments[0].text).toBe('This is a comment');
      expect(updated.comments[0].author).toBe('john');
    });
  });

  describe('getAlertHistory', () => {
    test('should return alert history', () => {
      const alert = alerting.createAlert({
        title: 'Test',
        message: 'Test message',
        level: 'warning'
      });

      alerting.addComment(alert.id, 'First comment', 'john');
      alerting.acknowledgeAlert(alert.id, 'jane');
      alerting.resolveAlert(alert.id, 'admin', 'Fixed');

      const history = alerting.getAlertHistory(alert.id);
      expect(history.length).toBeGreaterThanOrEqual(3);

      const actions = history.map(h => h.action);
      expect(actions).toContain('created');
      expect(actions).toContain('acknowledged');
      expect(actions).toContain('resolved');
      expect(actions).toContain('comment');
    });
  });

  describe('getActiveAlerts', () => {
    test('should return only active alerts', () => {
      alerting.createAlert({ title: 'Active 1', message: 'Msg', level: 'warning' });
      const alert2 = alerting.createAlert({ title: 'Active 2', message: 'Msg', level: 'warning' });
      alerting.createAlert({ title: 'Resolved', message: 'Msg', level: 'warning' });

      alerting.resolveAlert(alert2.id, 'user');

      const active = alerting.getActiveAlerts();
      expect(active.length).toBe(2);
      expect(active.every(a => a.status !== 'resolved')).toBe(true);
    });
  });

  describe('getStatistics', () => {
    test('should return correct statistics', () => {
      alerting.createAlert({ title: 'C1', message: 'Msg', level: 'critical' });
      alerting.createAlert({ title: 'C2', message: 'Msg', level: 'critical' });
      alerting.createAlert({ title: 'A1', message: 'Msg', level: 'alert' });
      alerting.createAlert({ title: 'W1', message: 'Msg', level: 'warning' });

      const alert = alerting.getAlerts({ level: 'warning' }).alerts[0];
      alerting.acknowledgeAlert(alert.id, 'user');

      const stats = alerting.getStatistics();
      expect(stats.total).toBe(4);
      expect(stats.byLevel.critical).toBe(2);
      expect(stats.byLevel.alert).toBe(1);
      expect(stats.byLevel.warning).toBe(1);
      expect(stats.byStatus.active).toBe(3);
      expect(stats.byStatus.acknowledged).toBe(1);
    });
  });

  describe('webhooks', () => {
    test('should register webhook', () => {
      const webhook = alerting.registerWebhook('https://example.com/webhook', ['critical']);
      expect(webhook.id).toMatch(/^WH-/);
      expect(webhook.url).toBe('https://example.com/webhook');
      expect(webhook.active).toBe(true);
    });

    test('should get webhooks', () => {
      alerting.registerWebhook('https://example.com/1');
      alerting.registerWebhook('https://example.com/2');

      const webhooks = alerting.getWebhooks();
      expect(webhooks.length).toBe(2);
    });

    test('should remove webhook', () => {
      const webhook = alerting.registerWebhook('https://example.com/webhook');
      alerting.removeWebhook(webhook.id);

      const webhooks = alerting.getWebhooks();
      expect(webhooks.length).toBe(0);
    });
  });

  describe('exportAlerts', () => {
    test('should export as JSON by default', () => {
      alerting.createAlert({ title: 'Test', message: 'Msg', level: 'warning' });
      const exported = alerting.exportAlerts('json');
      expect(Array.isArray(exported)).toBe(true);
    });

    test('should export as CSV', () => {
      alerting.createAlert({ title: 'Test Alert', message: 'Msg', level: 'warning' });
      const exported = alerting.exportAlerts('csv');
      expect(exported).toContain('id,title,message');
      expect(exported).toContain('Test Alert');
    });
  });

  describe('cleanup', () => {
    test('should cleanup old resolved alerts', () => {
      const alert = alerting.createAlert({ title: 'Old', message: 'Msg', level: 'warning' });
      alerting.resolveAlert(alert.id, 'user');

      const result = alerting.cleanup(0);
      expect(result.deleted).toBe(1);
      expect(alerting.getAlert(alert.id)).toBeNull();
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      const status = alerting.getStatus();
      expect(status.service).toBe('AlertingService');
      expect(status.status).toBe('operational');
      expect(status.stats).toBeDefined();
    });
  });

  describe('getLevels', () => {
    test('should return alert levels', () => {
      const levels = alerting.getLevels();
      expect(levels.critical).toBeDefined();
      expect(levels.alert).toBeDefined();
      expect(levels.warning).toBeDefined();
    });
  });
});
