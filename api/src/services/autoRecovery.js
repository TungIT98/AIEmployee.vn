/**
 * Auto-Recovery & Restart Service (COM-121)
 * Self-healing triggers, retry logic, and dead letter handling
 */

const { CircuitBreakerService } = require('./circuitBreaker');

class AutoRecoveryService {
  constructor() {
    this.recoveryStrategies = new Map();
    this.recoveryTasks = new Map();
    this.deadLetterQueue = [];
    this.maxRetries = 3;
    this.defaultRetryDelay = 1000; // 1 second
    this.circuitBreaker = new CircuitBreakerService();

    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default recovery strategies
   */
  initializeDefaultStrategies() {
    // Database connection failure
    this.registerStrategy('database_connection', {
      name: 'Database Connection Recovery',
      maxRetries: 5,
      retryDelay: 2000,
      backoffMultiplier: 2,
      strategies: ['restart_connection', 'failover', 'alert']
    });

    // Service timeout
    this.registerStrategy('service_timeout', {
      name: 'Service Timeout Recovery',
      maxRetries: 3,
      retryDelay: 1000,
      backoffMultiplier: 1.5,
      strategies: ['retry', 'circuit_breaker', 'alert']
    });

    // External API failure
    this.registerStrategy('external_api_failure', {
      name: 'External API Failure Recovery',
      maxRetries: 3,
      retryDelay: 5000,
      backoffMultiplier: 2,
      strategies: ['retry_with_backoff', 'circuit_breaker', 'degrade', 'alert']
    });

    // Memory exhaustion
    this.registerStrategy('memory_exhaustion', {
      name: 'Memory Exhaustion Recovery',
      maxRetries: 2,
      retryDelay: 1000,
      backoffMultiplier: 1,
      strategies: ['gc_collect', 'restart_service', 'scale_out', 'alert']
    });

    // Process crash
    this.registerStrategy('process_crash', {
      name: 'Process Crash Recovery',
      maxRetries: 5,
      retryDelay: 500,
      backoffMultiplier: 1,
      strategies: ['restart_process', 'notify', 'escalate']
    });
  }

  /**
   * Register a recovery strategy
   */
  registerStrategy(strategyId, config) {
    this.recoveryStrategies.set(strategyId, {
      id: strategyId,
      name: config.name || strategyId,
      maxRetries: config.maxRetries || this.maxRetries,
      retryDelay: config.retryDelay || this.defaultRetryDelay,
      backoffMultiplier: config.backoffMultiplier || 1,
      strategies: config.strategies || ['retry', 'alert'],
      createdAt: new Date().toISOString()
    });
  }

  /**
   * Unregister a strategy
   */
  unregisterStrategy(strategyId) {
    return this.recoveryStrategies.delete(strategyId);
  }

  /**
   * Execute recovery for a failed operation
   */
  async executeRecovery(strategyId, failedOperation, context = {}) {
    const strategy = this.recoveryStrategies.get(strategyId);
    if (!strategy) {
      throw new Error(`Unknown recovery strategy: ${strategyId}`);
    }

    const taskId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const task = {
      id: taskId,
      strategyId,
      strategy,
      failedOperation,
      context,
      attempts: 0,
      maxAttempts: strategy.maxRetries,
      status: 'pending',
      startTime: Date.now(),
      lastAttemptTime: null,
      history: [],
      error: null
    };

    this.recoveryTasks.set(taskId, task);

    return this.runRecoveryTask(task);
  }

  /**
   * Run a recovery task with retries
   */
  async runRecoveryTask(task) {
    const { strategy, maxAttempts } = task;
    const { retryDelay, backoffMultiplier } = task.strategy;

    while (task.attempts < maxAttempts) {
      task.attempts++;
      task.lastAttemptTime = Date.now();
      task.status = 'running';

      this.addHistory(task, `Attempt ${task.attempts}/${maxAttempts}`);

      try {
        // Execute the failed operation
        if (typeof task.failedOperation === 'function') {
          const result = await task.failedOperation();
          task.status = 'completed';
          task.completedAt = Date.now();
          task.result = result;
          this.addHistory(task, 'Recovery succeeded');
          return result;
        } else {
          // If it's not a function, just mark as recovered
          task.status = 'completed';
          task.completedAt = Date.now();
          this.addHistory(task, 'Recovery marked complete');
          return { recovered: true };
        }
      } catch (error) {
        task.error = error;
        this.addHistory(task, `Attempt failed: ${error.message}`);

        if (task.attempts < maxAttempts) {
          // Calculate delay with exponential backoff
          const delay = retryDelay * Math.pow(backoffMultiplier, task.attempts - 1);
          this.addHistory(task, `Waiting ${delay}ms before retry...`);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted - send to dead letter queue
    task.status = 'failed';
    task.failedAt = Date.now();
    this.addToDeadLetterQueue(task);
    this.addHistory(task, 'Recovery failed - sent to dead letter queue');

    throw task.error || new Error(`Recovery failed after ${maxAttempts} attempts`);
  }

  /**
   * Add entry to task history
   */
  addHistory(task, message) {
    task.history.push({
      timestamp: Date.now(),
      message
    });
  }

  /**
   * Add task to dead letter queue
   */
  addToDeadLetterQueue(task) {
    this.deadLetterQueue.push({
      ...task,
      queuedAt: Date.now()
    });

    // Limit queue size
    if (this.deadLetterQueue.length > 100) {
      this.deadLetterQueue = this.deadLetterQueue.slice(-100);
    }
  }

  /**
   * Get dead letter queue
   */
  getDeadLetterQueue(limit = 50) {
    return limit
      ? this.deadLetterQueue.slice(-limit)
      : this.deadLetterQueue;
  }

  /**
   * Retry a dead letter task
   */
  async retryDeadLetter(taskId) {
    const taskIndex = this.deadLetterQueue.findIndex(t => t.id === taskId);
    if (taskIndex === -1) {
      throw new Error('Task not found in dead letter queue');
    }

    const task = this.deadLetterQueue.splice(taskIndex, 1)[0];
    task.attempts = 0;
    task.status = 'pending';
    task.history = [];

    return this.runRecoveryTask(task);
  }

  /**
   * Clear dead letter queue
   */
  clearDeadLetterQueue() {
    const count = this.deadLetterQueue.length;
    this.deadLetterQueue = [];
    return count;
  }

  /**
   * Get all recovery strategies
   */
  getStrategies() {
    const strategies = [];
    for (const [id, strategy] of this.recoveryStrategies) {
      strategies.push({
        ...strategy
      });
    }
    return strategies;
  }

  /**
   * Get all active recovery tasks
   */
  getActiveTasks() {
    const tasks = [];
    for (const [id, task] of this.recoveryTasks) {
      if (task.status === 'pending' || task.status === 'running') {
        tasks.push({
          id: task.id,
          strategyId: task.strategyId,
          strategyName: task.strategy.name,
          status: task.status,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          startTime: task.startTime
        });
      }
    }
    return tasks;
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId) {
    return this.recoveryTasks.get(taskId);
  }

  /**
   * Cancel a recovery task
   */
  cancelTask(taskId) {
    const task = this.recoveryTasks.get(taskId);
    if (!task) return false;

    if (task.status === 'pending' || task.status === 'running') {
      task.status = 'cancelled';
      task.cancelledAt = Date.now();
      return true;
    }
    return false;
  }

  /**
   * Helper to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get recovery statistics
   */
  getStatistics() {
    const tasks = Array.from(this.recoveryTasks.values());
    const deadLetter = this.deadLetterQueue.length;

    const byStatus = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    tasks.forEach(t => {
      if (byStatus.hasOwnProperty(t.status)) {
        byStatus[t.status]++;
      }
    });

    const avgRecoveryTime = this.calculateAvgRecoveryTime(tasks);

    return {
      totalTasks: tasks.length,
      activeTasks: byStatus.pending + byStatus.running,
      completedTasks: byStatus.completed,
      failedTasks: byStatus.failed,
      deadLetterQueue: deadLetter,
      byStatus,
      avgRecoveryTimeMs: avgRecoveryTime
    };
  }

  /**
   * Calculate average recovery time
   */
  calculateAvgRecoveryTime(tasks) {
    const completed = tasks.filter(t => t.status === 'completed' && t.completedAt);
    if (completed.length === 0) return 0;

    const totalTime = completed.reduce((sum, t) => sum + (t.completedAt - t.startTime), 0);
    return Math.round(totalTime / completed.length);
  }

  /**
   * Get service status
   */
  getStatus() {
    const stats = this.getStatistics();
    return {
      service: 'Auto Recovery',
      version: '1.0.0',
      status: 'operational',
      strategies: this.recoveryStrategies.size,
      activeTasks: stats.activeTasks,
      deadLetterQueue: stats.deadLetterQueue,
      ...stats,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = AutoRecoveryService;
