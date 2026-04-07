/**
 * SearchTool - Search for files and content using glob and grep patterns
 */

const { BaseTool } = require('./base');
const fs = require('fs').promises;
const path = require('path');

class SearchTool extends BaseTool {
  constructor(config = {}) {
    super({
      name: 'search',
      description: 'Search for files by pattern or search content using grep',
      category: 'file',
      version: '1.0.0',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['glob', 'grep', 'find'],
            description: 'Search type: glob (file pattern), grep (content search), find (file listing)'
          },
          pattern: {
            type: 'string',
            description: 'Search pattern (glob pattern for glob, regex for grep)'
          },
          path: {
            type: 'string',
            description: 'Base path to search from'
          },
          options: {
            type: 'object',
            description: 'Additional options',
            properties: {
              caseSensitive: { type: 'boolean', default: false },
              recursive: { type: 'boolean', default: true },
              maxResults: { type: 'number', default: 100 },
              filePattern: { type: 'string', description: 'Glob pattern for files to search (grep only)' }
            }
          }
        },
        required: ['type', 'pattern', 'path']
      }
    });

    this.maxResults = config.maxResults || 100;
    this.allowedPaths = config.allowedPaths || [];
    this.deniedPaths = config.deniedPaths || ['/node_modules/', '.git/', 'C:\\Windows\\'];
  }

  /**
   * Check if path is allowed
   * @param {string} searchPath
   * @returns {boolean}
   */
  isPathAllowed(searchPath) {
    const normalizedPath = path.normalize(searchPath);

    for (const denied of this.deniedPaths) {
      if (normalizedPath.includes(denied)) {
        return false;
      }
    }

    if (this.allowedPaths.length === 0) {
      return true;
    }

    for (const allowed of this.allowedPaths) {
      if (normalizedPath.includes(allowed)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Glob search - find files matching a pattern
   */
  async globSearch(pattern, searchPath, options = {}) {
    const results = [];
    const maxDepth = options.recursive ? 10 : 1;

    const search = async (dir, depth) => {
      if (depth > maxDepth || results.length >= this.maxResults) return;

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (results.length >= this.maxResults) break;

          const fullPath = path.join(dir, entry.name);

          // Check if matches pattern
          if (this.matchGlob(entry.name, pattern)) {
            results.push({
              path: fullPath,
              type: entry.isDirectory() ? 'directory' : 'file',
              name: entry.name
            });
          }

          // Recurse into directories
          if (entry.isDirectory() && options.recursive) {
            await search(fullPath, depth + 1);
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    await search(searchPath, 0);
    return results;
  }

  /**
   * Simple glob pattern matching
   */
  matchGlob(filename, pattern) {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');

    const regex = new RegExp(`^${regexPattern}$`, 'i');
    return regex.test(filename);
  }

  /**
   * Grep search - search file contents
   */
  async grepSearch(pattern, searchPath, options = {}) {
    const results = [];
    const { caseSensitive = false, recursive = true, maxResults = this.maxResults, filePattern } = options;

    try {
      const files = await this.globSearch('*', searchPath, { recursive, maxResults: 1000 });

      // Filter by file pattern if specified
      const searchFiles = filePattern
        ? files.filter(f => f.type === 'file' && this.matchGlob(f.name, filePattern))
        : files.filter(f => f.type === 'file');

      const regex = new RegExp(pattern, caseSensitive ? '' : 'i');

      for (const file of searchFiles) {
        if (results.length >= maxResults) break;

        try {
          const content = await fs.readFile(file.path, 'utf8');
          const lines = content.split('\n');

          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i])) {
              results.push({
                file: file.path,
                line: i + 1,
                content: lines[i].trim(),
                match: lines[i].match(regex)?.[0] || ''
              });

              if (results.length >= maxResults) break;
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      throw error;
    }

    return results;
  }

  /**
   * Find - list all files and directories
   */
  async find(searchPath, options = {}) {
    return this.globSearch('*', searchPath, options);
  }

  async execute(input) {
    const { type, pattern, path: searchPath, options = {} } = input;

    // Security check
    if (!this.isPathAllowed(searchPath)) {
      return {
        success: false,
        result: null,
        error: 'Path not allowed for security reasons',
        metadata: { tool: this.name, timestamp: new Date().toISOString() }
      };
    }

    try {
      let results;

      switch (type) {
        case 'glob':
          results = await this.globSearch(pattern, searchPath, options);
          break;
        case 'grep':
          results = await this.grepSearch(pattern, searchPath, options);
          break;
        case 'find':
          results = await this.find(searchPath, options);
          break;
        default:
          throw new Error(`Unknown search type: ${type}`);
      }

      return {
        success: true,
        result: {
          type,
          pattern,
          path: searchPath,
          count: results.length,
          results: results.slice(0, this.maxResults)
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

module.exports = { SearchTool };
