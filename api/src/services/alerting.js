/**
 * Alerting Service - COM-201
 * Multi-level alerting system with Critical, Alert, and Warning levels
 */

class AlertingService {
  constructor() {
    // In-memory alert storage
    this.alerts = [];
    this.alertIdCounter = 1;

    // Alert statistics
    this.stats = {
      total: 0,
      byLevel: { critical: 0, alert: 0, warning: 0 },
      byStatus: { active: 0, acknowledged: 0, resolved: 0 },
      lastUpdated: null
    };

    // Alert level definitions
    this.levels = {
      critical: {
        level: 'critical',
        priority: 1,
        color: '#dc3545',
        icon: 'exclamation-triangle-fill',
        description: 'System down or critical failure requiring immediate attention'
      },
      alert: {
        level: 'alert',
        priority: 2,
        color: '#fd7e14',
        icon: 'exclamation-circle-fill',
        description: 'Non-critical issue requiring attention within hours'
      },
      warning: {
        level: 'warning',
        priority: 3,
        color: '#ffc107',
        icon: 'info-fill',
        description: 'Minor issue or potential problem for monitoring'
      }
    };

    // Auto-cleanup resolved alerts older than 30 days
    this.autoCleanupDays = 30;

    // Notification callbacks (webhook URLs)
    this.webhooks = [];
  }

  /**
   * Create a new alert
   */
  createAlert({ title, message, level, source, metadata, tags }) {
    if (!title || typeof title !== 'string') {
      throw new Error('Alert title is required');
    }
    if (!message || typeof message !== 'string') {
      throw new Error('Alert message is required');
    }
    if (!this.isValidLevel(level)) {
      throw new Error(`Invalid alert level. Must be one of: ${this.getValidLevels().join(', ')}`);
    }

    const now = new Date().toISOString();
    const alert = {
      id: `ALT-${Date.now()}-${this.alertIdCounter++}`,
      title: title.trim(),
      message: message.trim(),
      level: level.toLowerCase(),
      source: source || 'system',
      status: 'active',
      metadata: metadata || {},
      tags: tags || [],
      createdAt: now,
      updatedAt: now,
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
      resolvedBy: null,
      escalationCount: 0,
      notificationsSent: []
    };

    this.alerts.push(alert);
    this.updateStats();
    this.triggerNotification(alert);

    return alert;
  }

  /**
   * Get alert by ID
   */
  getAlert(alertId) {
    return this.alerts.find(a => a.id === alertId) || null;
  }

  /**
   * Get all alerts with optional filtering
   */
  getAlerts({ level, status, source, tags, fromDate, toDate, limit = 100, offset = 0 } = {}) {
    let filtered = [...this.alerts];

    if (level) {
      filtered = filtered.filter(a => a.level === level.toLowerCase());
    }
    if (status) {
      filtered = filtered.filter(a => a.status === status.toLowerCase());
    }
    if (source) {
      filtered = filtered.filter(a => a.source === source);
    }
    if (tags && tags.length > 0) {
      filtered = filtered.filter(a => tags.every(tag => a.tags.includes(tag)));
    }
    if (fromDate) {
      filtered = filtered.filter(a => new Date(a.createdAt) >= new Date(fromDate));
    }
    if (toDate) {
      filtered = filtered.filter(a => new Date(a.createdAt) <= new Date(toDate));
    }

    // Sort by priority (critical first) then by date (newest first)
    filtered.sort((a, b) => {
      const priorityDiff = this.levels[a.level].priority - this.levels[b.level].priority;
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      alerts: paginated,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get alerts by level
   */
  getAlertsByLevel(level) {
    return this.alerts.filter(a => a.level === level.toLowerCase());
  }

  /**
   * Get active alerts (not resolved)
   */
  getActiveAlerts() {
    return this.alerts.filter(a => a.status !== 'resolved');
  }

  /**
   * Get alert statistics
   */
  getStatistics() {
    return { ...this.stats };
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId, acknowledgedBy) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    if (alert.status === 'resolved') {
      throw new Error('Cannot acknowledge a resolved alert');
    }
    if (alert.status === 'acknowledged') {
      throw new Error('Alert is already acknowledged');
    }

    alert.status = 'acknowledged';
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = acknowledgedBy || 'system';
    alert.updatedAt = new Date().toISOString();

    this.updateStats();
    return alert;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId, resolvedBy, resolutionNote) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    if (alert.status === 'resolved') {
      throw new Error('Alert is already resolved');
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date().toISOString();
    alert.resolvedBy = resolvedBy || 'system';
    alert.resolutionNote = resolutionNote;
    alert.updatedAt = new Date().toISOString();

    this.updateStats();
    return alert;
  }

  /**
   * Escalate an alert to higher level
   */
  escalateAlert(alertId) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }
    if (alert.status === 'resolved') {
      throw new Error('Cannot escalate a resolved alert');
    }

    const levelOrder = ['warning', 'alert', 'critical'];
    const currentIndex = levelOrder.indexOf(alert.level);
    if (currentIndex >= levelOrder.length - 1) {
      throw new Error('Alert is already at maximum level');
    }

    alert.level = levelOrder[currentIndex + 1];
    alert.escalationCount++;
    alert.updatedAt = new Date().toISOString();

    this.updateStats();
    this.triggerNotification(alert, 'escalation');

    return alert;
  }

  /**
   * Add comment to alert
   */
  addComment(alertId, comment, author) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (!alert.comments) {
      alert.comments = [];
    }

    alert.comments.push({
      id: `CMT-${Date.now()}`,
      text: comment,
      author: author || 'system',
      createdAt: new Date().toISOString()
    });
    alert.updatedAt = new Date().toISOString();

    return alert;
  }

  /**
   * Update alert
   */
  updateAlert(alertId, updates) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    if (updates.title) alert.title = updates.title.trim();
    if (updates.message) alert.message = updates.message.trim();
    if (updates.level && this.isValidLevel(updates.level)) {
      alert.level = updates.level.toLowerCase();
    }
    if (updates.source) alert.source = updates.source;
    if (updates.tags) alert.tags = updates.tags;
    if (updates.metadata) alert.metadata = { ...alert.metadata, ...updates.metadata };

    alert.updatedAt = new Date().toISOString();
    this.updateStats();

    return alert;
  }

  /**
   * Delete alert
   */
  deleteAlert(alertId) {
    const index = this.alerts.findIndex(a => a.id === alertId);
    if (index === -1) {
      throw new Error('Alert not found');
    }

    this.alerts.splice(index, 1);
    this.updateStats();
    return true;
  }

  /**
   * Bulk acknowledge alerts
   */
  bulkAcknowledge(alertIds, acknowledgedBy) {
    const results = [];
    for (const alertId of alertIds) {
      try {
        const alert = this.acknowledgeAlert(alertId, acknowledgedBy);
        results.push({ alertId, success: true, alert });
      } catch (error) {
        results.push({ alertId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Bulk resolve alerts
   */
  bulkResolve(alertIds, resolvedBy, resolutionNote) {
    const results = [];
    for (const alertId of alertIds) {
      try {
        const alert = this.resolveAlert(alertId, resolvedBy, resolutionNote);
        results.push({ alertId, success: true, alert });
      } catch (error) {
        results.push({ alertId, success: false, error: error.message });
      }
    }
    return results;
  }

  /**
   * Get alert history (audit trail)
   */
  getAlertHistory(alertId) {
    const alert = this.getAlert(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    const history = [];

    history.push({
      action: 'created',
      timestamp: alert.createdAt,
      details: { title: alert.title, level: alert.level, source: alert.source }
    });

    if (alert.acknowledgedAt) {
      history.push({
        action: 'acknowledged',
        timestamp: alert.acknowledgedAt,
        details: { by: alert.acknowledgedBy }
      });
    }

    if (alert.resolvedAt) {
      history.push({
        action: 'resolved',
        timestamp: alert.resolvedAt,
        details: { by: alert.resolvedBy, note: alert.resolutionNote }
      });
    }

    if (alert.escalationCount > 0) {
      history.push({
        action: 'escalated',
        timestamp: alert.updatedAt,
        details: { count: alert.escalationCount, level: alert.level }
      });
    }

    if (alert.comments) {
      for (const comment of alert.comments) {
        history.push({
          action: 'comment',
          timestamp: comment.createdAt,
          details: { author: comment.author, comment: comment.text }
        });
      }
    }

    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return history;
  }

  /**
   * Register webhook for notifications
   */
  registerWebhook(url, events = ['all']) {
    this.webhooks.push({
      id: `WH-${Date.now()}`,
      url,
      events,
      createdAt: new Date().toISOString(),
      active: true
    });
    return this.webhooks[this.webhooks.length - 1];
  }

  /**
   * Get registered webhooks
   */
  getWebhooks() {
    return this.webhooks.filter(w => w.active);
  }

  /**
   * Remove webhook
   */
  removeWebhook(webhookId) {
    const index = this.webhooks.findIndex(w => w.id === webhookId);
    if (index === -1) {
      throw new Error('Webhook not found');
    }
    this.webhooks.splice(index, 1);
    return true;
  }

  /**
   * Get alert levels
   */
  getLevels() {
    return this.levels;
  }

  /**
   * Get valid alert levels
   */
  getValidLevels() {
    return Object.keys(this.levels);
  }

  /**
   * Check if level is valid
   */
  isValidLevel(level) {
    return this.getValidLevels().includes(level?.toLowerCase());
  }

  /**
   * Update alert statistics
   */
  updateStats() {
    this.stats.total = this.alerts.length;
    this.stats.byLevel = { critical: 0, alert: 0, warning: 0 };
    this.stats.byStatus = { active: 0, acknowledged: 0, resolved: 0 };
    this.stats.lastUpdated = new Date().toISOString();

    for (const alert of this.alerts) {
      this.stats.byLevel[alert.level]++;
      this.stats.byStatus[alert.status]++;
    }
  }

  /**
   * Trigger notifications for an alert
   */
  triggerNotification(alert, type = 'new') {
    for (const webhook of this.webhooks) {
      if (webhook.events.includes('all') || webhook.events.includes(type)) {
        alert.notificationsSent.push({
          webhookId: webhook.id,
          type,
          sentAt: new Date().toISOString(),
          status: 'queued'
        });
      }
    }
    return alert.notificationsSent;
  }

  /**
   * Cleanup old resolved alerts
   */
  cleanup(olderThanDays = this.autoCleanupDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const before = this.alerts.length;
    this.alerts = this.alerts.filter(a =>
      a.status !== 'resolved' || new Date(a.resolvedAt) > cutoffDate
    );
    const after = this.alerts.length;

    this.updateStats();
    return { deleted: before - after, remaining: after };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'AlertingService',
      status: 'operational',
      version: '1.0.0',
      alertCount: this.alerts.length,
      activeAlerts: this.getActiveAlerts().length,
      webhooks: this.webhooks.filter(w => w.active).length,
      stats: this.stats,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Export alerts in various formats
   */
  exportAlerts(format = 'json', filters = {}) {
    const { alerts } = this.getAlerts(filters);

    if (format === 'csv') {
      const headers = ['id', 'title', 'message', 'level', 'status', 'source', 'createdAt', 'acknowledgedAt', 'resolvedAt'];
      const rows = alerts.map(a => [
        a.id, `"${a.title}"`, `"${a.message}"`, a.level, a.status, a.source,
        a.createdAt, a.acknowledgedAt || '', a.resolvedAt || ''
      ]);
      return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    }

    return alerts;
  }
}

module.exports = AlertingService;
