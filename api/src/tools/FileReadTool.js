/**
 * FileReadTool - Read files from the filesystem
 */

const { BaseTool } = require('./base');
const fs = require('fs').promises;
const path = require('path');

class FileReadTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'file_read',
      description: 'Read contents of a file from the filesystem',
      category: 'file',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file'
          },
          encoding: {
            type: 'string',
            description: 'File encoding',
            default: 'utf8'
          },
          maxSize: {
            type: 'number',
            description: 'Maximum file size in bytes (default 10MB)',
            default: 10 * 1024 * 1024
          }
        },
        required: ['path']
      }
    });

    this.allowedPaths = config.allowedPaths || [];
    this.deniedPaths = config.deniedPaths || [];
    this.defaultMaxSize = config.defaultMaxSize || 10 * 1024 * 1024;
  }

  /**
   * Check if path is allowed
   * @param {string} filePath
   * @returns {boolean}
   */
  isPathAllowed(filePath) {
    const normalizedPath = path.normalize(filePath);

    // Check denied patterns
    for (const denied of this.deniedPaths) {
      if (normalizedPath.includes(denied)) {
        return false;
      }
    }

    // If allowed list is empty, allow all non-denied paths
    if (this.allowedPaths.length === 0) {
      return true;
    }

    // Check allowed patterns
    for (const allowed of this.allowedPaths) {
      if (normalizedPath.includes(allowed)) {
        return true;
      }
    }

    return false;
  }

  async execute(input) {
    const { path: filePath, encoding = 'utf8', maxSize } = input;
    const effectiveMaxSize = maxSize || this.defaultMaxSize;

    // Security check
    if (!this.isPathAllowed(filePath)) {
      return {
        success: false,
        result: null,
        error: 'Path not allowed for security reasons',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    try {
      // Check file size first
      const stats = await fs.stat(filePath);
      if (stats.size > effectiveMaxSize) {
        return {
          success: false,
          result: null,
          error: `File size (${stats.size}) exceeds maximum allowed (${effectiveMaxSize})`,
          metadata: { tool: this.name, timestamp: new Date().toISOString() }
        };
      }

      const content = await fs.readFile(filePath, encoding);

      return {
        success: true,
        result: {
          path: filePath,
          content,
          size: stats.size,
          lines: content.split('\n').length
        },
        metadata: {
          tool: this.name,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message,
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }
  }
}

module.exports = { FileReadTool };
