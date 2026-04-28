/**
 * Dashboard Real-Time Routes (COM-190)
 * API endpoints for real-time dashboard data
 */

const express = require('express');
const router = express.Router();
const { RealTimeService, RT_EVENTS } = require('../services/realTime');
const { AgentLifecycleManager, AGENT_STATUS } = require('../state/agentManager');
const { TaskQueueManager, TASK_STATUS } = require('../state/taskQueue');

// Real-time service instance (will be set during server initialization)
let realTimeService = null;

// Dashboard analytics service
let dashboardAnalytics = null;

/**
 * Initialize real-time dashboard routes
 * @param {Object} options
 * @param {RealTimeService} options.realTimeService
 * @param {DashboardAnalyticsService} options.dashboardAnalytics
 */
function initialize(options = {}) {
  realTimeService = options.realTimeService;
  dashboardAnalytics = options.dashboardAnalytics;
}

// ============================================
// AGENT STATUS ROUTES
// ============================================

// GET /api/dashboard/agents/status - Get current agent status (SSE or polling)
router.get('/agents/status', (req, res) => {
  try {
    // Check if client accepts SSE
    const acceptHeader = req.headers.accept || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

    if (wantsSSE) {
      // Set up SSE response
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });

      // Send initial data
      const agentData = getAgentStatusData();
      res.write(`event: agent_status\ndata: ${JSON.stringify(agentData)}\n\n`);

      // Set up interval for updates (every 5 seconds)
      const interval = setInterval(() => {
        try {
          const data = getAgentStatusData();
          res.write(`event: agent_status\ndata: ${JSON.stringify(data)}\n\n`);
        } catch (e) {
          clearInterval(interval);
        }
      }, 5000);

      // Clean up on close
      req.on('close', () => {
        clearInterval(interval);
      });

      return;
    }

    // Regular JSON response for polling
    res.json(getAgentStatusData());
  } catch (error) {
    console.error('[Dashboard RT] Error fetching agent status:', error);
    res.status(500).json({ error: 'Failed to fetch agent status' });
  }
});

// GET /api/dashboard/agents/:agentId - Get specific agent details
router.get('/agents/:agentId', (req, res) => {
  try {
    const { agentId } = req.params;

    // Get agent data from agent manager
    const agents = global.agentManager ? global.agentManager.list() : [];
    const agent = agents.find(a => a.id === agentId);

    if (!agent) {
      // Try to get from Paperclip agents API
      return res.json({
        id: agentId,
        status: 'unknown',
        error: 'Agent not found in local registry'
      });
    }

    // Get agent sessions
    const sessions = global.agentManager ? global.agentManager.getAgentSessions(agentId) : [];

    res.json({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      parentId: agent.parentId,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
      lastActiveAt: agent.lastActiveAt,
      activeSessions: sessions.length,
      error: agent.error
    });
  } catch (error) {
    console.error('[Dashboard RT] Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent details' });
  }
});

// ============================================
// TASK QUEUE ROUTES
// ============================================

// GET /api/dashboard/tasks/queue - Get task queue status
router.get('/tasks/queue', (req, res) => {
  try {
    const taskQueue = global.taskQueueManager;

    if (!taskQueue) {
      return res.json({
        error: 'Task queue manager not initialized',
        stats: null
      });
    }

    const stats = taskQueue.getStats();
    const pending = taskQueue.getPending();
    const running = taskQueue.getRunning();
    const deadLetter = taskQueue.getDeadLetterQueue();

    res.json({
      stats,
      pendingTasks: pending.map(t => ({
        id: t.id,
        type: t.type,
        priority: t.priority,
        createdAt: t.createdAt,
        metadata: t.metadata
      })),
      runningTasks: running.map(t => ({
        id: t.id,
        type: t.type,
        startedAt: t.startedAt,
        metadata: t.metadata
      })),
      deadLetterTasks: deadLetter
    });
  } catch (error) {
    console.error('[Dashboard RT] Error fetching task queue:', error);
    res.status(500).json({ error: 'Failed to fetch task queue status' });
  }
});

// GET /api/dashboard/tasks/:taskId - Get specific task details
router.get('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const taskQueue = global.taskQueueManager;

    if (!taskQueue) {
      return res.status(500).json({ error: 'Task queue manager not initialized' });
    }

    const task = taskQueue.get(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const dependencies = taskQueue.getTaskDependencies(taskId);

    res.json({
      ...task,
      dependencies,
      isRunning: task.status === TASK_STATUS.RUNNING,
      isPending: task.status === TASK_STATUS.PENDING,
      isQueued: task.status === TASK_STATUS.QUEUED,
      isBlocked: task.status === TASK_STATUS.BLOCKED,
      isCompleted: task.status === TASK_STATUS.COMPLETED,
      isFailed: task.status === TASK_STATUS.FAILED
    });
  } catch (error) {
    console.error('[Dashboard RT] Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task details' });
  }
});

// ============================================
// PERFORMANCE METRICS ROUTES
// ============================================

// GET /api/dashboard/metrics - Get performance metrics
router.get('/metrics', (req, res) => {
  try {
    const agentManager = global.agentManager;
    const taskQueue = global.taskQueueManager;

    const metrics = {
      agents: agentManager ? agentManager.getStats() : { total: 0, byStatus: {} },
      tasks: taskQueue ? taskQueue.getStats() : { total: 0 },
      realTime: realTimeService ? realTimeService.getStatus() : { status: 'not_initialized' },
      timestamp: new Date().toISOString()
    };

    // Add dashboard analytics if available
    if (dashboardAnalytics) {
      metrics.dashboard = {
        overview: dashboardAnalytics.getDashboardOverview(),
        kpiCards: dashboardAnalytics.getKPICards(),
        chartData: dashboardAnalytics.getChartData()
      };
    }

    res.json(metrics);
  } catch (error) {
    console.error('[Dashboard RT] Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /api/dashboard/activity - Get recent activity feed
router.get('/activity', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    if (dashboardAnalytics) {
      const activity = dashboardAnalytics.getRecentActivity(limit);
      return res.json(activity);
    }

    // Fallback: aggregate from agent and task events
    const agentManager = global.agentManager;
    const taskQueue = global.taskQueueManager;

    const activities = [];

    if (agentManager) {
      const agents = agentManager.list();
      agents.forEach(agent => {
        activities.push({
          id: `agent-${agent.id}`,
          type: 'agent',
          action: 'status_changed',
          entityType: 'agent',
          entityId: agent.id,
          entityName: agent.name,
          description: `Agent ${agent.name} is now ${agent.status}`,
          timestamp: agent.updatedAt,
          metadata: { status: agent.status, role: agent.role }
        });
      });
    }

    if (taskQueue) {
      const tasks = taskQueue.getByStatus(TASK_STATUS.COMPLETED);
      tasks.slice(0, 10).forEach(task => {
        activities.push({
          id: `task-${task.id}`,
          type: 'task',
          action: 'completed',
          entityType: 'task',
          entityId: task.id,
          entityName: task.type,
          description: `Task ${task.type} completed`,
          timestamp: task.completedAt,
          metadata: { type: task.type }
        });
      });
    }

    // Sort by timestamp
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      activities: activities.slice(0, limit),
      total: activities.length,
      limit,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Dashboard RT] Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity feed' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get agent status data for dashboard
 */
function getAgentStatusData() {
  const agentManager = global.agentManager;

  if (!agentManager) {
    return {
      agents: [],
      summary: { total: 0, byStatus: {} },
      timestamp: new Date().toISOString()
    };
  }

  const agents = agentManager.list();

  // Map agent statuses to dashboard-friendly format
  const agentSummary = {
    total: agents.length,
    byStatus: {
      idle: 0,
      running: 0,
      paused: 0,
      error: 0,
      other: 0
    },
    byRole: {}
  };

  const agentList = agents.map(agent => {
    // Count by status
    if (agent.status === AGENT_STATUS.IDLE) agentSummary.byStatus.idle++;
    else if (agent.status === AGENT_STATUS.RUNNING) agentSummary.byStatus.running++;
    else if (agent.status === AGENT_STATUS.PAUSED) agentSummary.byStatus.paused++;
    else if (agent.status === AGENT_STATUS.ERROR) agentSummary.byStatus.error++;
    else agentSummary.byStatus.other++;

    // Count by role
    if (!agentSummary.byRole[agent.role]) {
      agentSummary.byRole[agent.role] = 0;
    }
    agentSummary.byRole[agent.role]++;

    // Get active session count
    const sessions = agentManager.getAgentSessions(agent.id);
    const activeSession = sessions.find(s => s.status === 'active');

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      parentId: agent.parentId,
      lastActiveAt: agent.lastActiveAt,
      hasActiveSession: !!activeSession,
      error: agent.error
    };
  });

  return {
    agents: agentList,
    summary: agentSummary,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  router,
  initialize,
  getAgentStatusData
};
