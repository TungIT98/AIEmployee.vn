/**
 * Circuit Breaker Service (COM-120)
 * Prevents cascade failures by opening circuits when services are down
 */

class CircuitBreakerService {
  constructor() {
    this.circuits = new Map();
    this.defaultConfig = {
      failureThreshold: 5,       // Number of failures before opening circuit
      successThreshold: 2,      // Number of successes needed to close circuit
      timeout: 60000,           // Time in ms before trying again (half-open)
      resetTimeout: 30000,      // Time before transitioning from open to half-open
      monitoringWindow: 60000,  // Time window for counting failures
    };
  }

  /**
   * Get or create a circuit for a service
   */
  getCircuit(serviceName, config = {}) {
    if (!this.circuits.has(serviceName)) {
      this.circuits.set(serviceName, this.createCircuit(serviceName, config));
    }
    return this.circuits.get(serviceName);
  }

  /**
   * Create a new circuit
   */
  createCircuit(serviceName, config = {}) {
    const fullConfig = { ...this.defaultConfig, ...config };
    return {
      name: serviceName,
      status: 'CLOSED',  // CLOSED, OPEN, HALF_OPEN
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastStateChange: Date.now(),
      config: fullConfig,
      history: [],
      stats: {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        rejectedCalls: 0
      }
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute(serviceName, fn, config = {}) {
    const circuit = this.getCircuit(serviceName, config);

    // Check if circuit should transition
    this.updateCircuitState(circuit);

    // If circuit is open, reject the call
    if (circuit.status === 'OPEN') {
      circuit.stats.rejectedCalls++;
      throw new CircuitOpenError(`Circuit for ${serviceName} is OPEN`, serviceName, circuit.config.resetTimeout);
    }

    // Execute the function
    circuit.stats.totalCalls++;
    const startTime = Date.now();

    try {
      const result = await fn();
      this.onSuccess(circuit);
      return result;
    } catch (error) {
      this.onFailure(circuit, error);
      throw error;
    }
  }

  /**
   * Update circuit state based on time
   */
  updateCircuitState(circuit) {
    const now = Date.now();
    const timeSinceLastChange = now - circuit.lastStateChange;

    if (circuit.status === 'OPEN') {
      // Check if we should transition to HALF_OPEN
      if (timeSinceLastChange >= circuit.config.resetTimeout) {
        this.transitionTo(circuit, 'HALF_OPEN');
      }
    } else if (circuit.status === 'HALF_OPEN') {
      // In half-open, check if timeout exceeded without enough successes
      if (timeSinceLastChange >= circuit.config.timeout) {
        // Reset success count and keep open
        circuit.successCount = 0;
        this.transitionTo(circuit, 'OPEN');
      }
    }
  }

  /**
   * Record a successful call
   */
  onSuccess(circuit) {
    circuit.stats.successfulCalls++;
    circuit.successCount++;
    circuit.failureCount = 0; // Reset failure count on success

    this.addToHistory(circuit, 'SUCCESS');

    if (circuit.status === 'HALF_OPEN' && circuit.successCount >= circuit.config.successThreshold) {
      this.transitionTo(circuit, 'CLOSED');
    }
  }

  /**
   * Record a failed call
   */
  onFailure(circuit, error) {
    circuit.stats.failedCalls++;
    circuit.failureCount++;
    circuit.lastFailureTime = Date.now();

    this.addToHistory(circuit, 'FAILURE', error?.message);

    if (circuit.status === 'HALF_OPEN') {
      // Any failure in half-open goes back to open
      this.transitionTo(circuit, 'OPEN');
    } else if (circuit.status === 'CLOSED') {
      // Check if we should open the circuit
      if (circuit.failureCount >= circuit.config.failureThreshold) {
        this.transitionTo(circuit, 'OPEN');
      }
    }
  }

  /**
   * Transition circuit to a new state
   */
  transitionTo(circuit, newStatus) {
    const oldStatus = circuit.status;
    circuit.status = newStatus;
    circuit.lastStateChange = Date.now();

    // Reset counters on state change
    if (newStatus === 'CLOSED') {
      circuit.failureCount = 0;
      circuit.successCount = 0;
    } else if (newStatus === 'OPEN') {
      circuit.successCount = 0;
    } else if (newStatus === 'HALF_OPEN') {
      circuit.failureCount = 0;
      circuit.successCount = 0;
    }

    this.addToHistory(circuit, `STATE_CHANGE:${oldStatus}->${newStatus}`);
  }

  /**
   * Add event to circuit history
   */
  addToHistory(circuit, event, data = null) {
    circuit.history.push({
      event,
      data,
      timestamp: Date.now()
    });

    // Keep only last 100 events
    if (circuit.history.length > 100) {
      circuit.history = circuit.history.slice(-100);
    }
  }

  /**
   * Get circuit status
   */
  getStatus(serviceName) {
    if (!this.circuits.has(serviceName)) {
      return null;
    }
    return this.circuits.get(serviceName);
  }

  /**
   * Get all circuit statuses
   */
  getAllCircuits() {
    const circuits = [];
    for (const [name, circuit] of this.circuits) {
      circuits.push({
        name: circuit.name,
        status: circuit.status,
        failureCount: circuit.failureCount,
        successCount: circuit.successCount,
        lastFailureTime: circuit.lastFailureTime,
        lastStateChange: circuit.lastStateChange,
        stats: circuit.stats
      });
    }
    return circuits;
  }

  /**
   * Get circuit health summary
   */
  getHealthSummary() {
    let closed = 0, open = 0, halfOpen = 0;

    for (const [name, circuit] of this.circuits) {
      switch (circuit.status) {
        case 'CLOSED': closed++; break;
        case 'OPEN': open++; break;
        case 'HALF_OPEN': halfOpen++; break;
      }
    }

    return {
      total: this.circuits.size,
      closed,
      open,
      halfOpen,
      healthyPercentage: this.circuits.size > 0
        ? ((closed / this.circuits.size) * 100).toFixed(1)
        : 100
    };
  }

  /**
   * Manually reset a circuit to closed
   */
  reset(serviceName) {
    if (!this.circuits.has(serviceName)) {
      return false;
    }
    const circuit = this.circuits.get(serviceName);
    this.transitionTo(circuit, 'CLOSED');
    return true;
  }

  /**
   * Manually trip (open) a circuit
   */
  trip(serviceName) {
    if (!this.circuits.has(serviceName)) {
      return false;
    }
    const circuit = this.circuits.get(serviceName);
    this.transitionTo(circuit, 'OPEN');
    return true;
  }

  /**
   * Remove a circuit
   */
  remove(serviceName) {
    return this.circuits.delete(serviceName);
  }

  /**
   * Get circuit history
   */
  getHistory(serviceName, limit = 50) {
    if (!this.circuits.has(serviceName)) {
      return [];
    }
    const history = this.circuits.get(serviceName).history;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get service status
   */
  getServiceStatus() {
    return {
      service: 'Circuit Breaker',
      version: '1.0.0',
      status: 'operational',
      circuits: this.circuits.size,
      health: this.getHealthSummary(),
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Custom error for circuit open
 */
class CircuitOpenError extends Error {
  constructor(message, serviceName, retryAfter) {
    super(message);
    this.name = 'CircuitOpenError';
    this.serviceName = serviceName;
    this.retryAfter = retryAfter;
  }
}

module.exports = {
  CircuitBreakerService,
  CircuitOpenError
};
