/**
 * Tools Module - Agent Orchestration System
 *
 * This module provides the tool system foundation for the Agent Orchestration System.
 * It includes base tool interface and standard tool implementations.
 */

const { BaseTool } = require('./base');
const { BashTool } = require('./BashTool');
const { FileReadTool } = require('./FileReadTool');
const { FileWriteTool } = require('./FileWriteTool');
const { SearchTool } = require('./SearchTool');
const { WebFetchTool } = require('./WebFetchTool');
const { CustomTool } = require('./CustomTool');

/**
 * Create a default tool registry with all standard tools
 * @param {Object} config - Tool configuration
 * @returns {Object} Object containing all tools
 */
function createDefaultTools(config = {}) {
  return {
    bash: new BashTool(config.bash),
    fileRead: new FileReadTool(config.fileRead),
    fileWrite: new FileWriteTool(config.fileWrite),
    search: new SearchTool(config.search),
    webFetch: new WebFetchTool(config.webFetch),
    custom: new CustomTool(config.custom)
  };
}

/**
 * Get all tool names
 * @returns {string[]}
 */
function getToolNames() {
  return ['bash', 'file_read', 'file_write', 'search', 'web_fetch', 'custom'];
}

module.exports = {
  // Base classes
  BaseTool,

  // Tool implementations
  BashTool,
  FileReadTool,
  FileWriteTool,
  SearchTool,
  WebFetchTool,
  CustomTool,

  // Factory functions
  createDefaultTools,
  getToolNames
};
