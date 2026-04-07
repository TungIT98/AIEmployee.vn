/**
 * CustomTool - Plugin system for custom tools
 */

const { BaseTool } = require('./base');

/**
 * CustomTool allows dynamic tool registration with custom implementations.
 * Useful for extending the tool system with domain-specific functionality.
 */
class CustomTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'custom',
      description: 'Custom tool wrapper for dynamically registered tools',
      category: 'custom',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          toolName: {
            type: 'string',
            description: 'Name of the registered custom tool'
          },
          params: {
            type: 'object',
            description: 'Parameters to pass to the custom tool'
          }
        },
        required: ['toolName', 'params']
      }
    });

    this._registry = new Map();
  }

  /**
   * Register a custom tool implementation
   * @param {string} name - Tool name
   * @param {Object} definition - Tool definition
   * @param {Function} implementation - Async function(input) => ToolResult
   */
  register(name, definition, implementation) {
    if (typeof implementation !== 'function') {
      throw new Error('Implementation must be a function');
    }

    this._registry.set(name, {
      name,
      definition: {
        name,
        description: definition.description || '',
        category: definition.category || 'custom',
        version: definition.version || '1.0.0',
        inputSchema: definition.inputSchema || { type: 'object', properties: {} },
        outputSchema: definition.outputSchema || { type: 'object' }
      },
      implementation
    });

    return this;
  }

  /**
   * Unregister a custom tool
   * @param {string} name
   */
  unregister(name) {
    this._registry.delete(name);
  }

  /**
   * Get all registered tool names
   * @returns {string[]}
   */
  listTools() {
    return Array.from(this._registry.keys());
  }

  /**
   * Get tool definition
   * @param {string} name
   * @returns {Object|null}
   */
  getToolDefinition(name) {
    const tool = this._registry.get(name);
    return tool ? tool.definition : null;
  }

  /**
   * Get all tool definitions
   * @returns {Object[]}
   */
  getAllDefinitions() {
    return Array.from(this._registry.values()).map(t => t.definition);
  }

  async execute(input) {
    const { toolName, params } = input;

    const tool = this._registry.get(toolName);
    if (!tool) {
      return {
        success: false,
        result: null,
        error: `Custom tool '${toolName}' not found`,
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    try {
      const result = await tool.implementation(params);

      // Ensure result has required structure
      if (typeof result === 'object' && 'success' in result) {
        return {
          ...result,
          metadata: {
            ...result.metadata,
            tool: toolName,
            customTool: true,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Assume raw result is successful
      return {
        success: true,
        result,
        metadata: {
          tool: toolName,
          customTool: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message,
        metadata: {
          tool: toolName,
          customTool: true,
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}

module.exports = { CustomTool };
