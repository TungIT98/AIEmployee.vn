/**
 * Backup Service - COM-204
 * 3-2-1 Backup Strategy: 3 copies, 2 media types, 1 offsite
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupService {
  constructor() {
    // In-memory backup metadata storage
    this.backups = [];
    this.backupIdCounter = 1;

    // Storage configuration (3-2-1 strategy)
    this.config = {
      // Primary local storage
      localPath: process.env.BACKUP_LOCAL_PATH || './backups',
      // Secondary storage (could be different mount/USB)
      secondaryPath: process.env.BACKUP_SECONDARY_PATH || './backups/secondary',
      // Offsite storage (cloud/restricted access)
      offsitePath: process.env.BACKUP_OFFSITE_PATH || './backups/offsite',
      // Retention policies
      retention: {
        daily: 7,      // Keep 7 daily backups
        weekly: 4,      // Keep 4 weekly backups
        monthly: 12     // Keep 12 monthly backups
      },
      // Backup schedule
      schedule: {
        daily: '0 2 * * *',      // 2 AM daily
        weekly: '0 3 * * 0',     // 3 AM Sunday
        monthly: '0 4 1 * *'      // 4 AM 1st of month
      },
      // Compression settings
      compression: {
        enabled: true,
        algorithm: 'gzip',
        level: 6
      },
      // Encryption settings
      encryption: {
        enabled: false,
        algorithm: 'aes-256-cbc'
      }
    };

    // Backup statistics
    this.stats = {
      totalBackups: 0,
      totalSize: 0,
      byType: { full: 0, incremental: 0, differential: 0 },
      byStatus: { completed: 0, failed: 0, running: 0 },
      lastBackup: null,
      lastRestore: null
    };

    // Ensure directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure backup directories exist
   */
  ensureDirectories() {
    const dirs = [this.config.localPath, this.config.secondaryPath, this.config.offsitePath];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        try {
          fs.mkdirSync(dir, { recursive: true });
        } catch (e) {
          // Directory creation may fail if path is external
        }
      }
    }
  }

  /**
   * Generate backup ID
   */
  generateBackupId(type, timestamp = new Date()) {
    const date = timestamp.toISOString().replace(/[-:T]/g, '').slice(0, 8);
    return `BAK-${type.charAt(0).toUpperCase()}-${date}-${String(this.backupIdCounter++).padStart(4, '0')}`;
  }

  /**
   * Calculate file checksum
   */
  calculateChecksum(filePath) {
    try {
      const content = fs.readFileSync(filePath);
      return crypto.createHash('sha256').update(content).digest('hex');
    } catch (e) {
      return null;
    }
  }

  /**
   * Compress data (mock implementation)
   */
  compress(data) {
    // In production, use zlib or similar
    return Buffer.from(JSON.stringify(data), 'utf8');
  }

  /**
   * Encrypt data (mock implementation)
   */
  encrypt(data, key) {
    if (!this.config.encryption.enabled) return data;
    // In production, use crypto module with proper key management
    return data;
  }

  /**
   * Create a full backup
   */
  createFullBackup(data, metadata = {}) {
    const timestamp = new Date();
    const backupId = this.generateBackupId('full', timestamp);

    const backup = {
      id: backupId,
      type: 'full',
      status: 'running',
      createdAt: timestamp.toISOString(),
      startedAt: timestamp.toISOString(),
      completedAt: null,
      size: 0,
      checksum: null,
      location: {
        primary: null,
        secondary: null,
        offsite: null
      },
      metadata: {
        ...metadata,
        description: metadata.description || 'Full backup',
        tags: metadata.tags || []
      },
      retention: {
        keepUntil: this.calculateRetentionDate('full'),
        policy: 'full'
      },
      error: null
    };

    this.backups.push(backup);
    this.stats.byStatus.running++;

    try {
      // Compress data
      const compressed = this.compress(data);

      // Write to primary location
      const primaryPath = path.join(this.config.localPath, `${backupId}.json`);
      fs.writeFileSync(primaryPath, compressed);
      backup.location.primary = primaryPath;
      backup.size = fs.statSync(primaryPath).size;

      // Copy to secondary location (simulated)
      const secondaryPath = path.join(this.config.secondaryPath, `${backupId}.json`);
      try {
        fs.writeFileSync(secondaryPath, compressed);
        backup.location.secondary = secondaryPath;
      } catch (e) {
        // Secondary write failed - log but continue
      }

      // Copy to offsite location (simulated)
      const offsitePath = path.join(this.config.offsitePath, `${backupId}.json`);
      try {
        fs.writeFileSync(offsitePath, compressed);
        backup.location.offsite = offsitePath;
      } catch (e) {
        // Offsite write failed - log but continue
      }

      // Calculate checksum
      backup.checksum = this.calculateChecksum(primaryPath);

      // Update status
      backup.status = 'completed';
      backup.completedAt = new Date().toISOString();

      // Update stats
      this.stats.byStatus.running--;
      this.stats.byStatus.completed++;
      this.stats.totalBackups++;
      this.stats.totalSize += backup.size;
      this.stats.lastBackup = { id: backupId, type: 'full', timestamp: backup.completedAt };

    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      this.stats.byStatus.running--;
      this.stats.byStatus.failed++;
    }

    return backup;
  }

  /**
   * Create an incremental backup
   */
  createIncrementalBackup(data, baseBackupId, metadata = {}) {
    const timestamp = new Date();
    const backupId = this.generateBackupId('incremental', timestamp);

    // Find base backup
    const baseBackup = this.backups.find(b => b.id === baseBackupId);
    if (!baseBackup) {
      throw new Error('Base backup not found');
    }

    const backup = {
      id: backupId,
      type: 'incremental',
      status: 'running',
      createdAt: timestamp.toISOString(),
      startedAt: timestamp.toISOString(),
      completedAt: null,
      size: 0,
      checksum: null,
      baseBackupId,
      location: {
        primary: null,
        secondary: null,
        offsite: null
      },
      metadata: {
        ...metadata,
        description: metadata.description || 'Incremental backup',
        tags: metadata.tags || []
      },
      retention: {
        keepUntil: this.calculateRetentionDate('incremental'),
        policy: 'incremental'
      },
      error: null
    };

    this.backups.push(backup);
    this.stats.byStatus.running++;

    try {
      // Compress data
      const compressed = this.compress(data);

      // Write to primary location
      const primaryPath = path.join(this.config.localPath, `${backupId}.json`);
      fs.writeFileSync(primaryPath, compressed);
      backup.location.primary = primaryPath;
      backup.size = fs.statSync(primaryPath).size;

      // Copy to secondary
      const secondaryPath = path.join(this.config.secondaryPath, `${backupId}.json`);
      try {
        fs.writeFileSync(secondaryPath, compressed);
        backup.location.secondary = secondaryPath;
      } catch (e) {}

      // Calculate checksum
      backup.checksum = this.calculateChecksum(primaryPath);

      backup.status = 'completed';
      backup.completedAt = new Date().toISOString();

      this.stats.byStatus.running--;
      this.stats.byStatus.completed++;
      this.stats.totalBackups++;
      this.stats.totalSize += backup.size;
      this.stats.lastBackup = { id: backupId, type: 'incremental', timestamp: backup.completedAt };

    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      this.stats.byStatus.running--;
      this.stats.byStatus.failed++;
    }

    return backup;
  }

  /**
   * Create a differential backup
   */
  createDifferentialBackup(data, baseBackupId, metadata = {}) {
    const timestamp = new Date();
    const backupId = this.generateBackupId('differential', timestamp);

    const baseBackup = this.backups.find(b => b.id === baseBackupId);
    if (!baseBackup) {
      throw new Error('Base backup not found');
    }

    const backup = {
      id: backupId,
      type: 'differential',
      status: 'running',
      createdAt: timestamp.toISOString(),
      startedAt: timestamp.toISOString(),
      completedAt: null,
      size: 0,
      checksum: null,
      baseBackupId,
      location: {
        primary: null,
        secondary: null,
        offsite: null
      },
      metadata: {
        ...metadata,
        description: metadata.description || 'Differential backup',
        tags: metadata.tags || []
      },
      retention: {
        keepUntil: this.calculateRetentionDate('differential'),
        policy: 'differential'
      },
      error: null
    };

    this.backups.push(backup);
    this.stats.byStatus.running++;

    try {
      const compressed = this.compress(data);

      const primaryPath = path.join(this.config.localPath, `${backupId}.json`);
      fs.writeFileSync(primaryPath, compressed);
      backup.location.primary = primaryPath;
      backup.size = fs.statSync(primaryPath).size;

      const secondaryPath = path.join(this.config.secondaryPath, `${backupId}.json`);
      try {
        fs.writeFileSync(secondaryPath, compressed);
        backup.location.secondary = secondaryPath;
      } catch (e) {}

      backup.checksum = this.calculateChecksum(primaryPath);

      backup.status = 'completed';
      backup.completedAt = new Date().toISOString();

      this.stats.byStatus.running--;
      this.stats.byStatus.completed++;
      this.stats.totalBackups++;
      this.stats.totalSize += backup.size;
      this.stats.lastBackup = { id: backupId, type: 'differential', timestamp: backup.completedAt };

    } catch (error) {
      backup.status = 'failed';
      backup.error = error.message;
      this.stats.byStatus.running--;
      this.stats.byStatus.failed++;
    }

    return backup;
  }

  /**
   * Calculate retention date based on backup type
   */
  calculateRetentionDate(type) {
    const now = new Date();
    let keepDays;

    switch (type) {
      case 'full':
        keepDays = this.config.retention.monthly * 30;
        break;
      case 'weekly':
        keepDays = this.config.retention.weekly * 7;
        break;
      case 'incremental':
      case 'differential':
        keepDays = this.config.retention.daily || 7;
        break;
      default:
        keepDays = this.config.retention.daily;
    }

    const keepUntil = new Date(now);
    keepUntil.setDate(keepUntil.getDate() + keepDays);
    return keepUntil.toISOString();
  }

  /**
   * Get backup by ID
   */
  getBackup(backupId) {
    return this.backups.find(b => b.id === backupId) || null;
  }

  /**
   * List all backups with filtering
   */
  getBackups({ type, status, fromDate, toDate, limit = 100, offset = 0 } = {}) {
    let filtered = [...this.backups];

    if (type) {
      filtered = filtered.filter(b => b.type === type);
    }
    if (status) {
      filtered = filtered.filter(b => b.status === status);
    }
    if (fromDate) {
      filtered = filtered.filter(b => new Date(b.createdAt) >= new Date(fromDate));
    }
    if (toDate) {
      filtered = filtered.filter(b => new Date(b.createdAt) <= new Date(toDate));
    }

    // Sort by creation date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      backups: paginated,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Restore from backup
   */
  restore(backupId) {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }
    if (backup.status !== 'completed') {
      throw new Error('Cannot restore incomplete backup');
    }

    try {
      // Read from primary location
      if (!backup.location.primary || !fs.existsSync(backup.location.primary)) {
        // Try secondary
        if (backup.location.secondary && fs.existsSync(backup.location.secondary)) {
          const content = fs.readFileSync(backup.location.secondary);
          this.stats.lastRestore = { id: backupId, timestamp: new Date().toISOString() };
          return { success: true, data: JSON.parse(content.toString()), source: 'secondary' };
        }
        throw new Error('Backup file not found in any location');
      }

      const content = fs.readFileSync(backup.location.primary);
      this.stats.lastRestore = { id: backupId, timestamp: new Date().toISOString() };
      return { success: true, data: JSON.parse(content.toString()), source: 'primary' };

    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * Verify backup integrity
   */
  verifyBackup(backupId) {
    const backup = this.getBackup(backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const verification = {
      backupId,
      status: 'pending',
      locations: {},
      checksumValid: false,
      errors: []
    };

    // Verify each location
    const locations = ['primary', 'secondary', 'offsite'];
    for (const loc of locations) {
      const locPath = backup.location[loc];
      if (!locPath) {
        verification.locations[loc] = { status: 'not_configured' };
        continue;
      }

      try {
        if (fs.existsSync(locPath)) {
          const fileChecksum = this.calculateChecksum(locPath);
          const isValid = fileChecksum === backup.checksum;
          verification.locations[loc] = {
            status: isValid ? 'valid' : 'corrupted',
            checksum: fileChecksum,
            expected: backup.checksum
          };
          if (!isValid) {
            verification.errors.push(`${loc}: checksum mismatch`);
          }
        } else {
          verification.locations[loc] = { status: 'missing' };
          verification.errors.push(`${loc}: file not found`);
        }
      } catch (e) {
        verification.locations[loc] = { status: 'error', error: e.message };
        verification.errors.push(`${loc}: ${e.message}`);
      }
    }

    verification.checksumValid = verification.errors.length === 0;
    verification.status = verification.errors.length === 0 ? 'verified' : 'failed';

    return verification;
  }

  /**
   * Delete a backup
   */
  deleteBackup(backupId) {
    const index = this.backups.findIndex(b => b.id === backupId);
    if (index === -1) {
      throw new Error('Backup not found');
    }

    const backup = this.backups[index];

    // Delete files from all locations
    const locations = ['primary', 'secondary', 'offsite'];
    for (const loc of locations) {
      const locPath = backup.location[loc];
      if (locPath && fs.existsSync(locPath)) {
        try {
          fs.unlinkSync(locPath);
        } catch (e) {
          // Log but continue
        }
      }
    }

    // Update stats
    this.stats.totalBackups--;
    this.stats.totalSize -= backup.size;
    this.stats.byType[backup.type]--;

    this.backups.splice(index, 1);
    return { success: true, message: 'Backup deleted' };
  }

  /**
   * Cleanup expired backups based on retention policy
   */
  cleanup() {
    const now = new Date();
    const results = {
      deleted: 0,
      remaining: 0,
      errors: []
    };

    const toDelete = [];

    for (const backup of this.backups) {
      if (backup.status !== 'completed') continue;

      const keepUntil = new Date(backup.retention.keepUntil);
      if (keepUntil < now) {
        toDelete.push(backup.id);
      }
    }

    for (const id of toDelete) {
      try {
        this.deleteBackup(id);
        results.deleted++;
      } catch (e) {
        results.errors.push(`${id}: ${e.message}`);
      }
    }

    results.remaining = this.backups.length;
    return results;
  }

  /**
   * Get backup statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      totalBackups: this.backups.length,
      totalSize: this.backups.reduce((sum, b) => sum + b.size, 0),
      byType: {
        full: this.backups.filter(b => b.type === 'full').length,
        incremental: this.backups.filter(b => b.type === 'incremental').length,
        differential: this.backups.filter(b => b.type === 'differential').length
      },
      byStatus: {
        completed: this.backups.filter(b => b.status === 'completed').length,
        failed: this.backups.filter(b => b.status === 'failed').length,
        running: this.backups.filter(b => b.status === 'running').length
      }
    };
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      service: 'BackupService',
      status: 'operational',
      version: '1.0.0',
      config: {
        localPath: this.config.localPath,
        secondaryPath: this.config.secondaryPath,
        offsitePath: this.config.offsitePath,
        retention: this.config.retention
      },
      storage: {
        totalBackups: this.backups.length,
        totalSize: this.stats.totalSize,
        formattedSize: this.formatBytes(this.stats.totalSize)
      },
      stats: this.getStatistics(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get backup schedule info
   */
  getSchedule() {
    return {
      daily: this.config.schedule.daily,
      weekly: this.config.schedule.weekly,
      monthly: this.config.schedule.monthly,
      nextRun: this.calculateNextRun()
    };
  }

  /**
   * Calculate next backup run time (simplified)
   */
  calculateNextRun() {
    const now = new Date();
    const daily = new Date(now);
    daily.setHours(2, 0, 0, 0);
    if (daily <= now) daily.setDate(daily.getDate() + 1);
    return daily.toISOString();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    if (newConfig.retention) {
      this.config.retention = { ...this.config.retention, ...newConfig.retention };
    }
    if (newConfig.schedule) {
      this.config.schedule = { ...this.config.schedule, ...newConfig.schedule };
    }
    if (newConfig.compression) {
      this.config.compression = { ...this.config.compression, ...newConfig.compression };
    }
    if (newConfig.encryption) {
      this.config.encryption = { ...this.config.encryption, ...newConfig.encryption };
    }
    return this.config;
  }

  /**
   * Get configuration
   */
  getConfig() {
    return {
      ...this.config,
      // Mask sensitive values
      encryption: {
        ...this.config.encryption,
        key: this.config.encryption.enabled ? '***' : null
      }
    };
  }
}

module.exports = BackupService;
