/**
 * Circuit Breaker Service Tests (COM-120)
 */

const { CircuitBreakerService, CircuitOpenError } = require('./circuitBreaker');

describe('CircuitBreakerService', () => {
  let circuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerService();
  });

  describe('createCircuit', () => {
    test('should create a new circuit with default config', () => {
      const circuit = circuitBreaker.createCircuit('test-service');

      expect(circuit.name).toBe('test-service');
      expect(circuit.status).toBe('CLOSED');
      expect(circuit.failureCount).toBe(0);
      expect(circuit.successCount).toBe(0);
      expect(circuit.config.failureThreshold).toBe(5);
      expect(circuit.config.successThreshold).toBe(2);
    });

    test('should create circuit with custom config', () => {
      const circuit = circuitBreaker.createCircuit('test-service', {
        failureThreshold: 3,
        timeout: 5000
      });

      expect(circuit.config.failureThreshold).toBe(3);
      expect(circuit.config.timeout).toBe(5000);
    });
  });

  describe('getCircuit', () => {
    test('should return existing circuit', () => {
      circuitBreaker.createCircuit('existing-service');
      const circuit = circuitBreaker.getCircuit('existing-service');

      expect(circuit.name).toBe('existing-service');
    });

    test('should create new circuit if not exists', () => {
      const circuit = circuitBreaker.getCircuit('new-service');

      expect(circuit.name).toBe('new-service');
      expect(circuit.status).toBe('CLOSED');
    });
  });

  describe('execute', () => {
    test('should execute successful function', async () => {
      const result = await circuitBreaker.execute('test-service', async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    test('should track successful calls', async () => {
      await circuitBreaker.execute('test-service', async () => 'ok');
      const circuit = circuitBreaker.getCircuit('test-service');

      expect(circuit.stats.totalCalls).toBe(1);
      expect(circuit.stats.successfulCalls).toBe(1);
    });

    test('should track failed calls', async () => {
      try {
        await circuitBreaker.execute('test-service', async () => {
          throw new Error('fail');
        });
      } catch (e) {}

      const circuit = circuitBreaker.getCircuit('test-service');

      expect(circuit.stats.totalCalls).toBe(1);
      expect(circuit.stats.failedCalls).toBe(1);
    });

    test('should throw CircuitOpenError when circuit is open', async () => {
      // Set circuit to open
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.trip('test-service');

      await expect(
        circuitBreaker.execute('test-service', async () => 'ok')
      ).rejects.toThrow(CircuitOpenError);
    });

    test('should increment rejected calls when circuit is open', async () => {
      // First create the circuit, then trip it
      circuitBreaker.getCircuit('test-service');
      circuitBreaker.trip('test-service');

      try {
        await circuitBreaker.execute('test-service', async () => 'ok');
      } catch (e) {}

      const circuit = circuitBreaker.getCircuit('test-service');
      expect(circuit.stats.rejectedCalls).toBe(1);
    });
  });

  describe('onSuccess', () => {
    test('should increment success count', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.onSuccess(circuit);

      expect(circuit.successCount).toBe(1);
    });

    test('should reset failure count', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuit.failureCount = 3;
      circuitBreaker.onSuccess(circuit);

      expect(circuit.failureCount).toBe(0);
    });

    test('should transition to CLOSED from HALF_OPEN after success threshold', () => {
      const circuit = circuitBreaker.getCircuit('test-service', {
        successThreshold: 2
      });
      circuit.status = 'HALF_OPEN';

      circuitBreaker.onSuccess(circuit);
      expect(circuit.status).toBe('HALF_OPEN'); // Need 2 successes

      circuitBreaker.onSuccess(circuit);
      expect(circuit.status).toBe('CLOSED');
    });
  });

  describe('onFailure', () => {
    test('should increment failure count', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.onFailure(circuit, new Error('fail'));

      expect(circuit.failureCount).toBe(1);
      expect(circuit.lastFailureTime).not.toBeNull();
    });

    test('should transition to OPEN from CLOSED after failure threshold', () => {
      const circuit = circuitBreaker.getCircuit('test-service', {
        failureThreshold: 3
      });

      circuitBreaker.onFailure(circuit, new Error('fail'));
      circuitBreaker.onFailure(circuit, new Error('fail'));
      expect(circuit.status).toBe('CLOSED');

      circuitBreaker.onFailure(circuit, new Error('fail'));
      expect(circuit.status).toBe('OPEN');
    });

    test('should transition to OPEN from HALF_OPEN on any failure', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuit.status = 'HALF_OPEN';

      circuitBreaker.onFailure(circuit, new Error('fail'));

      expect(circuit.status).toBe('OPEN');
    });
  });

  describe('transitionTo', () => {
    test('should change circuit status', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.transitionTo(circuit, 'OPEN');

      expect(circuit.status).toBe('OPEN');
      expect(circuit.lastStateChange).toBeDefined();
    });

    test('should reset counters when transitioning to CLOSED', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuit.failureCount = 5;
      circuit.successCount = 3;

      circuitBreaker.transitionTo(circuit, 'CLOSED');

      expect(circuit.failureCount).toBe(0);
      expect(circuit.successCount).toBe(0);
    });

    test('should add state change to history', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.transitionTo(circuit, 'OPEN');

      expect(circuit.history.length).toBeGreaterThan(0);
      expect(circuit.history[circuit.history.length - 1].event).toBe('STATE_CHANGE:CLOSED->OPEN');
    });
  });

  describe('trip', () => {
    test('should open a circuit', () => {
      circuitBreaker.getCircuit('test-service');
      circuitBreaker.trip('test-service');

      const circuit = circuitBreaker.getCircuit('test-service');
      expect(circuit.status).toBe('OPEN');
    });

    test('should return false for non-existent circuit', () => {
      const result = circuitBreaker.trip('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('reset', () => {
    test('should close a circuit', () => {
      circuitBreaker.getCircuit('test-service');
      circuitBreaker.trip('test-service');
      circuitBreaker.reset('test-service');

      const circuit = circuitBreaker.getCircuit('test-service');
      expect(circuit.status).toBe('CLOSED');
    });

    test('should return false for non-existent circuit', () => {
      const result = circuitBreaker.reset('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAllCircuits', () => {
    test('should return all circuits', () => {
      circuitBreaker.getCircuit('service1');
      circuitBreaker.getCircuit('service2');

      const circuits = circuitBreaker.getAllCircuits();

      expect(circuits.length).toBe(2);
    });
  });

  describe('getHealthSummary', () => {
    test('should return health summary', () => {
      circuitBreaker.getCircuit('closed-service');
      circuitBreaker.getCircuit('open-service');
      circuitBreaker.trip('open-service');

      const summary = circuitBreaker.getHealthSummary();

      expect(summary.total).toBe(2);
      expect(summary.closed).toBe(1);
      expect(summary.open).toBe(1);
    });

    test('should calculate healthy percentage', () => {
      circuitBreaker.getCircuit('s1');
      circuitBreaker.getCircuit('s2');
      circuitBreaker.trip('s2');

      const summary = circuitBreaker.getHealthSummary();

      expect(summary.healthyPercentage).toBe('50.0');
    });
  });

  describe('getHistory', () => {
    test('should return circuit history', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      circuitBreaker.onSuccess(circuit);
      circuitBreaker.onFailure(circuit, new Error('fail'));

      const history = circuitBreaker.getHistory('test-service');

      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    test('should limit history', () => {
      const circuit = circuitBreaker.getCircuit('test-service');
      for (let i = 0; i < 10; i++) {
        circuitBreaker.onSuccess(circuit);
      }

      const history = circuitBreaker.getHistory('test-service', 5);

      expect(history.length).toBe(5);
    });

    test('should return empty for non-existent service', () => {
      const history = circuitBreaker.getHistory('non-existent');
      expect(history).toEqual([]);
    });
  });

  describe('remove', () => {
    test('should remove a circuit', () => {
      circuitBreaker.getCircuit('temp-service');
      expect(circuitBreaker.circuits.has('temp-service')).toBe(true);

      circuitBreaker.remove('temp-service');
      expect(circuitBreaker.circuits.has('temp-service')).toBe(false);
    });

    test('should return true when circuit existed', () => {
      circuitBreaker.getCircuit('temp-service');
      const result = circuitBreaker.remove('temp-service');
      expect(result).toBe(true);
    });

    test('should return false when circuit did not exist', () => {
      const result = circuitBreaker.remove('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getServiceStatus', () => {
    test('should return service status', () => {
      const status = circuitBreaker.getServiceStatus();

      expect(status.service).toBe('Circuit Breaker');
      expect(status.version).toBe('1.0.0');
      expect(status.status).toBe('operational');
      expect(status.health).toBeDefined();
    });
  });

  describe('CircuitOpenError', () => {
    test('should have correct properties', () => {
      const error = new CircuitOpenError('Circuit open', 'test-service', 5000);

      expect(error.name).toBe('CircuitOpenError');
      expect(error.message).toBe('Circuit open');
      expect(error.serviceName).toBe('test-service');
      expect(error.retryAfter).toBe(5000);
    });
  });
});
