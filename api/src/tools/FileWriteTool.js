/**
 * FileWriteTool - Write files to the filesystem
 */

const { BaseTool } = require('./base');
const fs = require('fs').promises;
const path = require('path');

class FileWriteTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'file_write',
      description: 'Create or overwrite a file on the filesystem',
      category: 'file',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          },
          encoding: {
            type: 'string',
            description: 'File encoding',
            default: 'utf8'
          },
          createDir: {
            type: 'boolean',
            description: 'Create directory if it does not exist',
            default: false
          }
        },
        required: ['path', 'content']
      }
    });

    this.allowedPaths = config.allowedPaths || [];
    this.deniedPaths = config.deniedPaths || ['/etc/', 'C:\\Windows\\', '/sys/', '/proc/'];
    this.maxFileSize = config.maxFileSize || 50 * 1024 * 1024; // 50MB default
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
    const { path: filePath, content, encoding = 'utf8', createDir = false } = input;

    // Security check
    if (!this.isPathAllowed(filePath)) {
      return {
        success: false,
        result: null,
        error: 'Path not allowed for security reasons',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    // Size check
    if (Buffer.byteLength(content, encoding) > this.maxFileSize) {
      return {
        success: false,
        result: null,
        error: `Content size exceeds maximum allowed (${this.maxFileSize})`,
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    try {
      // Create directory if requested
      if (createDir) {
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
      }

      await fs.writeFile(filePath, content, encoding);

      const stats = await fs.stat(filePath);

      return {
        success: true,
        result: {
          path: filePath,
          size: stats.size,
          written: Buffer.byteLength(content, encoding)
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

module.exports = { FileWriteTool };
