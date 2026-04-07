/**
 * Hooks System - Event-driven extensibility for Agent Orchestration
 *
 * Provides a hooks system similar to Claude Code's hooks for:
 * - Pre/post task execution
 * - Agent lifecycle events
 * - Tool execution events
 * - Error handling
 */

const { EventEmitter } = require('events');

// Built-in hook types
const HOOK_TYPES = {
  // Agent lifecycle hooks
  AGENT_CREATED: 'agent:created',
  AGENT_INITIALIZED: 'agent:initialized',
  AGENT_STARTED: 'agent:started',
  AGENT_PAUSED: 'agent:paused',
  AGENT_RESUMED: 'agent:resumed',
  AGENT_STOPPED: 'agent:stopped',
  AGENT_ERROR: 'agent:error',
  AGENT_STATUS_CHANGED: 'agent:status_changed',

  // Session hooks
  SESSION_CREATED: 'session:created',
  SESSION_CLOSED: 'session:closed',

  // Task hooks
  TASK_ADDED: 'task:added',
  TASK_QUEUED: 'task:queued',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_RETRY: 'task:retry',
  TASK_BLOCKED: 'task:blocked',
  TASK_CANCELLED: 'task:cancelled',

  // Tool hooks
  TOOL_REGISTERED: 'tool:registered',
  TOOL_UNREGISTERED: 'tool:unregistered',
  TOOL_STATUS_CHANGED: 'tool:status_changed',
  TOOL_STARTED: 'tool:started',
  TOOL_COMPLETED: 'tool:completed',
  TOOL_FAILED: 'tool:failed',

  // Memory hooks
  MEMORY_STORED: 'memory:stored',
  MEMORY_UPDATED: 'memory:updated',
  MEMORY_DELETED: 'memory:deleted',
  MEMORY_CONSOLIDATED: 'memory:consolidated',

  // Context hooks
  CONTEXT_PAUSED: 'context:paused',
  CONTEXT_RESUMED: 'context:resumed',
  CONTEXT_COMPLETED: 'context:completed',
  CONTEXT_COLLAPSED: 'context:collapsed',
  CONTEXT_WARNING: 'context:warning',

  // System hooks
  MANAGER_DESTROYED: 'manager:destroyed'
};

class HooksSystem extends EventEmitter {
  constructor() {
    super();

    // Registered hooks
    this._hooks = new Map();

    // Hook metadata
    this._hookMeta = new Map();

    // Initialize hook arrays
    for (const hookType of Object.values(HOOK_TYPES)) {
      this._hooks.set(hookType, []);
    }
  }

  /**
   * Register a hook
   * @param {string} type - Hook type
   * @param {Function} handler - Async function(data) => modifiedData | void
   * @param {Object} [options]
   * @param {number} [options.priority=0] - Higher priority runs first
   * @param {boolean} [options.once=false] - Only run once then remove
   * @param {string} [options.name] - Optional name for the hook
   * @returns {string} Hook ID
   */
  register(type, handler, options = {}) {
    if (!this._hooks.has(type)) {
      this._hooks.set(type, []);
    }

    const hookId = `hook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const hook = {
      id: hookId,
      type,
      handler,
      priority: options.priority || 0,
      once: options.once || false,
      name: options.name || null,
      callCount: 0,
      lastCalled: null
    };

    this._hooks.get(type).push(hook);

    // Sort by priority (descending)
    this._hooks.get(type).sort((a, b) => b.priority - a.priority);

    // Store metadata
    this._hookMeta.set(hookId, {
      registeredAt: new Date()
    });

    return hookId;
  }

  /**
   * Register multiple hooks at once
   * @param {Object} hooks - { [hookType]: handler | [handler, options] }
   * @returns {string[]} Array of hook IDs
   */
  registerMany(hooks) {
    const ids = [];
    for (const [type, handlerOrArray] of Object.entries(hooks)) {
      if (Array.isArray(handlerOrArray)) {
        const [handler, options] = handlerOrArray;
        ids.push(this.register(type, handler, options));
      } else {
        ids.push(this.register(type, handlerOrArray));
      }
    }
    return ids;
  }

  /**
   * Unregister a hook
   * @param {string} hookId
   * @returns {boolean}
   */
  unregister(hookId) {
    for (const [type, hooks] of this._hooks) {
      const index = hooks.findIndex(h => h.id === hookId);
      if (index !== -1) {
        hooks.splice(index, 1);
        this._hookMeta.delete(hookId);
        return true;
      }
    }
    return false;
  }

  /**
   * Unregister all hooks of a type
   * @param {string} type
   */
  unregisterAll(type) {
    if (type) {
      if (this._hooks.has(type)) {
        for (const hook of this._hooks.get(type)) {
          this._hookMeta.delete(hook.id);
        }
        this._hooks.get(type).clear();
      }
    } else {
      for (const [type, hooks] of this._hooks) {
        for (const hook of hooks) {
          this._hookMeta.delete(hook.id);
        }
        hooks.length = 0;
      }
    }
  }

  /**
   * Execute hooks for a type
   * @param {string} type
   * @param {Object} data
   * @returns {Promise<Object>} Modified data after all hooks
   */
  async execute(type, data) {
    if (!this._hooks.has(type)) {
      return data;
    }

    let result = data;

    for (const hook of this._hooks.get(type)) {
      try {
        const hookResult = await hook.handler(result);

        // If hook returns a value, use it
        if (hookResult !== undefined) {
          result = hookResult;
        }

        // Update stats
        hook.callCount++;
        hook.lastCalled = new Date();

        // Remove if one-time hook
        if (hook.once) {
          this.unregister(hook.id);
        }
      } catch (error) {
        // Hook error - log but continue
        console.error(`Hook ${hook.id} error:`, error);
        this.emit('hook:error', { hookId: hook.id, type, error: error.message });
      }
    }

    return result;
  }

  /**
   * Get hooks for a type
   * @param {string} type
   * @returns {Array}
   */
  getHooks(type) {
    if (!this._hooks.has(type)) {
      return [];
    }
    return this._hooks.get(type).map(h => ({
      id: h.id,
      type: h.type,
      priority: h.priority,
      once: h.once,
      name: h.name,
      callCount: h.callCount,
      lastCalled: h.lastCalled
    }));
  }

  /**
   * Get all registered hook types
   * @returns {string[]}
   */
  getHookTypes() {
    return Array.from(this._hooks.keys()).filter(type => this._hooks.get(type).length > 0);
  }

  /**
   * Get hook statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalHooks: 0,
      byType: {}
    };

    for (const [type, hooks] of this._hooks) {
      if (hooks.length > 0) {
        stats.byType[type] = hooks.length;
        stats.totalHooks += hooks.length;
      }
    }

    return stats;
  }

  /**
   * Create a pre-configured hook set (utility for common patterns)
   * @param {string} prefix - Prefix for hook names
   * @param {Object} handlers - Map of hook handlers
   * @returns {string[]} Hook IDs
   */
  createHookSet(prefix, handlers) {
    return this.registerMany(
      Object.fromEntries(
        Object.entries(handlers).map(([key, handler]) => [
          key.startsWith(prefix) ? key : `${prefix}:${key}`,
          handler
        ])
      )
    );
  }

  /**
   * Wrap an event emitter with hooks
   * @param {EventEmitter} emitter
   * @param {Object} options
   * @returns {HooksSystem} This hooks system
   */
  wrapEmitter(emitter, options = {}) {
    const self = this;
    const prefix = options.prefix || '';

    // Listen to all events from the emitter
    for (const event of Object.values(HOOK_TYPES)) {
      const eventName = prefix ? `${prefix}:${event}` : event;

      emitter.on(eventName, async (data) => {
        await self.execute(event, data);
        self.emit(event, data); // Re-emit for chaining
      });
    }

    return self;
  }
}

// Singleton instance
let hooksInstance = null;

function getHooksInstance() {
  if (!hooksInstance) {
    hooksInstance = new HooksSystem();
  }
  return hooksInstance;
}

module.exports = {
  HooksSystem,
  HOOK_TYPES,
  getHooksInstance
};
