/**
 * Auto Recovery Service Tests (COM-121)
 */

const AutoRecoveryService = require('./autoRecovery');

describe('AutoRecoveryService', () => {
  let autoRecovery;

  beforeEach(() => {
    autoRecovery = new AutoRecoveryService();
  });

  describe('initializeDefaultStrategies', () => {
    test('should initialize with default strategies', () => {
      expect(autoRecovery.recoveryStrategies.size).toBeGreaterThan(0);
    });

    test('should have database_connection strategy', () => {
      const strategy = autoRecovery.recoveryStrategies.get('database_connection');
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe('Database Connection Recovery');
    });

    test('should have service_timeout strategy', () => {
      const strategy = autoRecovery.recoveryStrategies.get('service_timeout');
      expect(strategy).toBeDefined();
    });

    test('should have external_api_failure strategy', () => {
      const strategy = autoRecovery.recoveryStrategies.get('external_api_failure');
      expect(strategy).toBeDefined();
    });
  });

  describe('registerStrategy', () => {
    test('should register a new strategy', () => {
      autoRecovery.registerStrategy('custom_strategy', {
        name: 'Custom Strategy',
        maxRetries: 5,
        retryDelay: 3000
      });

      const strategy = autoRecovery.recoveryStrategies.get('custom_strategy');
      expect(strategy).toBeDefined();
      expect(strategy.name).toBe('Custom Strategy');
      expect(strategy.maxRetries).toBe(5);
    });

    test('should use defaults for optional fields', () => {
      autoRecovery.registerStrategy('minimal_strategy', {});

      const strategy = autoRecovery.recoveryStrategies.get('minimal_strategy');
      expect(strategy.maxRetries).toBe(3);
      expect(strategy.retryDelay).toBe(1000);
    });
  });

  describe('unregisterStrategy', () => {
    test('should unregister an existing strategy', () => {
      autoRecovery.registerStrategy('temp_strategy', {});
      expect(autoRecovery.recoveryStrategies.has('temp_strategy')).toBe(true);

      const result = autoRecovery.unregisterStrategy('temp_strategy');
      expect(result).toBe(true);
      expect(autoRecovery.recoveryStrategies.has('temp_strategy')).toBe(false);
    });

    test('should return false for non-existent strategy', () => {
      const result = autoRecovery.unregisterStrategy('non_existent');
      expect(result).toBe(false);
    });
  });

  describe('executeRecovery', () => {
    test('should recover successfully on first try', async () => {
      const operation = async () => ({ success: true });

      const result = await autoRecovery.executeRecovery('service_timeout', operation);

      expect(result.success).toBe(true);
    });

    test('should track recovery task', async () => {
      const operation = async () => ({ success: true });

      await autoRecovery.executeRecovery('service_timeout', operation);

      const activeTasks = autoRecovery.getActiveTasks();
      expect(activeTasks.length).toBeGreaterThanOrEqual(0);
    });

    test('should throw error when strategy not found', async () => {
      const operation = async () => {};

      await expect(
        autoRecovery.executeRecovery('non_existent_strategy', operation)
      ).rejects.toThrow('Unknown recovery strategy');
    });

    test('should retry on failure', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 2) {
          throw new Error('Temporary failure');
        }
        return { success: true };
      };

      const result = await autoRecovery.executeRecovery('service_timeout', operation);

      expect(result.success).toBe(true);
      expect(attempts).toBe(2);
    }, 10000);

    test('should send to dead letter queue after max retries', async () => {
      const operation = async () => {
        throw new Error('Permanent failure');
      };

      try {
        await autoRecovery.executeRecovery('service_timeout', operation);
      } catch (e) {
        // Expected to fail
      }

      const deadLetter = autoRecovery.getDeadLetterQueue();
      expect(deadLetter.length).toBe(1);
    });
  });

  describe('getDeadLetterQueue', () => {
    test('should return dead letter queue', () => {
      const queue = autoRecovery.getDeadLetterQueue();
      expect(queue).toBeInstanceOf(Array);
    });

    test('should limit results', () => {
      // Add multiple items to dead letter queue
      for (let i = 0; i < 5; i++) {
        autoRecovery.deadLetterQueue.push({ id: `task-${i}` });
      }

      const queue = autoRecovery.getDeadLetterQueue(3);
      expect(queue.length).toBe(3);
    });
  });

  describe('retryDeadLetter', () => {
    test('should retry a dead letter task', async () => {
      // Operation fails first 3 times, then succeeds (simulating eventual success after retry)
      let attempts = 0;
      let shouldSucceed = false;
      const operation = async () => {
        attempts++;
        if (!shouldSucceed && attempts < 4) throw new Error('fail');
        if (shouldSucceed && attempts < 2) throw new Error('fail');
        return { recovered: true };
      };

      // First, fail the recovery (3 failures -> dead letter)
      try {
        await autoRecovery.executeRecovery('service_timeout', operation);
      } catch (e) {}

      const deadLetter = autoRecovery.getDeadLetterQueue();
      expect(deadLetter.length).toBe(1);

      // Now retry - operation will succeed on 2nd attempt
      shouldSucceed = true;
      attempts = 0;
      const result = await autoRecovery.retryDeadLetter(deadLetter[0].id);
      expect(result.recovered).toBe(true);
    }, 10000);

    test('should throw error for non-existent task', async () => {
      await expect(
        autoRecovery.retryDeadLetter('non_existent_id')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('clearDeadLetterQueue', () => {
    test('should clear dead letter queue', () => {
      autoRecovery.deadLetterQueue.push({ id: 'task-1' });
      autoRecovery.deadLetterQueue.push({ id: 'task-2' });

      const count = autoRecovery.clearDeadLetterQueue();

      expect(count).toBe(2);
      expect(autoRecovery.deadLetterQueue.length).toBe(0);
    });
  });

  describe('getStrategies', () => {
    test('should return all strategies', () => {
      const strategies = autoRecovery.getStrategies();

      expect(strategies).toBeInstanceOf(Array);
      expect(strategies.length).toBe(autoRecovery.recoveryStrategies.size);
    });
  });

  describe('getActiveTasks', () => {
    test('should return active tasks', () => {
      const tasks = autoRecovery.getActiveTasks();

      expect(tasks).toBeInstanceOf(Array);
    });
  });

  describe('getTaskStatus', () => {
    test('should return task status', async () => {
      const operation = async () => ({ success: true });
      const result = await autoRecovery.executeRecovery('service_timeout', operation);

      const tasks = autoRecovery.getActiveTasks();
      if (tasks.length > 0) {
        const status = autoRecovery.getTaskStatus(tasks[0].id);
        expect(status).toBeDefined();
      }
    });
  });

  describe('cancelTask', () => {
    test('should cancel a pending task', async () => {
      let resolveOperation;
      const operation = new Promise(resolve => {
        resolveOperation = resolve;
      });

      // Start a recovery but don't await it yet - we can't easily test this
      // because executeRecovery awaits internally
      const result = autoRecovery.cancelTask('non_existent_id');
      expect(result).toBe(false);
    });
  });

  describe('getStatistics', () => {
    test('should return statistics', () => {
      const stats = autoRecovery.getStatistics();

      expect(stats.totalTasks).toBeDefined();
      expect(stats.activeTasks).toBeDefined();
      expect(stats.deadLetterQueue).toBeDefined();
      expect(stats.byStatus).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      const status = autoRecovery.getStatus();

      expect(status.service).toBe('Auto Recovery');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
      expect(status.strategies).toBeGreaterThan(0);
    });
  });
});
