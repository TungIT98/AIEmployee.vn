/**
 * Health Check Service Tests (COM-119)
 */

const HealthCheckService = require('./healthCheck');
const { resetStore, contactOps, subscriptionOps, employeeOps, taskOps } = require('../data/store');

describe('HealthCheckService', () => {
  let healthCheck;

  beforeEach(() => {
    resetStore();
    healthCheck = new HealthCheckService();
  });

  describe('initializeServices', () => {
    test('should initialize with default services', () => {
      expect(healthCheck.services.size).toBeGreaterThan(0);
      expect(healthCheck.services.has('api')).toBe(true);
      expect(healthCheck.services.has('database')).toBe(true);
      expect(healthCheck.services.has('contacts')).toBe(true);
    });

    test('should set default service properties', () => {
      const apiService = healthCheck.services.get('api');
      expect(apiService.name).toBe('API Server');
      expect(apiService.status).toBe('healthy');
      expect(apiService.interval).toBe(30000);
    });
  });

  describe('registerService', () => {
    test('should register a new service', () => {
      healthCheck.registerService('test-service', {
        name: 'Test Service',
        url: '/test',
        interval: 5000
      });

      expect(healthCheck.services.has('test-service')).toBe(true);
      const service = healthCheck.services.get('test-service');
      expect(service.name).toBe('Test Service');
      expect(service.interval).toBe(5000);
    });

    test('should use defaults for optional properties', () => {
      healthCheck.registerService('minimal-service', {});

      const service = healthCheck.services.get('minimal-service');
      expect(service.name).toBe('minimal-service');
      expect(service.type).toBe('custom');
      expect(service.interval).toBe(30000);
    });
  });

  describe('unregisterService', () => {
    test('should unregister an existing service', () => {
      healthCheck.registerService('temp-service', { name: 'Temp' });
      expect(healthCheck.services.has('temp-service')).toBe(true);

      const result = healthCheck.unregisterService('temp-service');
      expect(result).toBe(true);
      expect(healthCheck.services.has('temp-service')).toBe(false);
    });

    test('should return false for non-existent service', () => {
      const result = healthCheck.unregisterService('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('recordHeartbeat', () => {
    test('should record heartbeat for a service', () => {
      const heartbeat = healthCheck.recordHeartbeat('api');

      expect(heartbeat).toBeDefined();
      expect(heartbeat.lastHeartbeat).toBeDefined();
      expect(heartbeat.consecutiveMissed).toBe(0);
    });

    test('should include metadata', () => {
      const metadata = { version: '1.0', pid: 1234 };
      const heartbeat = healthCheck.recordHeartbeat('api', metadata);

      expect(heartbeat.metadata).toEqual(metadata);
    });

    test('should update service status to healthy', () => {
      const service = healthCheck.services.get('api');
      service.status = 'unhealthy';

      healthCheck.recordHeartbeat('api');

      expect(service.status).toBe('healthy');
      expect(service.consecutiveFailures).toBe(0);
    });
  });

  describe('isServiceAlive', () => {
    test('should return true when heartbeat is recent', () => {
      healthCheck.recordHeartbeat('api');

      expect(healthCheck.isServiceAlive('api')).toBe(true);
    });

    test('should return false when no heartbeat exists', () => {
      expect(healthCheck.isServiceAlive('non-existent')).toBe(false);
    });
  });

  describe('checkDataStore', () => {
    test('should return healthy status for contacts', () => {
      resetStore(); // Extra cleanup
      const result = healthCheck.checkDataStore('contacts');

      expect(result.status).toBe('healthy');
      expect(result.details.count).toBeDefined();
    });

    test('should return healthy status for subscriptions', () => {
      resetStore(); // Extra cleanup
      const result = healthCheck.checkDataStore('subscriptions');

      expect(result.status).toBe('healthy');
      expect(result.details.count).toBeDefined();
    });

    test('should return healthy status for employees', () => {
      resetStore(); // Extra cleanup
      const result = healthCheck.checkDataStore('employees');

      expect(result.status).toBe('healthy');
      expect(result.details.count).toBeDefined();
    });

    test('should return healthy status for tasks', () => {
      resetStore(); // Extra cleanup
      const result = healthCheck.checkDataStore('tasks');

      expect(result.status).toBe('healthy');
      expect(result.details.count).toBeDefined();
    });
  });

  describe('getMemoryUsage', () => {
    test('should return memory usage metrics', () => {
      const usage = healthCheck.getMemoryUsage();

      expect(usage.heapUsed).toBeDefined();
      expect(usage.heapTotal).toBeDefined();
      expect(usage.rss).toBeDefined();
    });

    test('should return values in MB', () => {
      const usage = healthCheck.getMemoryUsage();

      expect(typeof usage.heapUsed).toBe('number');
      expect(usage.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('getUptime', () => {
    test('should return uptime in seconds', () => {
      const uptime = healthCheck.getUptime();

      expect(typeof uptime).toBe('number');
      expect(uptime).toBeGreaterThan(0);
    });
  });

  describe('getSystemHealth', () => {
    test('should return overall health status', () => {
      const health = healthCheck.getSystemHealth();

      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'critical']).toContain(health.status);
      expect(health.services).toBeDefined();
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memory).toBeDefined();
      expect(health.timestamp).toBeDefined();
    });

    test('should count services correctly', () => {
      const health = healthCheck.getSystemHealth();

      expect(health.services.total).toBe(healthCheck.services.size);
      expect(health.healthPercentage).toBeGreaterThan(0);
    });

    test('should be healthy when all services are healthy', () => {
      const health = healthCheck.getSystemHealth();

      expect(health.status).toBe('healthy');
      expect(health.services.healthy).toBe(health.services.total);
      expect(health.services.unhealthy).toBe(0);
    });
  });

  describe('getDetailedHealth', () => {
    test('should return detailed health report', () => {
      const report = healthCheck.getDetailedHealth();

      expect(report.status).toBeDefined();
      expect(report.services).toBeInstanceOf(Array);
      expect(report.heartbeats).toBeInstanceOf(Array);
    });

    test('should include service details', () => {
      const report = healthCheck.getDetailedHealth();

      expect(report.services.length).toBeGreaterThan(0);
      const apiService = report.services.find(s => s.id === 'api');
      expect(apiService).toBeDefined();
      expect(apiService.name).toBe('API Server');
    });
  });

  describe('getUnhealthyServices', () => {
    test('should return empty array when all healthy', () => {
      const unhealthy = healthCheck.getUnhealthyServices();

      expect(unhealthy).toBeInstanceOf(Array);
      expect(unhealthy.length).toBe(0);
    });

    test('should return unhealthy services', () => {
      // Mark a service as unhealthy
      const service = healthCheck.services.get('api');
      service.status = 'unhealthy';
      service.consecutiveFailures = 3;

      const unhealthy = healthCheck.getUnhealthyServices();

      expect(unhealthy.length).toBe(1);
      expect(unhealthy[0].id).toBe('api');
    });
  });

  describe('resetServiceHealth', () => {
    test('should reset service health to healthy', () => {
      const service = healthCheck.services.get('api');
      service.status = 'unhealthy';
      service.consecutiveFailures = 5;

      const result = healthCheck.resetServiceHealth('api');

      expect(result).toBe(true);
      expect(service.status).toBe('healthy');
      expect(service.consecutiveFailures).toBe(0);
    });

    test('should return false for non-existent service', () => {
      const result = healthCheck.resetServiceHealth('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('checkAllServices', () => {
    test('should check all registered services', async () => {
      const results = await healthCheck.checkAllServices();

      expect(results.length).toBe(healthCheck.services.size);
      results.forEach(result => {
        expect(result.id).toBeDefined();
        expect(result.status).toBeDefined();
      });
    });
  });

  describe('checkService', () => {
    test('should return unknown for non-existent service', async () => {
      const result = await healthCheck.checkService('non-existent');

      expect(result.status).toBe('unknown');
      expect(result.error).toBe('Service not found');
    });

    test('should return healthy for data store service', async () => {
      const result = await healthCheck.checkService('contacts');

      expect(result.status).toBe('healthy');
      expect(result.details).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      const status = healthCheck.getStatus();

      expect(status.service).toBe('Health Check');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
      expect(status.monitoredServices).toBe(healthCheck.services.size);
      expect(status.activeHeartbeats).toBe(0);
    });
  });
});
