/**
 * State Module - Agent Orchestration System
 *
 * Provides state management components:
 * - TaskQueueManager: FIFO queue with priority and dependencies
 * - ExecutionContext: Per-execution context management
 * - Memory: Multi-layer memory system
 */

const { TaskQueueManager, PRIORITY, TASK_STATUS } = require('./taskQueue');
const { ExecutionContext, CONTEXT_STATUS } = require('./executionContext');
const { Memory, MEMORY_LAYER, MEMORY_TYPE } = require('./memory');

module.exports = {
  // Task Queue
  TaskQueueManager,
  PRIORITY,
  TASK_STATUS,

  // Execution Context
  ExecutionContext,
  CONTEXT_STATUS,

  // Memory
  Memory,
  MEMORY_LAYER,
  MEMORY_TYPE
};
