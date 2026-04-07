/**
 * Agent Lifecycle Manager - Create, pause, resume, terminate agents
 *
 * Manages the complete lifecycle of agents including:
 * - Agent registration and configuration
 * - Session management
 * - State persistence
 * - Health monitoring
 */

const { EventEmitter } = require('events');
const { ExecutionContext } = require('./executionContext');
const { Memory, MEMORY_LAYER } = require('./memory');
const { TaskQueueManager, PRIORITY, TASK_STATUS } = require('./taskQueue');

// Agent statuses
const AGENT_STATUS = {
  CREATED: 'created',
  INITIALIZING: 'initializing',
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  TERMINATED: 'terminated',
  ERROR: 'error'
};

class AgentLifecycleManager extends EventEmitter {
  constructor(options = {}) {
    super();

    // Agent storage
    this._agents = new Map();

    // Session storage
    this._sessions = new Map();

    // Configuration
    this._defaultMaxTokens = options.defaultMaxTokens || 100000;
    this._defaultTimeout = options.defaultTimeout || 30 * 60 * 1000; // 30 minutes
    this._healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute

    // Start health monitoring
    this._healthCheckTimer = setInterval(() => this._healthCheck(), this._healthCheckInterval);
  }

  /**
   * @typedef {Object} Agent
   * @property {string} id - Unique agent ID
   * @property {string} name - Agent name
   * @property {string} role - Agent role (e.g., 'backend', 'frontend')
   * @property {Object} config - Agent configuration
   * @property {string} status - Current status
   * @property {string} [parentId] - Parent agent ID (for hierarchy)
   * @property {Object} metadata - Additional metadata
   * @property {Date} createdAt
   * @property {Date} updatedAt
   * @property {Date} lastActiveAt
   */

  /**
   * @typedef {Object} AgentSession
   * @property {string} id - Session ID
   * @property {string} agentId - Associated agent ID
   * @property {ExecutionContext} context - Current execution context
   * @property {Memory} memory - Session memory
   * @property {TaskQueueManager} taskQueue - Session task queue
   * @property {string} status - Session status
   * @property {Date} createdAt
   * @property {Date} lastActiveAt
   */

  /**
   * Create a new agent
   * @param {Object} options
   * @param {string} options.name - Agent name
   * @param {string} options.role - Agent role
   * @param {Object} [options.config] - Agent configuration
   * @param {string} [options.parentId] - Parent agent ID
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Agent} Created agent
   */
  create(options) {
    const id = options.id || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const agent = {
      id,
      name: options.name,
      role: options.role || 'worker',
      config: {
        maxTokens: options.config?.maxTokens || this._defaultMaxTokens,
        timeout: options.config?.timeout || this._defaultTimeout,
        tools: options.config?.tools || [],
        ...options.config
      },
      status: AGENT_STATUS.CREATED,
      parentId: options.parentId || null,
      metadata: options.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastActiveAt: new Date(),
      error: null
    };

    this._agents.set(id, agent);

    this.emit('agent:created', { agent });
    this.emit('agent:status_changed', { agentId: id, status: AGENT_STATUS.CREATED });

    return agent;
  }

  /**
   * Initialize an agent (async setup)
   * @param {string} agentId
   * @returns {Promise<Agent>}
   */
  async initialize(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = AGENT_STATUS.INITIALIZING;
    agent.updatedAt = new Date();

    try {
      // Create initial session
      const session = this.createSession(agentId);

      // Initialize tools if configured
      if (agent.config.tools && agent.config.tools.length > 0) {
        // Tools would be initialized here via Tool Registry
      }

      agent.status = AGENT_STATUS.IDLE;
      agent.updatedAt = new Date();

      this.emit('agent:initialized', { agentId, sessionId: session.id });
      this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.IDLE });

      return agent;
    } catch (error) {
      agent.status = AGENT_STATUS.ERROR;
      agent.error = error.message;
      agent.updatedAt = new Date();

      this.emit('agent:error', { agentId, error: error.message });
      this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.ERROR });

      throw error;
    }
  }

  /**
   * Create a session for an agent
   * @param {string} agentId
   * @param {Object} [options]
   * @returns {AgentSession}
   */
  createSession(agentId, options = {}) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const session = {
      id: sessionId,
      agentId,
      context: new ExecutionContext({
        agentId,
        maxTokens: options.maxTokens || agent.config.maxTokens,
        metadata: options.metadata
      }),
      memory: new Memory(),
      taskQueue: new TaskQueueManager({
        maxConcurrent: options.maxConcurrent || 3
      }),
      status: 'active',
      createdAt: new Date(),
      lastActivityAt: new Date()
    };

    this._sessions.set(sessionId, session);

    this.emit('session:created', { sessionId, agentId });

    return session;
  }

  /**
   * Get an agent by ID
   * @param {string} agentId
   * @returns {Agent|null}
   */
  get(agentId) {
    return this._agents.get(agentId) || null;
  }

  /**
   * Get agent by name
   * @param {string} name
   * @returns {Agent|null}
   */
  getByName(name) {
    for (const agent of this._agents.values()) {
      if (agent.name === name) {
        return agent;
      }
    }
    return null;
  }

  /**
   * Get all agents
   * @param {Object} filter
   * @param {string} [filter.role] - Filter by role
   * @param {string} [filter.status] - Filter by status
   * @param {string} [filter.parentId] - Filter by parent
   * @returns {Agent[]}
   */
  list(filter = {}) {
    let agents = Array.from(this._agents.values());

    if (filter.role) {
      agents = agents.filter(a => a.role === filter.role);
    }
    if (filter.status) {
      agents = agents.filter(a => a.status === filter.status);
    }
    if (filter.parentId !== undefined) {
      agents = agents.filter(a => a.parentId === filter.parentId);
    }

    return agents;
  }

  /**
   * Get a session by ID
   * @param {string} sessionId
   * @returns {AgentSession|null}
   */
  getSession(sessionId) {
    return this._sessions.get(sessionId) || null;
  }

  /**
   * Get sessions for an agent
   * @param {string} agentId
   * @returns {AgentSession[]}
   */
  getAgentSessions(agentId) {
    return Array.from(this._sessions.values()).filter(s => s.agentId === agentId);
  }

  /**
   * Update agent status
   * @param {string} agentId
   * @param {string} status
   * @param {string} [error]
   * @returns {boolean}
   */
  _setStatus(agentId, status, error) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.status = status;
    agent.updatedAt = new Date();
    if (error) {
      agent.error = error;
    }

    this.emit('agent:status_changed', { agentId, status, error });

    return true;
  }

  /**
   * Start an agent
   * @param {string} agentId
   * @param {Object} [task]
   * @returns {Promise<AgentSession>}
   */
  async start(agentId, task) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (![AGENT_STATUS.IDLE, AGENT_STATUS.PAUSED].includes(agent.status)) {
      throw new Error(`Agent ${agentId} cannot be started (status: ${agent.status})`);
    }

    // Create or get session
    let session = this.getActiveSession(agentId);
    if (!session) {
      session = this.createSession(agentId);
    }

    agent.status = AGENT_STATUS.RUNNING;
    agent.lastActiveAt = new Date();
    agent.updatedAt = new Date();

    // Add task to queue if provided
    if (task) {
      session.taskQueue.add({
        type: task.type || 'default',
        payload: task.payload || task,
        priority: task.priority || PRIORITY.NORMAL
      });
    }

    this.emit('agent:started', { agentId, sessionId: session.id });
    this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.RUNNING });

    return session;
  }

  /**
   * Pause an agent
   * @param {string} agentId
   * @returns {boolean}
   */
  pause(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent || agent.status !== AGENT_STATUS.RUNNING) {
      return false;
    }

    agent.status = AGENT_STATUS.PAUSED;
    agent.updatedAt = new Date();

    // Pause active session
    const session = this.getActiveSession(agentId);
    if (session) {
      session.context.pause();
    }

    this.emit('agent:paused', { agentId });
    this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.PAUSED });

    return true;
  }

  /**
   * Resume a paused agent
   * @param {string} agentId
   * @returns {boolean}
   */
  resume(agentId) {
    const agent = this._agents.get(agentId);
    if (!agent || agent.status !== AGENT_STATUS.PAUSED) {
      return false;
    }

    agent.status = AGENT_STATUS.RUNNING;
    agent.lastActiveAt = new Date();
    agent.updatedAt = new Date();

    // Resume active session
    const session = this.getActiveSession(agentId);
    if (session) {
      session.context.resume();
    }

    this.emit('agent:resumed', { agentId });
    this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.RUNNING });

    return true;
  }

  /**
   * Stop an agent (graceful shutdown)
   * @param {string} agentId
   * @param {boolean} [force=false] - Force immediate termination
   * @returns {Promise<boolean>}
   */
  async stop(agentId, force = false) {
    const agent = this._agents.get(agentId);
    if (!agent) {
      return false;
    }

    agent.status = AGENT_STATUS.STOPPING;
    this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.STOPPING });

    // Close all sessions
    const sessions = this.getAgentSessions(agentId);
    for (const session of sessions) {
      await this.closeSession(session.id, force);
    }

    agent.status = AGENT_STATUS.TERMINATED;
    agent.updatedAt = new Date();

    this.emit('agent:stopped', { agentId });
    this.emit('agent:status_changed', { agentId, status: AGENT_STATUS.TERMINATED });

    return true;
  }

  /**
   * Terminate an agent (immediate stop)
   * @param {string} agentId
   * @returns {Promise<boolean>}
   */
  async terminate(agentId) {
    return this.stop(agentId, true);
  }

  /**
   * Close a session
   * @param {string} sessionId
   * @param {boolean} [force=false]
   */
  async closeSession(sessionId, force = false) {
    const session = this._sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Clean up resources
    session.context.complete();
    session.memory.destroy();
    session.status = 'closed';

    this._sessions.delete(sessionId);

    this.emit('session:closed', { sessionId, agentId: session.agentId });
  }

  /**
   * Get active session for an agent
   * @param {string} agentId
   * @returns {AgentSession|null}
   */
  getActiveSession(agentId) {
    for (const session of this._sessions.values()) {
      if (session.agentId === agentId && session.status === 'active') {
        return session;
      }
    }
    return null;
  }

  /**
   * Health check for all agents
   * @private
   */
  _healthCheck() {
    const now = Date.now();

    for (const agent of this._agents.values()) {
      if (agent.status !== AGENT_STATUS.RUNNING) {
        continue;
      }

      // Check if agent has been active recently
      const idleTime = now - new Date(agent.lastActiveAt).getTime();
      if (idleTime > agent.config.timeout) {
        this.emit('agent:health_warning', {
          agentId: agent.id,
          type: 'idle_timeout',
          idleTime
        });
      }
    }
  }

  /**
   * Get agent statistics
   * @returns {Object}
   */
  getStats() {
    const agents = Array.from(this._agents.values());

    return {
      total: agents.length,
      byStatus: {
        created: agents.filter(a => a.status === AGENT_STATUS.CREATED).length,
        initializing: agents.filter(a => a.status === AGENT_STATUS.INITIALIZING).length,
        idle: agents.filter(a => a.status === AGENT_STATUS.IDLE).length,
        running: agents.filter(a => a.status === AGENT_STATUS.RUNNING).length,
        paused: agents.filter(a => a.status === AGENT_STATUS.PAUSED).length,
        stopped: agents.filter(a => a.status === AGENT_STATUS.TERMINATED).length,
        error: agents.filter(a => a.status === AGENT_STATUS.ERROR).length
      },
      byRole: Object.fromEntries(
        [...new Set(agents.map(a => a.role))].map(role => [
          role,
          agents.filter(a => a.role === role).length
        ])
      ),
      activeSessions: Array.from(this._sessions.values()).filter(s => s.status === 'active').length
    };
  }

  /**
   * Destroy the manager (cleanup)
   */
  destroy() {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
    }

    // Close all sessions
    for (const sessionId of this._sessions.keys()) {
      this.closeSession(sessionId, true);
    }

    // Clear agents
    this._agents.clear();

    this.emit('manager:destroyed');
  }
}

module.exports = {
  AgentLifecycleManager,
  AGENT_STATUS
};
