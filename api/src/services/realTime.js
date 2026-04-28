/**
 * Real-Time Service (COM-190)
 * WebSocket/SSE infrastructure for real-time dashboard updates
 */

const { Server } = require('socket.io');
const { EventEmitter } = require('events');

// Event types for real-time updates
const RT_EVENTS = {
  // Agent events
  AGENT_STATUS_CHANGED: 'agent:status_changed',
  AGENT_CREATED: 'agent:created',
  AGENT_INITIALIZED: 'agent:initialized',
  AGENT_STARTED: 'agent:started',
  AGENT_PAUSED: 'agent:paused',
  AGENT_RESUMED: 'agent:resumed',
  AGENT_STOPPED: 'agent:stopped',
  AGENT_ERROR: 'agent:error',

  // Task events
  TASK_ADDED: 'task:added',
  TASK_STARTED: 'task:started',
  TASK_COMPLETED: 'task:completed',
  TASK_FAILED: 'task:failed',
  TASK_QUEUED: 'task:queued',
  TASK_BLOCKED: 'task:blocked',
  TASK_UNBLOCKED: 'task:unblocked',
  TASK_CANCELLED: 'task:cancelled',

  // Dashboard events
  DASHBOARD_REFRESH: 'dashboard:refresh',
  METRICS_UPDATE: 'metrics:update'
};

class RealTimeService extends EventEmitter {
  constructor(httpServer, options = {}) {
    super();

    this._io = null;
    this._httpServer = httpServer;
    this._options = {
      cors: options.cors || {
        origin: '*',
        methods: ['GET', 'POST']
      },
      pingTimeout: options.pingTimeout || 60000,
      pingInterval: options.pingInterval || 25000
    };

    // Room management
    this._rooms = new Map();

    // Metrics cache
    this._metricsCache = new Map();
    this._metricsCacheTimeout = options.metricsCacheTimeout || 5000;

    // Connected clients count
    this._clientCount = 0;
  }

  /**
   * Initialize Socket.io server
   */
  initialize() {
    if (this._io) {
      return this._io;
    }

    this._io = new Server(this._httpServer, {
      cors: this._options.cors,
      pingTimeout: this._options.pingTimeout,
      pingInterval: this._options.pingInterval
    });

    // Handle connections
    this._io.on('connection', (socket) => {
      this._clientCount++;
      console.log(`[RealTime] Client connected: ${socket.id} (total: ${this._clientCount})`);

      // Join default rooms
      socket.join('dashboard');
      socket.join('agents');
      socket.join('tasks');

      // Handle room subscriptions
      socket.on('subscribe', (room) => {
        socket.join(room);
        console.log(`[RealTime] ${socket.id} subscribed to ${room}`);
      });

      socket.on('unsubscribe', (room) => {
        socket.leave(room);
        console.log(`[RealTime] ${socket.id} unsubscribed from ${room}`);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        this._clientCount--;
        console.log(`[RealTime] Client disconnected: ${socket.id} (reason: ${reason}, total: ${this._clientCount})`);
      });

      // Send initial metrics on connection
      this._emitToClient(socket, 'metrics:initial', this._getCachedMetrics());
    });

    // Set up periodic metrics broadcast
    this._metricsInterval = setInterval(() => {
      this._broadcastMetrics();
    }, this._metricsCacheTimeout);

    console.log('[RealTime] Socket.io server initialized');
    return this._io;
  }

  /**
   * Get Socket.io server instance
   */
  getIO() {
    return this._io;
  }

  /**
   * Emit event to a specific client
   */
  _emitToClient(socket, event, data) {
    socket.emit(event, {
      event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event, data, room = null) {
    if (!this._io) {
      console.warn('[RealTime] Socket.io not initialized');
      return;
    }

    const payload = {
      event,
      data,
      timestamp: new Date().toISOString()
    };

    if (room) {
      this._io.to(room).emit(event, payload);
    } else {
      this._io.emit(event, payload);
    }

    console.log(`[RealTime] Broadcast: ${event}${room ? ` (room: ${room})` : ''}`);
  }

  /**
   * Broadcast to a specific room
   */
  broadcastToRoom(room, event, data) {
    this.broadcast(event, data, room);
  }

  /**
   * Get cached metrics or compute fresh
   */
  _getCachedMetrics() {
    const cached = this._metricsCache.get('dashboard');
    if (cached && Date.now() - cached.timestamp < this._metricsCacheTimeout) {
      return cached.value;
    }

    const metrics = {
      clientCount: this._clientCount,
      rooms: this._getRoomStats(),
      timestamp: new Date().toISOString()
    };

    this._metricsCache.set('dashboard', {
      value: metrics,
      timestamp: Date.now()
    });

    return metrics;
  }

  /**
   * Get room statistics
   */
  _getRoomStats() {
    const stats = {};
    if (this._io) {
      for (const [room, clients] of this._io.sockets.adapter.rooms) {
        if (room !== room.socketId) {
          stats[room] = clients.size;
        }
      }
    }
    return stats;
  }

  /**
   * Broadcast metrics to dashboard room
   */
  _broadcastMetrics() {
    this.broadcast('metrics:update', this._getCachedMetrics(), 'dashboard');
  }

  /**
   * Register AgentLifecycleManager event listeners
   */
  registerAgentManager(agentManager) {
    if (!agentManager) {
      console.warn('[RealTime] Agent manager not provided');
      return;
    }

    // Agent lifecycle events
    agentManager.on('agent:created', (data) => {
      this.broadcast(RT_EVENTS.AGENT_CREATED, data, 'agents');
    });

    agentManager.on('agent:initialized', (data) => {
      this.broadcast(RT_EVENTS.AGENT_INITIALIZED, data, 'agents');
    });

    agentManager.on('agent:started', (data) => {
      this.broadcast(RT_EVENTS.AGENT_STARTED, data, 'agents');
    });

    agentManager.on('agent:paused', (data) => {
      this.broadcast(RT_EVENTS.AGENT_PAUSED, data, 'agents');
    });

    agentManager.on('agent:resumed', (data) => {
      this.broadcast(RT_EVENTS.AGENT_RESUMED, data, 'agents');
    });

    agentManager.on('agent:stopped', (data) => {
      this.broadcast(RT_EVENTS.AGENT_STOPPED, data, 'agents');
    });

    agentManager.on('agent:status_changed', (data) => {
      this.broadcast(RT_EVENTS.AGENT_STATUS_CHANGED, data, 'agents');
      // Also notify dashboard
      this.broadcast(RT_EVENTS.AGENT_STATUS_CHANGED, data, 'dashboard');
    });

    agentManager.on('agent:error', (data) => {
      this.broadcast(RT_EVENTS.AGENT_ERROR, data, 'agents');
    });

    console.log('[RealTime] Agent manager event listeners registered');
  }

  /**
   * Register TaskQueueManager event listeners
   */
  registerTaskQueue(taskQueue) {
    if (!taskQueue) {
      console.warn('[RealTime] Task queue not provided');
      return;
    }

    // Task queue events
    taskQueue.on('task:added', (data) => {
      this.broadcast(RT_EVENTS.TASK_ADDED, data, 'tasks');
    });

    taskQueue.on('task:started', (data) => {
      this.broadcast(RT_EVENTS.TASK_STARTED, data, 'tasks');
    });

    taskQueue.on('task:completed', (data) => {
      this.broadcast(RT_EVENTS.TASK_COMPLETED, data, 'tasks');
      // Also notify dashboard
      this.broadcast(RT_EVENTS.TASK_COMPLETED, data, 'dashboard');
    });

    taskQueue.on('task:failed', (data) => {
      this.broadcast(RT_EVENTS.TASK_FAILED, data, 'tasks');
    });

    taskQueue.on('task:queued', (data) => {
      this.broadcast(RT_EVENTS.TASK_QUEUED, data, 'tasks');
    });

    taskQueue.on('task:blocked', (data) => {
      this.broadcast(RT_EVENTS.TASK_BLOCKED, data, 'tasks');
    });

    taskQueue.on('task:unblocked', (data) => {
      this.broadcast(RT_EVENTS.TASK_UNBLOCKED, data, 'tasks');
    });

    taskQueue.on('task:cancelled', (data) => {
      this.broadcast(RT_EVENTS.TASK_CANCELLED, data, 'tasks');
    });

    console.log('[RealTime] Task queue event listeners registered');
  }

  /**
   * Emit dashboard refresh event
   */
  refreshDashboard() {
    this.broadcast(RT_EVENTS.DASHBOARD_REFRESH, {
      timestamp: new Date().toISOString()
    }, 'dashboard');
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'Real-Time Service',
      version: '1.0.0',
      status: this._io ? 'operational' : 'not_initialized',
      clientCount: this._clientCount,
      rooms: this._getRoomStats(),
      events: {
        agentEvents: Object.values(RT_EVENTS).filter(e => e.startsWith('agent:')).length,
        taskEvents: Object.values(RT_EVENTS).filter(e => e.startsWith('task:')).length
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    if (this._metricsInterval) {
      clearInterval(this._metricsInterval);
    }

    if (this._io) {
      this._io.close();
      this._io = null;
    }

    console.log('[RealTime] Service shutdown complete');
  }
}

// SSE support for clients that don't support WebSocket
class SSEService {
  constructor() {
    this._clients = new Set();
  }

  /**
   * Add SSE client
   */
  addClient(response) {
    this._clients.add(response);
    console.log(`[SSE] Client added (total: ${this._clients.size})`);
  }

  /**
   * Remove SSE client
   */
  removeClient(response) {
    this._clients.delete(response);
    console.log(`[SSE] Client removed (total: ${this._clients.size})`);
  }

  /**
   * Send SSE event to all clients
   */
  send(event, data) {
    const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const client of this._clients) {
      client.write(message);
    }
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      service: 'SSE Service',
      clientCount: this._clients.size
    };
  }
}

module.exports = {
  RealTimeService,
  SSEService,
  RT_EVENTS
};
