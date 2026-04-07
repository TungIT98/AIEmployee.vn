/**
 * Health Check & Heartbeat Service (COM-119)
 * System health monitoring and endpoint heartbeat
 */

const { contactOps, planOps, subscriptionOps, employeeOps, taskOps } = require('../data/store');

class HealthCheckService {
  constructor() {
    this.services = new Map();
    this.heartbeats = new Map();
    this.healthCheckInterval = 30000; // 30 seconds
    this.lastFullCheck = null;
    this.criticalThreshold = 3; // Missed heartbeats before marking unhealthy

    // Initialize default service health
    this.initializeServices();
  }

  /**
   * Initialize default services to monitor
   */
  initializeServices() {
    this.services.set('api', {
      name: 'API Server',
      status: 'healthy',
      url: '/health',
      interval: 30000,
      lastCheck: null,
      responseTime: null,
      consecutiveFailures: 0
    });

    this.services.set('database', {
      name: 'In-Memory Database',
      status: 'healthy',
      type: 'memory',
      interval: 10000,
      lastCheck: null,
      consecutiveFailures: 0
    });

    this.services.set('contacts', {
      name: 'Contacts Service',
      status: 'healthy',
      type: 'data_store',
      interval: 60000,
      lastCheck: null,
      consecutiveFailures: 0
    });

    this.services.set('subscriptions', {
      name: 'Subscriptions Service',
      status: 'healthy',
      type: 'data_store',
      interval: 60000,
      lastCheck: null,
      consecutiveFailures: 0
    });

    this.services.set('employees', {
      name: 'Employees Service',
      status: 'healthy',
      type: 'data_store',
      interval: 60000,
      lastCheck: null,
      consecutiveFailures: 0
    });

    this.services.set('tasks', {
      name: 'Tasks Service',
      status: 'healthy',
      type: 'data_store',
      interval: 60000,
      lastCheck: null,
      consecutiveFailures: 0
    });
  }

  /**
   * Register a new service to monitor
   */
  registerService(id, config) {
    this.services.set(id, {
      name: config.name || id,
      status: 'healthy',
      url: config.url || null,
      type: config.type || 'custom',
      interval: config.interval || 30000,
      lastCheck: null,
      responseTime: null,
      consecutiveFailures: 0,
      metadata: config.metadata || {}
    });
  }

  /**
   * Unregister a service
   */
  unregisterService(id) {
    return this.services.delete(id);
  }

  /**
   * Record a heartbeat for a service
   */
  recordHeartbeat(serviceId, metadata = {}) {
    const now = Date.now();
    const existing = this.heartbeats.get(serviceId);

    this.heartbeats.set(serviceId, {
      lastHeartbeat: now,
      previousHeartbeat: existing?.lastHeartbeat || now,
      interval: existing?.interval || this.healthCheckInterval,
      consecutiveMissed: 0,
      metadata
    });

    // Update service status
    const service = this.services.get(serviceId);
    if (service) {
      service.status = 'healthy';
      service.lastCheck = now;
      service.consecutiveFailures = 0;
    }

    return this.heartbeats.get(serviceId);
  }

  /**
   * Check if a service is alive (received heartbeat within threshold)
   */
  isServiceAlive(serviceId) {
    const heartbeat = this.heartbeats.get(serviceId);
    if (!heartbeat) return false;

    const now = Date.now();
    const timeSinceLastHeartbeat = now - heartbeat.lastHeartbeat;
    const threshold = heartbeat.interval * this.criticalThreshold;

    return timeSinceLastHeartbeat < threshold;
  }

  /**
   * Check all registered services
   */
  async checkAllServices() {
    const results = [];
    const now = Date.now();

    for (const [id, service] of this.services) {
      const result = await this.checkService(id);
      results.push(result);
    }

    this.lastFullCheck = now;
    return results;
  }

  /**
   * Check a specific service
   */
  async checkService(serviceId) {
    const service = this.services.get(serviceId);
    if (!service) {
      return { id: serviceId, status: 'unknown', error: 'Service not found' };
    }

    const startTime = Date.now();
    let status = 'healthy';
    let error = null;
    let details = {};

    try {
      switch (service.type) {
        case 'data_store':
          const storeCheck = this.checkDataStore(serviceId);
          status = storeCheck.status;
          details = storeCheck.details;
          break;
        case 'memory':
          status = 'healthy';
          details = { used: this.getMemoryUsage() };
          break;
        case 'custom':
        default:
          // For custom services, check heartbeat
          const isAlive = this.isServiceAlive(serviceId);
          status = isAlive ? 'healthy' : 'unhealthy';
          if (!isAlive) {
            error = 'No heartbeat received';
          }
          break;
      }

      // Update service record
      service.status = status;
      service.lastCheck = Date.now();
      service.consecutiveFailures = status === 'healthy' ? 0 : service.consecutiveFailures + 1;
      service.responseTime = Date.now() - startTime;

    } catch (err) {
      status = 'unhealthy';
      error = err.message;
      service.consecutiveFailures++;
    }

    return {
      id: serviceId,
      name: service.name,
      status,
      responseTime: service.responseTime,
      lastCheck: service.lastCheck,
      consecutiveFailures: service.consecutiveFailures,
      error,
      details
    };
  }

  /**
   * Check data store health
   */
  checkDataStore(serviceId) {
    const status = 'healthy';
    const details = {};

    try {
      switch (serviceId) {
        case 'contacts':
          details.count = contactOps.findAll().length;
          details.maxAllowed = Infinity;
          break;
        case 'subscriptions':
          details.count = subscriptionOps.findAll().length;
          details.maxAllowed = Infinity;
          break;
        case 'employees':
          details.count = employeeOps.findAll().length;
          details.maxAllowed = Infinity;
          break;
        case 'tasks':
          details.count = taskOps.findAll().length;
          details.maxAllowed = Infinity;
          break;
      }
    } catch (err) {
      return { status: 'unhealthy', details: { error: err.message } };
    }

    return { status, details };
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * Get system uptime
   */
  getUptime() {
    return process.uptime();
  }

  /**
   * Get overall system health status
   */
  getSystemHealth() {
    let healthyCount = 0;
    let unhealthyCount = 0;
    let unknownCount = 0;

    for (const [id, service] of this.services) {
      switch (service.status) {
        case 'healthy':
          healthyCount++;
          break;
        case 'unhealthy':
          unhealthyCount++;
          break;
        default:
          unknownCount++;
      }
    }

    const total = this.services.size;
    const healthPercentage = total > 0 ? (healthyCount / total * 100).toFixed(1) : 0;

    let overallStatus = 'healthy';
    if (unhealthyCount > 0) {
      overallStatus = unhealthyCount >= total / 2 ? 'critical' : 'degraded';
    }

    return {
      status: overallStatus,
      services: {
        total,
        healthy: healthyCount,
        unhealthy: unhealthyCount,
        unknown: unknownCount
      },
      healthPercentage: parseFloat(healthPercentage),
      uptime: this.getUptime(),
      memory: this.getMemoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get detailed health report
   */
  getDetailedHealth() {
    const health = this.getSystemHealth();
    const services = [];

    for (const [id, service] of this.services) {
      services.push({
        id,
        name: service.name,
        status: service.status,
        type: service.type,
        lastCheck: service.lastCheck,
        responseTime: service.responseTime,
        consecutiveFailures: service.consecutiveFailures
      });
    }

    const heartbeats = [];
    for (const [id, hb] of this.heartbeats) {
      heartbeats.push({
        serviceId: id,
        lastHeartbeat: hb.lastHeartbeat,
        interval: hb.interval,
        consecutiveMissed: hb.consecutiveMissed,
        metadata: hb.metadata
      });
    }

    return {
      ...health,
      services,
      heartbeats,
      lastFullCheck: this.lastFullCheck
    };
  }

  /**
   * Get list of unhealthy services
   */
  getUnhealthyServices() {
    const unhealthy = [];

    for (const [id, service] of this.services) {
      if (service.status !== 'healthy') {
        unhealthy.push({
          id,
          name: service.name,
          status: service.status,
          consecutiveFailures: service.consecutiveFailures,
          lastCheck: service.lastCheck
        });
      }
    }

    return unhealthy;
  }

  /**
   * Reset service health (mark as healthy)
   */
  resetServiceHealth(serviceId) {
    const service = this.services.get(serviceId);
    if (service) {
      service.status = 'healthy';
      service.consecutiveFailures = 0;
      return true;
    }
    return false;
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Health Check',
      version: '1.0.0',
      status: 'operational',
      monitoredServices: this.services.size,
      activeHeartbeats: this.heartbeats.size,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = HealthCheckService;
