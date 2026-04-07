/**
 * Tool Registry - Tool registration, versioning, and discovery
 *
 * Central registry for all tools in the Agent Orchestration System.
 * Supports versioning, categories, search, and dependency management.
 */

const { EventEmitter } = require('events');

class ToolRegistry extends EventEmitter {
  constructor() {
    super();

    // Tool storage: Map<toolId, ToolEntry>
    this._tools = new Map();

    // Version index: Map<toolName, Map<version, toolId>>
    this._versions = new Map();

    // Category index: Map<category, Set<toolId>>
    this._categories = new Map();

    // Tag index: Map<tag, Set<toolId>>
    this._tags = new Map();

    // History for versioning
    this._history = [];
  }

  /**
   * @typedef {Object} ToolEntry
   * @property {string} id - Unique tool ID
   * @property {string} name - Tool name
   * @property {string} version - Tool version
   * @property {Object} definition - Tool definition
   * @property {Object} instance - Tool instance
   * @property {Object} metadata - Additional metadata
   * @property {string} status - Tool status (active, deprecated, disabled)
   * @property {Date} registeredAt - Registration timestamp
   * @property {Date} updatedAt - Last update timestamp
   */

  /**
   * Generate a unique tool ID
   * @returns {string}
   */
  _generateId() {
    return `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Register a new tool
   * @param {Object} toolInstance - Instance of a tool (must have getDefinition())
   * @param {Object} options - Registration options
   * @param {string} [options.version] - Specific version to register
   * @param {string} [options.category] - Tool category
   * @param {string[]} [options.tags] - Tool tags
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Object} Registration result
   */
  register(toolInstance, options = {}) {
    if (!toolInstance || typeof toolInstance.getDefinition !== 'function') {
      throw new Error('Tool must implement getDefinition() method');
    }

    const definition = toolInstance.getDefinition();
    const version = options.version || definition.version || '1.0.0';
    const category = options.category || definition.category || 'general';
    const tags = options.tags || [];
    const metadata = options.metadata || {};

    // Create tool entry
    const id = this._generateId();
    const entry = {
      id,
      name: definition.name,
      version,
      definition,
      instance: toolInstance,
      metadata,
      status: 'active',
      registeredAt: new Date(),
      updatedAt: new Date()
    };

    // Store tool
    this._tools.set(id, entry);

    // Update version index
    if (!this._versions.has(definition.name)) {
      this._versions.set(definition.name, new Map());
    }
    this._versions.get(definition.name).set(version, id);

    // Update category index
    if (!this._categories.has(category)) {
      this._categories.set(category, new Set());
    }
    this._categories.get(category).add(id);

    // Update tag index
    for (const tag of tags) {
      if (!this._tags.has(tag)) {
        this._tags.set(tag, new Set());
      }
      this._tags.get(tag).add(id);
    }

    // Store in history
    this._history.push({
      action: 'register',
      toolId: id,
      name: definition.name,
      version,
      timestamp: new Date()
    });

    // Emit event
    this.emit('tool:registered', { id, name: definition.name, version });

    return { id, name: definition.name, version };
  }

  /**
   * Unregister a tool
   * @param {string} id - Tool ID
   * @param {boolean} [keepLatestVersion=false] - Keep the latest version if true
   * @returns {boolean} Success
   */
  unregister(id, keepLatestVersion = false) {
    const entry = this._tools.get(id);
    if (!entry) {
      return false;
    }

    // If keeping latest version, check if this is the latest
    if (keepLatestVersion) {
      const versionMap = this._versions.get(entry.name);
      if (versionMap) {
        const versions = Array.from(versionMap.keys()).sort();
        const latestVersion = versions[versions.length - 1];
        if (versionMap.get(latestVersion) === id && versions.length > 1) {
          // Remove this version but keep others
          versionMap.delete(entry.version);
          const newLatestId = versionMap.get(versions[versions.length - 2]);
          const newLatest = this._tools.get(newLatestId);
          if (newLatest) {
            entry.status = 'deprecated';
            this.emit('tool:deprecated', { id, name: entry.name, replacedBy: newLatestId });
            return true;
          }
        }
      }
    }

    // Full removal
    this._tools.delete(id);

    // Remove from version index
    const versionMap = this._versions.get(entry.name);
    if (versionMap) {
      versionMap.delete(entry.version);
      if (versionMap.size === 0) {
        this._versions.delete(entry.name);
      }
    }

    // Remove from category index
    const categorySet = this._categories.get(entry.definition.category);
    if (categorySet) {
      categorySet.delete(id);
    }

    // Remove from tag indexes
    for (const [tag, tagSet] of this._tags) {
      tagSet.delete(id);
    }

    // Store in history
    this._history.push({
      action: 'unregister',
      toolId: id,
      name: entry.name,
      timestamp: new Date()
    });

    // Emit event
    this.emit('tool:unregistered', { id, name: entry.name });

    return true;
  }

  /**
   * Get a tool by ID
   * @param {string} id
   * @returns {ToolEntry|null}
   */
  get(id) {
    return this._tools.get(id) || null;
  }

  /**
   * Get a tool by name and optional version
   * @param {string} name
   * @param {string} [version] - If not specified, returns latest version
   * @returns {ToolEntry|null}
   */
  getByName(name, version) {
    const versionMap = this._versions.get(name);
    if (!versionMap) {
      return null;
    }

    let targetVersion = version;
    if (!targetVersion) {
      // Get latest version
      const versions = Array.from(versionMap.keys()).sort();
      targetVersion = versions[versions.length - 1];
    }

    const id = versionMap.get(targetVersion);
    return id ? this._tools.get(id) : null;
  }

  /**
   * Get all versions of a tool
   * @param {string} name
   * @returns {Array<{version: string, id: string, status: string}>}
   */
  getVersions(name) {
    const versionMap = this._versions.get(name);
    if (!versionMap) {
      return [];
    }

    return Array.from(versionMap.entries()).map(([version, id]) => {
      const entry = this._tools.get(id);
      return {
        version,
        id,
        status: entry?.status || 'unknown'
      };
    });
  }

  /**
   * List all registered tools
   * @param {Object} filter - Filter options
   * @param {string} [filter.category] - Filter by category
   * @param {string} [filter.tag] - Filter by tag
   * @param {string} [filter.status] - Filter by status
   * @param {boolean} [filter.latestOnly=true] - Only return latest version
   * @returns {ToolEntry[]}
   */
  list(filter = {}) {
    const { category, tag, status, latestOnly = true } = filter;

    let toolIds = Array.from(this._tools.keys());

    // Apply category filter
    if (category) {
      const categorySet = this._categories.get(category);
      if (categorySet) {
        toolIds = toolIds.filter(id => categorySet.has(id));
      } else {
        return [];
      }
    }

    // Apply tag filter
    if (tag) {
      const tagSet = this._tags.get(tag);
      if (tagSet) {
        toolIds = toolIds.filter(id => tagSet.has(id));
      } else {
        return [];
      }
    }

    // Apply status filter
    if (status) {
      toolIds = toolIds.filter(id => {
        const entry = this._tools.get(id);
        return entry?.status === status;
      });
    }

    // Convert to entries
    let entries = toolIds.map(id => this._tools.get(id));

    // Filter to latest version only
    if (latestOnly) {
      const latestMap = new Map();
      for (const entry of entries) {
        const existing = latestMap.get(entry.name);
        if (!existing || this._compareVersions(entry.version, existing.version) > 0) {
          latestMap.set(entry.name, entry);
        }
      }
      entries = Array.from(latestMap.values());
    }

    return entries;
  }

  /**
   * Compare two semantic versions
   * @param {string} v1
   * @param {string} v2
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  _compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }

  /**
   * Search tools by name or description
   * @param {string} query
   * @param {Object} options - Search options
   * @param {string[]} [options.fields=['name','description']] - Fields to search
   * @param {boolean} [options.latestOnly=true] - Only return latest versions
   * @returns {ToolEntry[]}
   */
  search(query, options = {}) {
    const { fields = ['name', 'description'], latestOnly = true } = options;
    const lowerQuery = query.toLowerCase();

    const allTools = this.list({ latestOnly });

    return allTools.filter(tool => {
      for (const field of fields) {
        const value = tool.definition[field];
        if (value && value.toLowerCase().includes(lowerQuery)) {
          return true;
        }
      }
      return false;
    });
  }

  /**
   * Get all categories
   * @returns {string[]}
   */
  getCategories() {
    return Array.from(this._categories.keys());
  }

  /**
   * Get all tags
   * @returns {string[]}
   */
  getTags() {
    return Array.from(this._tags.keys());
  }

  /**
   * Update tool status
   * @param {string} id
   * @param {string} status - active, deprecated, disabled
   * @returns {boolean}
   */
  setStatus(id, status) {
    const entry = this._tools.get(id);
    if (!entry) {
      return false;
    }

    entry.status = status;
    entry.updatedAt = new Date();

    this._history.push({
      action: 'status_change',
      toolId: id,
      name: entry.name,
      status,
      timestamp: new Date()
    });

    this.emit('tool:status_changed', { id, name: entry.name, status });

    return true;
  }

  /**
   * Enable a tool
   * @param {string} id
   * @returns {boolean}
   */
  enable(id) {
    const entry = this._tools.get(id);
    if (entry && entry.instance && typeof entry.instance.enable === 'function') {
      entry.instance.enable();
    }
    return this.setStatus(id, 'active');
  }

  /**
   * Disable a tool
   * @param {string} id
   * @returns {boolean}
   */
  disable(id) {
    const entry = this._tools.get(id);
    if (entry && entry.instance && typeof entry.instance.disable === 'function') {
      entry.instance.disable();
    }
    return this.setStatus(id, 'disabled');
  }

  /**
   * Get tool history
   * @param {Object} options - Filter options
   * @param {string} [options.toolName] - Filter by tool name
   * @param {number} [options.limit=100] - Maximum entries to return
   * @returns {Array}
   */
  getHistory(options = {}) {
    const { toolName, limit = 100 } = options;

    let history = this._history;

    if (toolName) {
      history = history.filter(h => h.name === toolName);
    }

    return history.slice(-limit);
  }

  /**
   * Execute a tool by name
   * @param {string} name
   * @param {Object} input
   * @param {string} [version] - Specific version to execute
   * @returns {Promise<Object>}
   */
  async execute(name, input, version) {
    const entry = this.getByName(name, version);

    if (!entry) {
      return {
        success: false,
        result: null,
        error: `Tool '${name}' not found`,
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    if (entry.status === 'disabled') {
      return {
        success: false,
        result: null,
        error: `Tool '${name}' is disabled`,
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    if (!entry.instance.isEnabled()) {
      return {
        success: false,
        result: null,
        error: `Tool '${name}' is not enabled`,
        metadata: { timestamp: new Date().toISOString() }
      };
    }

    return entry.instance.run(input);
  }

  /**
   * Get registry statistics
   * @returns {Object}
   */
  getStats() {
    const tools = Array.from(this._tools.values());
    const activeTools = tools.filter(t => t.status === 'active');

    return {
      total: tools.length,
      active: activeTools.length,
      deprecated: tools.filter(t => t.status === 'deprecated').length,
      disabled: tools.filter(t => t.status === 'disabled').length,
      categories: this._categories.size,
      tags: this._tags.size,
      uniqueNames: this._versions.size
    };
  }
}

module.exports = { ToolRegistry };
