/**
 * Multi-Region Service - COM-133
 * Global scale infrastructure with geographic load balancing and failover
 */

const http = require('http');
const https = require('https');

class MultiRegionService {
  constructor() {
    // Region configuration
    this.regions = new Map();

    // Default regions (can be configured via environment)
    this.defaultRegions = [
      {
        id: 'ap-southeast-1',
        name: 'Southeast Asia (Singapore)',
        endpoint: process.env.REGION_AP_SE_1 || 'http://localhost:3000',
        priority: 1,
        isActive: true,
        health: 'unknown',
        lastHealthCheck: null,
        weight: 100
      },
      {
        id: 'ap-northeast-1',
        name: 'Asia Pacific (Tokyo)',
        endpoint: process.env.REGION_AP_NE_1 || 'http://localhost:3001',
        priority: 2,
        isActive: true,
        health: 'unknown',
        lastHealthCheck: null,
        weight: 80
      },
      {
        id: 'us-east-1',
        name: 'US East (Virginia)',
        endpoint: process.env.REGION_US_E_1 || 'http://localhost:3002',
        priority: 3,
        isActive: true,
        health: 'unknown',
        lastHealthCheck: null,
        weight: 60
      }
    ];

    // Initialize regions
    this.initializeRegions();

    // CDN configuration
    this.cdnConfig = {
      enabled: process.env.CDN_ENABLED === 'true',
      provider: process.env.CDN_PROVIDER || 'cloudflare',
      staticAssetsPath: process.env.CDN_STATIC_PATH || '/static',
      cacheTTL: parseInt(process.env.CDN_CACHE_TTL) || 86400, // 24 hours
      edgeLocations: [
        'sin',  // Singapore
        'nrt',  // Tokyo
        'iad',  // Virginia
        'lax',  // Los Angeles
        'fra'   // Frankfurt
      ]
    };

    // Failover configuration
    this.failoverConfig = {
      enabled: true,
      healthCheckInterval: parseInt(process.env.FAILOVER_INTERVAL) || 30000, // 30 seconds
      failureThreshold: parseInt(process.env.FAILOVER_THRESHOLD) || 3,
      recoveryThreshold: parseInt(process.env.FAILOVER_RECOVERY) || 2,
      automaticFailover: process.env.AUTO_FAILOVER !== 'false'
    };

    // Data replication configuration
    this.replicationConfig = {
      enabled: process.env.REPLICATION_ENABLED === 'true',
      strategy: process.env.REPLICATION_STRATEGY || 'async', // sync, async, eventual
      regions: this.defaultRegions.map(r => r.id),
      replicationDelay: parseInt(process.env.REPLICATION_DELAY) || 1000
    };

    // Statistics
    this.stats = {
      totalRequests: 0,
      requestsByRegion: {},
      failovers: 0,
      activeRegion: 'ap-southeast-1',
      lastFailover: null
    };

    // Initialize health checks
    this.startHealthChecks();
  }

  /**
   * Initialize regions from configuration
   */
  initializeRegions() {
    for (const region of this.defaultRegions) {
      this.regions.set(region.id, region);
      this.stats.requestsByRegion[region.id] = 0;
    }
  }

  /**
   * Register a new region
   */
  registerRegion(regionConfig) {
    const region = {
      id: regionConfig.id,
      name: regionConfig.name,
      endpoint: regionConfig.endpoint,
      priority: regionConfig.priority || 2,
      isActive: regionConfig.isActive !== false,
      health: 'unknown',
      lastHealthCheck: null,
      weight: regionConfig.weight || 50
    };
    this.regions.set(region.id, region);
    this.stats.requestsByRegion[region.id] = 0;
    return region;
  }

  /**
   * Remove a region
   */
  removeRegion(regionId) {
    return this.regions.delete(regionId);
  }

  /**
   * Get active regions sorted by priority
   */
  getActiveRegions() {
    return Array.from(this.regions.values())
      .filter(r => r.isActive && r.health === 'healthy')
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Health check for a specific region
   */
  async healthCheckRegion(regionId) {
    const region = this.regions.get(regionId);
    if (!region) return null;

    const startTime = Date.now();

    try {
      const response = await this.httpRequest(region.endpoint + '/health', {
        timeout: 5000
      });

      const responseTime = Date.now() - startTime;
      region.health = 'healthy';
      region.lastHealthCheck = new Date().toISOString();

      return {
        regionId,
        status: 'healthy',
        responseTime,
        timestamp: region.lastHealthCheck
      };
    } catch (error) {
      region.health = 'unhealthy';
      region.lastHealthCheck = new Date().toISOString();

      return {
        regionId,
        status: 'unhealthy',
        error: error.message,
        timestamp: region.lastHealthCheck
      };
    }
  }

  /**
   * Perform HTTP request (with timeout)
   */
  httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const req = protocol.get(url, {
        timeout: options.timeout || 10000
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data });
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Check health of all regions
   */
  async checkAllRegionsHealth() {
    const results = [];
    for (const regionId of this.regions.keys()) {
      const result = await this.healthCheckRegion(regionId);
      results.push(result);
    }
    return results;
  }

  /**
   * Start periodic health checks
   */
  startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllRegionsHealth();
      await this.evaluateFailover();
    }, this.failoverConfig.healthCheckInterval);
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Evaluate and execute failover if needed
   */
  async evaluateFailover() {
    if (!this.failoverConfig.enabled || !this.failoverConfig.automaticFailover) {
      return;
    }

    const activeRegions = this.getActiveRegions();
    const currentRegion = this.regions.get(this.stats.activeRegion);

    // Check if current region is still healthy
    if (currentRegion && currentRegion.health === 'healthy') {
      return;
    }

    // Need to failover
    if (activeRegions.length > 0) {
      const newActive = activeRegions[0];
      await this.executeFailover(newActive.id);
    }
  }

  /**
   * Execute failover to a new region
   */
  async executeFailover(newRegionId) {
    const oldRegionId = this.stats.activeRegion;
    const newRegion = this.regions.get(newRegionId);

    if (!newRegion) {
      throw new Error(`Region ${newRegionId} not found`);
    }

    console.log(`[MultiRegion] Executing failover: ${oldRegionId} -> ${newRegionId}`);

    this.stats.activeRegion = newRegionId;
    this.stats.failovers++;
    this.stats.lastFailover = new Date().toISOString();

    return {
      success: true,
      from: oldRegionId,
      to: newRegionId,
      timestamp: this.stats.lastFailover
    };
  }

  /**
   * Route request to appropriate region (Geographic Load Balancing)
   */
  async routeRequest(path, options = {}) {
    this.stats.totalRequests++;

    const activeRegions = this.getActiveRegions();

    if (activeRegions.length === 0) {
      throw new Error('No healthy regions available');
    }

    // Weighted round-robin based on region weight
    const totalWeight = activeRegions.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;

    let selectedRegion = activeRegions[0];
    for (const region of activeRegions) {
      random -= region.weight;
      if (random <= 0) {
        selectedRegion = region;
        break;
      }
    }

    // Update stats
    this.stats.requestsByRegion[selectedRegion.id]++;

    // Make request to selected region
    try {
      const response = await this.httpRequest(
        selectedRegion.endpoint + path,
        options
      );

      return {
        success: true,
        region: selectedRegion.id,
        response: response.data
      };
    } catch (error) {
      // Try next region if failover is enabled
      if (this.failoverConfig.automaticFailover) {
        const remainingRegions = activeRegions.filter(r => r.id !== selectedRegion.id);
        for (const region of remainingRegions) {
          try {
            this.stats.requestsByRegion[region.id]++;
            const response = await this.httpRequest(
              region.endpoint + path,
              options
            );
            return {
              success: true,
              region: region.id,
              response: response.data,
              note: 'Failed over from ' + selectedRegion.id
            };
          } catch (e) {
            continue;
          }
        }
      }

      throw error;
    }
  }

  /**
   * Get CDN cache headers for static assets
   */
  getCDNHeaders(path) {
    if (!this.cdnConfig.enabled) {
      return {};
    }

    const isStatic = path.startsWith(this.cdnConfig.staticAssetsPath);

    if (isStatic) {
      return {
        'Cache-Control': `public, max-age=${this.cdnConfig.cacheTTL}`,
        'CDN-Cache-TTL': this.cdnConfig.cacheTTL.toString(),
        'Edge-Locations': this.cdnConfig.edgeLocations.join(',')
      };
    }

    return {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    };
  }

  /**
   * Replicate data to all regions
   */
  async replicateData(data, type = 'async') {
    if (!this.replicationConfig.enabled) {
      return { success: true, replicated: false };
    }

    const results = [];
    const regions = Array.from(this.regions.values())
      .filter(r => r.isActive && r.id !== this.stats.activeRegion);

    if (type === 'sync') {
      // Wait for all regions
      for (const region of regions) {
        try {
          await this.httpRequest(region.endpoint + '/api/replicate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          results.push({ region: region.id, success: true });
        } catch (error) {
          results.push({ region: region.id, success: false, error: error.message });
        }
      }
    } else {
      // Async replication - fire and forget
      for (const region of regions) {
        this.httpRequest(region.endpoint + '/api/replicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        }).catch(() => {});
        results.push({ region: region.id, success: true, async: true });
      }
    }

    return {
      success: results.every(r => r.success),
      replicated: true,
      strategy: type,
      results
    };
  }

  /**
   * Get region status
   */
  getRegionStatus(regionId) {
    return this.regions.get(regionId);
  }

  /**
   * Get all region statuses
   */
  getAllRegionStatuses() {
    return Array.from(this.regions.values()).map(r => ({
      id: r.id,
      name: r.name,
      endpoint: r.endpoint,
      isActive: r.isActive,
      health: r.health,
      lastHealthCheck: r.lastHealthCheck,
      weight: r.weight,
      priority: r.priority,
      requestsHandled: this.stats.requestsByRegion[r.id] || 0
    }));
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return {
      regions: this.getAllRegionStatuses(),
      cdn: this.cdnConfig,
      failover: this.failoverConfig,
      replication: this.replicationConfig,
      activeRegion: this.stats.activeRegion,
      stats: this.stats
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'MultiRegion',
      status: 'operational',
      version: '1.0.0',
      activeRegion: this.stats.activeRegion,
      healthyRegions: this.getActiveRegions().length,
      totalRegions: this.regions.size,
      cdnEnabled: this.cdnConfig.enabled,
      failoverEnabled: this.failoverConfig.enabled,
      replicationEnabled: this.replicationConfig.enabled,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.cdn) {
      this.cdnConfig = { ...this.cdnConfig, ...config.cdn };
    }
    if (config.failover) {
      this.failoverConfig = { ...this.failoverConfig, ...config.failover };
      this.startHealthChecks(); // Restart with new interval
    }
    if (config.replication) {
      this.replicationConfig = { ...this.replicationConfig, ...config.replication };
    }
    return this.getConfig();
  }
}

module.exports = MultiRegionService;