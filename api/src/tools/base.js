/**
 * Base Tool Interface
 * All tools must implement this interface
 */

/**
 * @typedef {Object} ToolResult
 * @property {boolean} success - Whether the tool executed successfully
 * @property {*} result - The result data from execution
 * @property {string} [error] - Error message if execution failed
 * @property {Object} metadata - Execution metadata
 */

/**
 * @typedef {Object} ToolDefinition
 * @property {string} name - Unique tool name
 * @property {string} description - Human-readable description
 * @property {Object} inputSchema - JSON Schema for tool input
 * @property {Object} outputSchema - JSON Schema for tool output
 * @property {string} version - Tool version
 * @property {string} category - Tool category (file, system, network, etc.)
 */

class BaseTool {
  /**
   * @param {Object} config - Tool configuration
   * @param {string} config.name - Tool name
   * @param {string} config.description - Tool description
   * @param {Object} config.inputSchema - JSON Schema for input validation
   * @param {Object} [config.outputSchema] - JSON Schema for output validation
   * @param {string} [config.version='1.0.0'] - Tool version
   * @param {string} [config.category='general'] - Tool category
   */
  constructor(config) {
    this.name = config.name;
    this.description = config.description;
    this.inputSchema = config.inputSchema || { type: 'object', properties: {} };
    this.outputSchema = config.outputSchema || { type: 'object' };
    this.version = config.version || '1.0.0';
    this.category = config.category || 'general';
    this.enabled = true;
    this._hooks = {
      beforeExecute: [],
      afterExecute: [],
      onError: []
    };
  }

  /**
   * Get the tool definition (metadata)
   * @returns {ToolDefinition}
   */
  getDefinition() {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema,
      outputSchema: this.outputSchema,
      version: this.version,
      category: this.category
    };
  }

  /**
   * Validate input against the input schema
   * @param {Object} input - Input to validate
   * @throws {Error} If validation fails
   */
  validateInput(input) {
    // Basic validation - in production use a schema validator like Zod or Joi
    if (!input || typeof input !== 'object') {
      throw new Error(`${this.name}: Input must be an object`);
    }
    return true;
  }

  /**
   * Register a hook for tool lifecycle events
   * @param {string} event - Event name (beforeExecute, afterExecute, onError)
   * @param {Function} callback - Callback function
   */
  registerHook(event, callback) {
    if (this._hooks[event]) {
      this._hooks[event].push(callback);
    }
  }

  /**
   * Execute before hooks
   * @param {Object} input - Tool input
   * @returns {Object} Modified input
   */
  async _runBeforeHooks(input) {
    let modifiedInput = input;
    for (const hook of this._hooks.beforeExecute) {
      modifiedInput = await hook(modifiedInput, this) || modifiedInput;
    }
    return modifiedInput;
  }

  /**
   * Execute after hooks
   * @param {ToolResult} result - Tool result
   * @param {Object} input - Tool input
   * @returns {ToolResult} Modified result
   */
  async _runAfterHooks(result, input) {
    let modifiedResult = result;
    for (const hook of this._hooks.afterExecute) {
      modifiedResult = await hook(modifiedResult, input, this) || modifiedResult;
    }
    return modifiedResult;
  }

  /**
   * Execute error hooks
   * @param {Error} error - Error that occurred
   * @param {Object} input - Tool input
   * @returns {ToolResult} Error result
   */
  async _runErrorHooks(error, input) {
    let errorResult = {
      success: false,
      result: null,
      error: error.message,
      metadata: {
        tool: this.name,
        timestamp: new Date().toISOString(),
        executionTime: 0
      }
    };
    for (const hook of this._hooks.onError) {
      errorResult = await hook(errorResult, error, input, this) || errorResult;
    }
    return errorResult;
  }

  /**
   * Main execute method - must be implemented by subclasses
   * @param {Object} input - Validated tool input
   * @returns {Promise<ToolResult>}
   */
  async execute(input) {
    throw new Error(`${this.name}: execute() must be implemented`);
  }

  /**
   * Run the tool with lifecycle hooks
   * @param {Object} input - Tool input
   * @returns {Promise<ToolResult>}
   */
  async run(input) {
    const startTime = Date.now();

    try {
      // Validate input
      this.validateInput(input);

      // Run before hooks
      const modifiedInput = await this._runBeforeHooks(input);

      // Execute tool
      const result = await this.execute(modifiedInput);

      // Add metadata
      result.metadata = {
        ...result.metadata,
        tool: this.name,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime
      };

      // Run after hooks
      const finalResult = await this._runAfterHooks(result, modifiedInput);

      return finalResult;
    } catch (error) {
      // Run error hooks
      return await this._runErrorHooks(error, input);
    }
  }

  /**
   * Enable the tool
   */
  enable() {
    this.enabled = true;
  }

  /**
   * Disable the tool
   */
  disable() {
    this.enabled = false;
  }

  /**
   * Check if tool is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
}

module.exports = { BaseTool, ToolResult: null };
