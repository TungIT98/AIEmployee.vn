/**
 * Agent Orchestration System (COM-G1)
 *
 * A comprehensive system for managing AI agents with:
 * - Tool System: BashTool, FileReadTool, FileWriteTool, SearchTool, WebFetchTool, CustomTool
 * - Tool Registry: Tool registration, versioning, discovery
 * - Task Queue: FIFO queue with priority and dependency tracking
 * - Execution Context: Context management for agent execution
 * - Memory: Multi-layer memory system (working, short-term, long-term)
 * - Agent Lifecycle: Create, pause, resume, terminate agents
 * - Hooks System: Event-driven extensibility
 */

const { ToolRegistry } = require('./tools/registry');
const {
  TaskQueueManager,
  PRIORITY,
  TASK_STATUS,
  ExecutionContext,
  CONTEXT_STATUS,
  Memory,
  MEMORY_LAYER,
  MEMORY_TYPE
} = require('./state');
const { AgentLifecycleManager, AGENT_STATUS } = require('./state/agentManager');
const { HooksSystem, HOOK_TYPES, getHooksInstance } = require('./hooks');
const {
  BaseTool,
  BashTool,
  FileReadTool,
  FileWriteTool,
  SearchTool,
  WebFetchTool,
  CustomTool,
  createDefaultTools,
  getToolNames
} = require('./tools');

/**
 * Create a complete Agent Orchestration System instance
 * @param {Object} options
 * @returns {Object}
 */
function createAgentOrchestrationSystem(options = {}) {
  // Initialize components
  const toolRegistry = new ToolRegistry();
  const agentManager = new AgentLifecycleManager(options.agent);
  const hooks = getHooksInstance();

  // Set up default tools if requested
  if (options.tools !== false) {
    const defaultTools = createDefaultTools(options.toolConfig || {});

    for (const [name, tool] of Object.entries(defaultTools)) {
      toolRegistry.register(tool, {
        category: tool.category,
        metadata: { builtIn: true }
      });
    }
  }

  // Wire up hooks between components
  hooks.wrapEmitter(toolRegistry);
  hooks.wrapEmitter(agentManager);

  return {
    // Core components
    toolRegistry,
    agentManager,
    hooks,

    // Constants
    constants: {
      PRIORITY,
      TASK_STATUS,
      CONTEXT_STATUS,
      MEMORY_LAYER,
      MEMORY_TYPE,
      AGENT_STATUS,
      HOOK_TYPES
    },

    // Tool helpers
    tools: {
      register: (tool, options) => toolRegistry.register(tool, options),
      unregister: (id) => toolRegistry.unregister(id),
      list: (filter) => toolRegistry.list(filter),
      search: (query, options) => toolRegistry.search(query, options),
      execute: (name, input, version) => toolRegistry.execute(name, input, version),
      get: (id) => toolRegistry.get(id),
      getByName: (name, version) => toolRegistry.getByName(name, version)
    },

    // Agent helpers
    agents: {
      create: (options) => agentManager.create(options),
      initialize: (agentId) => agentManager.initialize(agentId),
      start: (agentId, task) => agentManager.start(agentId, task),
      pause: (agentId) => agentManager.pause(agentId),
      resume: (agentId) => agentManager.resume(agentId),
      stop: (agentId, force) => agentManager.stop(agentId, force),
      terminate: (agentId) => agentManager.terminate(agentId),
      get: (agentId) => agentManager.get(agentId),
      list: (filter) => agentManager.list(filter),
      getSession: (sessionId) => agentManager.getSession(sessionId),
      createSession: (agentId, options) => agentManager.createSession(agentId, options)
    },

    // Task helpers
    tasks: {
      createManager: (options) => new TaskQueueManager(options)
    },

    // Context helpers
    context: {
      create: (options) => new ExecutionContext(options)
    },

    // Memory helpers
    memory: {
      create: (options) => new Memory(options)
    },

    // Stats
    stats: {
      getTools: () => toolRegistry.getStats(),
      getAgents: () => agentManager.getStats(),
      getHooks: () => hooks.getStats()
    },

    // Lifecycle
    destroy: () => {
      hooks.unregisterAll();
      agentManager.destroy();
    }
  };
}

module.exports = {
  // Main factory
  createAgentOrchestrationSystem,

  // Individual exports
  ToolRegistry,
  TaskQueueManager,
  AgentLifecycleManager,
  ExecutionContext,
  Memory,
  HooksSystem,

  // Tools
  BaseTool,
  BashTool,
  FileReadTool,
  FileWriteTool,
  SearchTool,
  WebFetchTool,
  CustomTool,
  createDefaultTools,
  getToolNames,

  // Constants
  PRIORITY,
  TASK_STATUS,
  CONTEXT_STATUS,
  MEMORY_LAYER,
  MEMORY_TYPE,
  AGENT_STATUS,
  HOOK_TYPES,

  // Singleton hooks
  getHooksInstance
};
