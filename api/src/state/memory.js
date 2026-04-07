/**
 * Memory System - Multi-layer memory management for agents
 *
 * Layers:
 * - Working Memory: Current execution context (ephemeral)
 * - Short-Term Memory: Recent interactions (session-based)
 * - Long-Term Memory: Persistent knowledge (stored)
 *
 * Supports semantic search and memory consolidation.
 */

const { EventEmitter } = require('events');

// Memory layers
const MEMORY_LAYER = {
  WORKING: 'working',
  SHORT_TERM: 'short_term',
  LONG_TERM: 'long_term'
};

// Memory entry types
const MEMORY_TYPE = {
  FACT: 'fact',
  EXPERIENCE: 'experience',
  PREFERENCE: 'preference',
  KNOWLEDGE: 'knowledge',
  CONVERSATION: 'conversation',
  TASK: 'task'
};

class Memory extends EventEmitter {
  constructor(options = {}) {
    super();

    // Storage for each layer
    this._working = new Map(); // Ephemeral, cleared on session end
    this._shortTerm = new Map(); // Session-based, configurable TTL
    this._longTerm = new Map(); // Persistent storage

    // Configuration
    this._shortTermTTL = options.shortTermTTL || 24 * 60 * 60 * 1000; // 24 hours default
    this._maxShortTerm = options.maxShortTerm || 1000;
    this._consolidationThreshold = options.consolidationThreshold || 100;

    // Indices for fast lookup
    this._indices = {
      byType: new Map(),
      byTag: new Map(),
      byAgent: new Map()
    };

    // Initialize cleanup interval
    this._cleanupInterval = setInterval(() => this._cleanup(), 60 * 60 * 1000); // Every hour
  }

  /**
   * @typedef {Object} MemoryEntry
   * @property {string} id - Unique entry ID
   * @property {string} layer - Memory layer (working, short_term, long_term)
   * @property {string} type - Entry type (fact, experience, etc.)
   * @property {string} content - Memory content
   * @property {Object} metadata - Additional metadata
   * @property {string[]} tags - Associated tags
   * @property {string} agentId - Agent that created this
   * @property {Date} createdAt
   * @property {Date} accessedAt
   * @property {number} accessCount
   * @property {number} importance - 0-10 importance score
   */

  /**
   * Generate a unique entry ID
   */
  _generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a memory entry
   * @param {Object} data
   * @returns {MemoryEntry}
   */
  _createEntry(data) {
    const entry = {
      id: this._generateId(),
      layer: data.layer || MEMORY_LAYER.SHORT_TERM,
      type: data.type || MEMORY_TYPE.FACT,
      content: data.content,
      metadata: data.metadata || {},
      tags: data.tags || [],
      agentId: data.agentId,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      importance: data.importance || 5
    };

    // Update indices
    this._indexEntry(entry);

    return entry;
  }

  /**
   * Index an entry for fast lookup
   * @param {MemoryEntry} entry
   */
  _indexEntry(entry) {
    // By type
    if (!this._indices.byType.has(entry.type)) {
      this._indices.byType.set(entry.type, new Set());
    }
    this._indices.byType.get(entry.type).add(entry.id);

    // By tag
    for (const tag of entry.tags) {
      if (!this._indices.byTag.has(tag)) {
        this._indices.byTag.set(tag, new Set());
      }
      this._indices.byTag.get(tag).add(entry.id);
    }

    // By agent
    if (entry.agentId) {
      if (!this._indices.byAgent.has(entry.agentId)) {
        this._indices.byAgent.set(entry.agentId, new Set());
      }
      this._indices.byAgent.get(entry.agentId).add(entry.id);
    }
  }

  /**
   * Remove entry from indices
   * @param {MemoryEntry} entry
   */
  _unindexEntry(entry) {
    // By type
    const typeSet = this._indices.byType.get(entry.type);
    if (typeSet) typeSet.delete(entry.id);

    // By tag
    for (const tag of entry.tags) {
      const tagSet = this._indices.byTag.get(tag);
      if (tagSet) tagSet.delete(entry.id);
    }

    // By agent
    if (entry.agentId) {
      const agentSet = this._indices.byAgent.get(entry.agentId);
      if (agentSet) agentSet.delete(entry.id);
    }
  }

  /**
   * Store a memory
   * @param {Object} data - Memory data
   * @param {string} data.content - Memory content
   * @param {string} [data.layer='short_term'] - Memory layer
   * @param {string} [data.type='fact'] - Memory type
   * @param {string[]} [data.tags] - Tags
   * @param {string} [data.agentId] - Agent ID
   * @param {number} [data.importance=5] - Importance score
   * @param {Object} [data.metadata] - Additional metadata
   * @returns {MemoryEntry}
   */
  store(data) {
    const entry = this._createEntry(data);
    const storage = this._getStorage(entry.layer);
    storage.set(entry.id, entry);

    // Check if consolidation needed
    if (this._shortTerm.size > this._consolidationThreshold) {
      this._scheduleConsolidation();
    }

    this.emit('memory:stored', entry);
    return entry;
  }

  /**
   * Get storage for a layer
   * @param {string} layer
   * @returns {Map}
   */
  _getStorage(layer) {
    switch (layer) {
      case MEMORY_LAYER.WORKING:
        return this._working;
      case MEMORY_LAYER.LONG_TERM:
        return this._longTerm;
      case MEMORY_LAYER.SHORT_TERM:
      default:
        return this._shortTerm;
    }
  }

  /**
   * Retrieve a memory by ID
   * @param {string} id
   * @param {boolean} [updateAccess=true] - Update access stats
   * @returns {MemoryEntry|null}
   */
  retrieve(id, updateAccess = true) {
    // Search all layers
    for (const storage of [this._working, this._shortTerm, this._longTerm]) {
      const entry = storage.get(id);
      if (entry) {
        if (updateAccess) {
          entry.accessedAt = new Date();
          entry.accessCount++;
        }
        return entry;
      }
    }
    return null;
  }

  /**
   * Search memories by content
   * @param {string} query
   * @param {Object} options
   * @param {string} [options.layer] - Layer to search
   * @param {string} [options.type] - Filter by type
   * @param {string[]} [options.tags] - Filter by tags
   * @param {string} [options.agentId] - Filter by agent
   * @param {number} [options.limit=10] - Max results
   * @param {boolean} [options.recentFirst=true] - Sort by recent first
   * @returns {MemoryEntry[]}
   */
  search(query, options = {}) {
    const {
      layer,
      type,
      tags,
      agentId,
      limit = 10,
      recentFirst = true
    } = options;

    const lowerQuery = query.toLowerCase();
    let results = [];

    // Determine which storage to search
    const storages = layer ? [this._getStorage(layer)] : [this._working, this._shortTerm, this._longTerm];

    for (const storage of storages) {
      for (const entry of storage.values()) {
        // Apply filters
        if (type && entry.type !== type) continue;
        if (agentId && entry.agentId !== agentId) continue;
        if (tags && !tags.some(tag => entry.tags.includes(tag))) continue;

        // Content match (simple substring search)
        if (entry.content.toLowerCase().includes(lowerQuery)) {
          results.push(entry);
        }
      }
    }

    // Sort
    if (recentFirst) {
      results.sort((a, b) => new Date(b.accessedAt) - new Date(a.accessedAt));
    }

    return results.slice(0, limit);
  }

  /**
   * Find similar memories
   * @param {string} content
   * @param {Object} options
   * @returns {MemoryEntry[]}
   */
  findSimilar(content, options = {}) {
    // Extract keywords from content
    const keywords = content
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3);

    const results = [];

    for (const storage of [this._shortTerm, this._longTerm]) {
      for (const entry of storage.values()) {
        const entryLower = entry.content.toLowerCase();
        let matchCount = 0;

        for (const keyword of keywords) {
          if (entryLower.includes(keyword)) {
            matchCount++;
          }
        }

        if (matchCount > 0) {
          results.push({
            entry,
            similarity: matchCount / keywords.length
          });
        }
      }
    }

    results.sort((a, b) => b.similarity - a.similarity);

    return results.slice(0, options.limit || 10).map(r => r.entry);
  }

  /**
   * Update a memory entry
   * @param {string} id
   * @param {Object} updates
   * @returns {MemoryEntry|null}
   */
  update(id, updates) {
    const entry = this.retrieve(id, false);
    if (!entry) {
      return null;
    }

    // Remove from index
    this._unindexEntry(entry);

    // Apply updates
    if (updates.content !== undefined) entry.content = updates.content;
    if (updates.tags !== undefined) entry.tags = updates.tags;
    if (updates.type !== undefined) entry.type = updates.type;
    if (updates.metadata !== undefined) entry.metadata = { ...entry.metadata, ...updates.metadata };
    if (updates.importance !== undefined) entry.importance = updates.importance;

    // Re-index
    this._indexEntry(entry);
    entry.accessedAt = new Date();

    this.emit('memory:updated', entry);

    return entry;
  }

  /**
   * Delete a memory
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    for (const storage of [this._working, this._shortTerm, this._longTerm]) {
      const entry = storage.get(id);
      if (entry) {
        this._unindexEntry(entry);
        storage.delete(id);
        this.emit('memory:deleted', { id });
        return true;
      }
    }
    return false;
  }

  /**
   * Move memory to a different layer
   * @param {string} id
   * @param {string} targetLayer
   * @returns {MemoryEntry|null}
   */
  move(id, targetLayer) {
    const entry = this.retrieve(id, false);
    if (!entry) {
      return null;
    }

    // Remove from current storage
    const currentStorage = this._getStorage(entry.layer);
    currentStorage.delete(id);
    this._unindexEntry(entry);

    // Update layer
    entry.layer = targetLayer;

    // Add to new storage
    const newStorage = this._getStorage(targetLayer);
    newStorage.set(id, entry);
    this._indexEntry(entry);

    this.emit('memory:moved', { id, from: entry.layer, to: targetLayer });

    return entry;
  }

  /**
   * Get memories by type
   * @param {string} type
   * @param {Object} options
   * @returns {MemoryEntry[]}
   */
  getByType(type, options = {}) {
    const { layer, limit = 50 } = options;
    const ids = this._indices.byType.get(type) || [];

    const results = [];
    for (const id of ids) {
      const entry = this.retrieve(id, false);
      if (entry && (!layer || entry.layer === layer)) {
        results.push(entry);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get memories by tag
   * @param {string} tag
   * @param {Object} options
   * @returns {MemoryEntry[]}
   */
  getByTag(tag, options = {}) {
    const { layer, limit = 50 } = options;
    const ids = this._indices.byTag.get(tag) || [];

    const results = [];
    for (const id of ids) {
      const entry = this.retrieve(id, false);
      if (entry && (!layer || entry.layer === layer)) {
        results.push(entry);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Get memories for an agent
   * @param {string} agentId
   * @param {Object} options
   * @returns {MemoryEntry[]}
   */
  getByAgent(agentId, options = {}) {
    const { layer, limit = 50 } = options;
    const ids = this._indices.byAgent.get(agentId) || [];

    const results = [];
    for (const id of ids) {
      const entry = this.retrieve(id, false);
      if (entry && (!layer || entry.layer === layer)) {
        results.push(entry);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * Consolidate short-term memories to long-term
   * @param {Object} options
   * @returns {number} Number of memories consolidated
   */
  consolidate(options = {}) {
    const { importanceThreshold = 7, maxToConsolidate = 50 } = options;

    const toConsolidate = [];
    const toDelete = [];

    for (const [id, entry] of this._shortTerm) {
      if (entry.importance >= importanceThreshold) {
        toConsolidate.push(entry);
      } else if (entry.accessCount < 2) {
        // Low importance, rarely accessed - delete
        toDelete.push(id);
      }
    }

    // Sort by importance
    toConsolidate.sort((a, b) => b.importance - a.importance);

    // Consolidate top entries
    let consolidated = 0;
    for (const entry of toConsolidate.slice(0, maxToConsolidate)) {
      this.move(entry.id, MEMORY_LAYER.LONG_TERM);
      consolidated++;
    }

    // Delete low-value entries
    for (const id of toDelete) {
      this.delete(id);
    }

    this.emit('memory:consolidated', { consolidated, deleted: toDelete.length });

    return consolidated;
  }

  /**
   * Schedule consolidation (debounced)
   */
  _scheduleConsolidation() {
    if (this._consolidationScheduled) return;
    this._consolidationScheduled = true;

    setTimeout(() => {
      this.consolidate();
      this._consolidationScheduled = false;
    }, 5000);
  }

  /**
   * Cleanup expired short-term memories
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, entry] of this._shortTerm) {
      const age = now - new Date(entry.accessedAt).getTime();
      if (age > this._shortTermTTL) {
        this.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.emit('memory:cleaned', { count: cleaned });
    }
  }

  /**
   * Clear all working memory
   */
  clearWorking() {
    const count = this._working.size;
    for (const id of this._working.keys()) {
      this._unindexEntry(this._working.get(id));
    }
    this._working.clear();
    this.emit('memory:working_cleared', { count });
  }

  /**
   * Get memory statistics
   * @returns {Object}
   */
  getStats() {
    return {
      working: this._working.size,
      shortTerm: this._shortTerm.size,
      longTerm: this._longTerm.size,
      total: this._working.size + this._shortTerm.size + this._longTerm.size,
      byType: Object.fromEntries(
        Array.from(this._indices.byType.entries()).map(([k, v]) => [k, v.size])
      ),
      byTag: Object.fromEntries(
        Array.from(this._indices.byTag.entries()).map(([k, v]) => [k, v.size])
      )
    };
  }

  /**
   * Get recent memories
   * @param {Object} options
   * @returns {MemoryEntry[]}
   */
  getRecent(options = {}) {
    const { layer, limit = 20 } = options;
    const storages = layer ? [this._getStorage(layer)] : [this._working, this._shortTerm, this._longTerm];

    const all = [];
    for (const storage of storages) {
      for (const entry of storage.values()) {
        all.push(entry);
      }
    }

    all.sort((a, b) => new Date(b.accessedAt) - new Date(a.accessedAt));

    return all.slice(0, limit);
  }

  /**
   * Destroy the memory system
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
    this._working.clear();
    this._shortTerm.clear();
    this._longTerm.clear();
    this._indices.byType.clear();
    this._indices.byTag.clear();
    this._indices.byAgent.clear();
  }
}

module.exports = {
  Memory,
  MEMORY_LAYER,
  MEMORY_TYPE
};
