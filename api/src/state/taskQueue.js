/**
 * Task Queue Manager - FIFO queue with priority and dependency tracking
 *
 * Manages task execution for agents with support for:
 * - Multiple priority levels
 * - Task dependencies
 * - Retry logic
 * - Dead letter queue for failed tasks
 */

const { EventEmitter } = require('events');

// Priority levels (lower number = higher priority)
const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4
};

// Task statuses
const TASK_STATUS = {
  PENDING: 'pending',
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked'
};

class TaskQueueManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this._queues = new Map();
    this._tasks = new Map();
    this._dependencies = new Map(); // taskId -> Set of dependency taskIds
    this._dependents = new Map(); // taskId -> Set of dependent taskIds
    this._runningTasks = new Map(); // taskId -> task data
    this._deadLetterQueue = [];

    this._maxRetries = options.maxRetries || 3;
    this._retryDelay = options.retryDelay || 1000;
    this._maxConcurrent = options.maxConcurrent || 5;
    this._currentConcurrent = 0;

    // Initialize priority queues
    for (const [name, value] of Object.entries(PRIORITY)) {
      this._queues.set(value, []);
    }
  }

  /**
   * @typedef {Object} Task
   * @property {string} id - Unique task ID
   * @property {string} type - Task type
   * @property {Object} payload - Task data
   * @property {number} priority - Task priority (0-4)
   * @property {string[]} dependencies - Task IDs this task depends on
   * @property {number} status - Current status
   * @property {number} retries - Number of retry attempts
   * @property {Object} result - Task result (if completed)
   * @property {string} error - Error message (if failed)
   * @property {Date} createdAt - Creation timestamp
   * @property {Date} startedAt - Start timestamp
   * @property {Date} completedAt - Completion timestamp
   * @property {Object} metadata - Additional metadata
   */

  /**
   * Generate a unique task ID
   */
  _generateId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add a task to the queue
   * @param {Object} options - Task options
   * @param {string} [options.id] - Custom task ID
   * @param {string} options.type - Task type
   * @param {Object} options.payload - Task data
   * @param {number} [options.priority=PRIORITY.NORMAL] - Task priority
   * @param {string[]} [options.dependencies=[]] - Task IDs this depends on
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Task} The created task
   */
  add(options) {
    const id = options.id || this._generateId();
    const priority = options.priority ?? PRIORITY.NORMAL;
    const dependencies = options.dependencies || [];

    const task = {
      id,
      type: options.type,
      payload: options.payload,
      priority,
      dependencies,
      status: TASK_STATUS.PENDING,
      retries: 0,
      result: null,
      error: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      metadata: options.metadata || {}
    };

    this._tasks.set(id, task);

    // Store dependencies
    if (dependencies.length > 0) {
      this._dependencies.set(id, new Set(dependencies));

      // Also create reverse mapping (dependents)
      for (const depId of dependencies) {
        if (!this._dependents.has(depId)) {
          this._dependents.set(depId, new Set());
        }
        this._dependents.get(depId).add(id);
      }
    }

    // Check if can be queued (no unmet dependencies)
    if (this._canBeQueued(task)) {
      this._enqueue(task);
    } else {
      task.status = TASK_STATUS.BLOCKED;
      this.emit('task:blocked', { taskId: id, blockedBy: dependencies });
    }

    this.emit('task:added', { task });

    return task;
  }

  /**
   * Check if a task can be queued (all dependencies met)
   * @param {Task} task
   * @returns {boolean}
   */
  _canBeQueued(task) {
    if (task.dependencies.length === 0) {
      return true;
    }

    for (const depId of task.dependencies) {
      const depTask = this._tasks.get(depId);
      if (!depTask) {
        // Dependency doesn't exist - assume it's fine
        continue;
      }
      if (depTask.status !== TASK_STATUS.COMPLETED) {
        return false;
      }
    }

    return true;
  }

  /**
   * Enqueue a task for execution
   * @param {Task} task
   */
  _enqueue(task) {
    task.status = TASK_STATUS.QUEUED;
    const queue = this._queues.get(task.priority);
    queue.push(task);

    this.emit('task:queued', { taskId: task.id, priority: task.priority });
  }

  /**
   * Get the next task to execute (highest priority first, FIFO within priority)
   * @returns {Task|null}
   */
  _dequeue() {
    // Check concurrent limit
    if (this._currentConcurrent >= this._maxConcurrent) {
      return null;
    }

    // Find highest priority non-empty queue
    for (const [priority, queue] of this._queues) {
      // FIFO - shift from beginning
      while (queue.length > 0) {
        const task = queue.shift();
        const currentTask = this._tasks.get(task.id);

        // Skip if task no longer exists or is blocked
        if (!currentTask || currentTask.status === TASK_STATUS.BLOCKED) {
          continue;
        }

        // Skip if dependencies still not met
        if (!this._canBeQueued(currentTask)) {
          currentTask.status = TASK_STATUS.BLOCKED;
          this.emit('task:blocked', { taskId: currentTask.id });
          continue;
        }

        return currentTask;
      }
    }

    return null;
  }

  /**
   * Start executing a task
   * @param {string} taskId
   * @returns {Task|null}
   */
  start(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) {
      return null;
    }

    if (task.status !== TASK_STATUS.QUEUED) {
      return null;
    }

    task.status = TASK_STATUS.RUNNING;
    task.startedAt = new Date();
    this._currentConcurrent++;
    this._runningTasks.set(taskId, task);

    this.emit('task:started', { taskId, type: task.type });

    return task;
  }

  /**
   * Mark a task as completed
   * @param {string} taskId
   * @param {Object} result
   * @returns {boolean}
   */
  complete(taskId, result) {
    const task = this._runningTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.status = TASK_STATUS.COMPLETED;
    task.result = result;
    task.completedAt = new Date();
    this._currentConcurrent--;
    this._runningTasks.delete(taskId);

    this.emit('task:completed', { taskId, result, duration: task.completedAt - task.startedAt });

    // Unblock dependent tasks
    this._unblockDependents(taskId);

    // Try to start next task
    this._processQueue();

    return true;
  }

  /**
   * Mark a task as failed
   * @param {string} taskId
   * @param {string} error
   * @returns {boolean}
   */
  fail(taskId, error) {
    const task = this._runningTasks.get(taskId);
    if (!task) {
      return false;
    }

    task.retries++;

    if (task.retries < this._maxRetries) {
      // Retry the task
      this.emit('task:retry', {
        taskId,
        attempt: task.retries,
        maxRetries: this._maxRetries,
        error
      });

      this._currentConcurrent--;
      this._runningTasks.delete(taskId);

      // Schedule retry with delay
      setTimeout(() => {
        task.status = TASK_STATUS.QUEUED;
        this._queues.get(task.priority).push(task);
        this._processQueue();
      }, this._retryDelay * task.retries);

      return true;
    }

    // Max retries exceeded - move to dead letter queue
    task.status = TASK_STATUS.FAILED;
    task.error = error;
    task.completedAt = new Date();
    this._currentConcurrent--;
    this._runningTasks.delete(taskId);

    this._deadLetterQueue.push({
      task: { ...task },
      failedAt: new Date(),
      error,
      originalRetries: task.retries
    });

    this.emit('task:failed', { taskId, error, movedToDeadLetter: true });

    // Unblock dependent tasks (they should handle the failure)
    this._unblockDependents(taskId);

    // Try to start next task
    this._processQueue();

    return true;
  }

  /**
   * Cancel a task
   * @param {string} taskId
   * @returns {boolean}
   */
  cancel(taskId) {
    const task = this._tasks.get(taskId);
    if (!task) {
      return false;
    }

    // Can only cancel pending, queued, or blocked tasks
    if (![TASK_STATUS.PENDING, TASK_STATUS.QUEUED, TASK_STATUS.BLOCKED].includes(task.status)) {
      return false;
    }

    // Remove from queue if queued
    if (task.status === TASK_STATUS.QUEUED) {
      const queue = this._queues.get(task.priority);
      const index = queue.findIndex(t => t.id === taskId);
      if (index !== -1) {
        queue.splice(index, 1);
      }
    }

    task.status = TASK_STATUS.CANCELLED;
    task.completedAt = new Date();

    this.emit('task:cancelled', { taskId });

    // Unblock dependents
    this._unblockDependents(taskId);

    return true;
  }

  /**
   * Unblock tasks that depend on a completed task
   * @param {string} taskId
   */
  _unblockDependents(taskId) {
    const dependents = this._dependents.get(taskId);
    if (!dependents) {
      return;
    }

    for (const depId of dependents) {
      const depTask = this._tasks.get(depId);
      if (!depTask || depTask.status !== TASK_STATUS.BLOCKED) {
        continue;
      }

      // Check if all dependencies are now met
      if (this._canBeQueued(depTask)) {
        this._enqueue(depTask);
        this.emit('task:unblocked', { taskId: depId });
      }
    }
  }

  /**
   * Process the queue - start next available tasks
   */
  _processQueue() {
    while (this._currentConcurrent < this._maxConcurrent) {
      const task = this._dequeue();
      if (!task) {
        break;
      }
      this.start(task.id);
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId
   * @returns {Task|null}
   */
  get(taskId) {
    return this._tasks.get(taskId) || null;
  }

  /**
   * Get tasks by status
   * @param {string} status
   * @returns {Task[]}
   */
  getByStatus(status) {
    return Array.from(this._tasks.values()).filter(t => t.status === status);
  }

  /**
   * Get tasks by type
   * @param {string} type
   * @returns {Task[]}
   */
  getByType(type) {
    return Array.from(this._tasks.values()).filter(t => t.type === type);
  }

  /**
   * Get all pending and queued tasks
   * @returns {Task[]}
   */
  getPending() {
    return Array.from(this._tasks.values()).filter(
      t => t.status === TASK_STATUS.PENDING || t.status === TASK_STATUS.QUEUED
    );
  }

  /**
   * Get all running tasks
   * @returns {Task[]}
   */
  getRunning() {
    return Array.from(this._runningTasks.values());
  }

  /**
   * Get dead letter queue
   * @returns {Array}
   */
  getDeadLetterQueue() {
    return [...this._deadLetterQueue];
  }

  /**
   * Get queue statistics
   * @returns {Object}
   */
  getStats() {
    const tasks = Array.from(this._tasks.values());

    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === TASK_STATUS.PENDING).length,
      queued: tasks.filter(t => t.status === TASK_STATUS.QUEUED).length,
      running: this._currentConcurrent,
      completed: tasks.filter(t => t.status === TASK_STATUS.COMPLETED).length,
      failed: tasks.filter(t => t.status === TASK_STATUS.FAILED).length,
      blocked: tasks.filter(t => t.status === TASK_STATUS.BLOCKED).length,
      cancelled: tasks.filter(t => t.status === TASK_STATUS.CANCELLED).length,
      deadLetter: this._deadLetterQueue.length,
      maxConcurrent: this._maxConcurrent
    };
  }

  /**
   * Clear completed and cancelled tasks (keeps failed for analysis)
   * @param {number} [olderThan] - Optional timestamp, clear tasks older than this
   * @returns {number} Number of tasks cleared
   */
  cleanup(olderThan) {
    const threshold = olderThan || Date.now();
    let cleared = 0;

    for (const [taskId, task] of this._tasks) {
      if (
        (task.status === TASK_STATUS.COMPLETED || task.status === TASK_STATUS.CANCELLED) &&
        task.completedAt &&
        task.completedAt.getTime() < threshold
      ) {
        this._tasks.delete(taskId);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get tasks with dependencies
   * @param {string} taskId
   * @returns {Object}
   */
  getTaskDependencies(taskId) {
    return {
      dependencies: Array.from(this._dependencies.get(taskId) || []),
      dependents: Array.from(this._dependents.get(taskId) || [])
    };
  }
}

module.exports = {
  TaskQueueManager,
  PRIORITY,
  TASK_STATUS
};
