/**
 * Execution Context - Manages context for agent execution
 *
 * Handles:
 * - Context window management (similar to Claude Code's contextCollapse)
 * - Message history
 * - Tool execution state
 * - Session management
 */

const { EventEmitter } = require('events');

const CONTEXT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  EXPIRED: 'expired'
};

class ExecutionContext extends EventEmitter {
  constructor(options = {}) {
    super();

    this.id = options.id || `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.agentId = options.agentId;
    this.status = CONTEXT_STATUS.ACTIVE;

    // Context window management
    this.maxTokens = options.maxTokens || 100000;
    this.currentTokens = 0;

    // Message/history
    this.messages = [];
    this.messageCount = 0;

    // Tool execution state
    this.toolExecutions = new Map(); // executionId -> execution data
    this.currentToolExecution = null;

    // Session metadata
    this.createdAt = new Date();
    this.lastActivityAt = new Date();
    this.expiresAt = options.expiresAt || null;

    // Custom data
    this.metadata = options.metadata || {};

    // History for undo/redo
    this._history = [];
    this._historyIndex = -1;
  }

  /**
   * Update last activity timestamp
   */
  touch() {
    this.lastActivityAt = new Date();
    return this;
  }

  /**
   * Add a message to the context
   * @param {Object} message
   * @param {string} message.role - 'user', 'assistant', 'system', 'tool'
   * @param {string} message.content - Message content
   * @param {Object} [message.metadata] - Additional metadata
   * @returns {Object} Added message with id
   */
  addMessage(message) {
    const msg = {
      id: `msg_${Date.now()}_${this.messageCount++}`,
      timestamp: new Date(),
      ...message
    };

    this.messages.push(msg);
    this._addToHistory('message_added', { message: msg });
    this.touch();

    this.emit('message:added', msg);

    return msg;
  }

  /**
   * Get recent messages
   * @param {number} [limit] - Maximum number of messages
   * @returns {Object[]}
   */
  getRecentMessages(limit) {
    if (limit) {
      return this.messages.slice(-limit);
    }
    return [...this.messages];
  }

  /**
   * Get message count
   * @returns {number}
   */
  getMessageCount() {
    return this.messages.length;
  }

  /**
   * Check if context is within token budget
   * @param {number} additionalTokens - Tokens to add
   * @returns {boolean}
   */
  hasTokenBudget(additionalTokens = 0) {
    return (this.currentTokens + additionalTokens) <= this.maxTokens;
  }

  /**
   * Update token count
   * @param {number} tokens
   */
  setTokens(tokens) {
    this.currentTokens = tokens;
    this.touch();

    // Emit warning if approaching limit
    if (tokens > this.maxTokens * 0.9) {
      this.emit('context:warning', {
        type: 'token_limit_approaching',
        percentage: (tokens / this.maxTokens) * 100
      });
    }

    // Check if collapse needed
    if (tokens >= this.maxTokens) {
      this.emit('context:needs_collapse');
    }
  }

  /**
   * Collapse context to fit within token budget
   * Removes oldest messages while preserving system prompt
   * @param {Object} options
   * @param {number} [options.targetTokens] - Target token count
   * @param {boolean} [options.preserveSystem=true] - Keep system message
   * @returns {Object} Collapse result
   */
  collapse(options = {}) {
    const targetTokens = options.targetTokens || this.maxTokens * 0.7;
    const preserveSystem = options.preserveSystem !== false;

    const result = {
      removedMessages: [],
      removedTokens: 0,
      preservedSystem: preserveSystem
    };

    // Separate system message from others
    let systemMessage = null;
    const otherMessages = [];

    for (const msg of this.messages) {
      if (msg.role === 'system' && preserveSystem) {
        systemMessage = msg;
      } else {
        otherMessages.push(msg);
      }
    }

    // Remove oldest messages until under target
    while (otherMessages.length > 0 && this._estimateTokens(otherMessages) > targetTokens) {
      const removed = otherMessages.shift();
      result.removedMessages.push(removed);
      result.removedTokens += this._estimateTokens([removed]);
    }

    // Rebuild messages array
    this.messages = [];
    if (systemMessage) {
      this.messages.push(systemMessage);
    }
    this.messages.push(...otherMessages);

    // Update token estimate
    this.currentTokens = this._estimateTokens(this.messages);

    this._addToHistory('context_collapsed', result);
    this.emit('context:collapsed', result);

    return result;
  }

  /**
   * Estimate tokens for messages (rough approximation)
   * @param {Object[]} messages
   * @returns {number}
   * @private
   */
  _estimateTokens(messages) {
    // Rough estimate: 4 characters per token
    const totalChars = messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return sum + content.length;
    }, 0);
    return Math.ceil(totalChars / 4);
  }

  /**
   * Start a tool execution
   * @param {Object} toolInfo
   * @returns {string} Execution ID
   */
  startToolExecution(toolInfo) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const execution = {
      id: executionId,
      tool: toolInfo.name,
      input: toolInfo.input,
      status: 'running',
      startedAt: new Date(),
      result: null,
      error: null
    };

    this.toolExecutions.set(executionId, execution);
    this.currentToolExecution = executionId;
    this.touch();

    this.emit('tool:started', { executionId, tool: toolInfo.name });

    return executionId;
  }

  /**
   * Complete a tool execution
   * @param {string} executionId
   * @param {Object} result
   */
  completeToolExecution(executionId, result) {
    const execution = this.toolExecutions.get(executionId);
    if (!execution) {
      return;
    }

    execution.status = 'completed';
    execution.result = result;
    execution.completedAt = new Date();
    this.currentToolExecution = null;
    this.touch();

    this.emit('tool:completed', { executionId, result });

    return execution;
  }

  /**
   * Fail a tool execution
   * @param {string} executionId
   * @param {string} error
   */
  failToolExecution(executionId, error) {
    const execution = this.toolExecutions.get(executionId);
    if (!execution) {
      return;
    }

    execution.status = 'failed';
    execution.error = error;
    execution.completedAt = new Date();
    this.currentToolExecution = null;
    this.touch();

    this.emit('tool:failed', { executionId, error });

    return execution;
  }

  /**
   * Get tool execution history
   * @returns {Object[]}
   */
  getToolHistory() {
    return Array.from(this.toolExecutions.values());
  }

  /**
   * Pause the context
   */
  pause() {
    this.status = CONTEXT_STATUS.PAUSED;
    this.emit('context:paused', { contextId: this.id });
    return this;
  }

  /**
   * Resume the context
   */
  resume() {
    this.status = CONTEXT_STATUS.ACTIVE;
    this.emit('context:resumed', { contextId: this.id });
    return this;
  }

  /**
   * Complete the context
   */
  complete() {
    this.status = CONTEXT_STATUS.COMPLETED;
    this.emit('context:completed', { contextId: this.id });
    return this;
  }

  /**
   * Add to history for undo/redo
   * @param {string} action
   * @param {Object} data
   * @private
   */
  _addToHistory(action, data) {
    // Remove any redo history
    this._history = this._history.slice(0, this._historyIndex + 1);

    this._history.push({ action, data, timestamp: new Date() });
    this._historyIndex = this._history.length - 1;
  }

  /**
   * Get history
   * @returns {Array}
   */
  getHistory() {
    return [...this._history];
  }

  /**
   * Get context summary
   * @returns {Object}
   */
  getSummary() {
    return {
      id: this.id,
      agentId: this.agentId,
      status: this.status,
      messageCount: this.messages.length,
      tokenUsage: {
        current: this.currentTokens,
        max: this.maxTokens,
        percentage: (this.currentTokens / this.maxTokens) * 100
      },
      toolExecutions: this.toolExecutions.size,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      expiresAt: this.expiresAt,
      metadata: this.metadata
    };
  }
}

module.exports = { ExecutionContext, CONTEXT_STATUS };
