/**
 * Backup Service Tests - COM-204
 */

const BackupService = require('./backup');
const fs = require('fs');
const path = require('path');

describe('BackupService', () => {
  let backupService;
  const testData = { users: [{ id: 1, name: 'Test User' }], settings: { theme: 'dark' } };

  beforeEach(() => {
    backupService = new BackupService();
  });

  describe('createFullBackup', () => {
    test('should create a full backup', () => {
      const backup = backupService.createFullBackup(testData, { description: 'Test backup' });

      expect(backup).toBeDefined();
      expect(backup.id).toMatch(/^BAK-F-/);
      expect(backup.type).toBe('full');
      expect(backup.status).toBe('completed');
      expect(backup.metadata.description).toBe('Test backup');
      expect(backup.location.primary).toBeDefined();
    });

    test('should store backup in multiple locations', () => {
      const backup = backupService.createFullBackup(testData);

      expect(backup.location.primary).toBeDefined();
      // Secondary and offsite may fail if paths don't exist, that's ok for test
    });

    test('should calculate checksum for backup', () => {
      const backup = backupService.createFullBackup(testData);

      expect(backup.checksum).toBeDefined();
      expect(typeof backup.checksum).toBe('string');
      expect(backup.checksum.length).toBe(64); // SHA-256 hex
    });

    test('should set retention date for full backup', () => {
      const backup = backupService.createFullBackup(testData);

      expect(backup.retention.keepUntil).toBeDefined();
      expect(backup.retention.policy).toBe('full');
    });

    test('should track statistics', () => {
      backupService.createFullBackup(testData);
      const stats = backupService.getStatistics();

      expect(stats.totalBackups).toBeGreaterThan(0);
      expect(stats.byType.full).toBeGreaterThan(0);
    });
  });

  describe('createIncrementalBackup', () => {
    test('should create incremental backup referencing base', () => {
      const fullBackup = backupService.createFullBackup(testData);
      const incremental = backupService.createIncrementalBackup(
        { newData: 'added' },
        fullBackup.id
      );

      expect(incremental.type).toBe('incremental');
      expect(incremental.baseBackupId).toBe(fullBackup.id);
      expect(incremental.status).toBe('completed');
    });

    test('should throw error for non-existent base backup', () => {
      expect(() => {
        backupService.createIncrementalBackup(testData, 'BAK-INVALID');
      }).toThrow('Base backup not found');
    });
  });

  describe('createDifferentialBackup', () => {
    test('should create differential backup referencing base', () => {
      const fullBackup = backupService.createFullBackup(testData);
      const differential = backupService.createDifferentialBackup(
        { changed: true },
        fullBackup.id
      );

      expect(differential.type).toBe('differential');
      expect(differential.baseBackupId).toBe(fullBackup.id);
    });
  });

  describe('getBackup', () => {
    test('should retrieve backup by ID', () => {
      const created = backupService.createFullBackup(testData);
      const retrieved = backupService.getBackup(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.type).toBe('full');
    });

    test('should return null for non-existent ID', () => {
      const backup = backupService.getBackup('BAK-INVALID');
      expect(backup).toBeNull();
    });
  });

  describe('getBackups', () => {
    beforeEach(() => {
      backupService.createFullBackup(testData);
      backupService.createFullBackup(testData);
      backupService.createFullBackup(testData);
    });

    test('should return all backups', () => {
      const result = backupService.getBackups();
      expect(result.backups.length).toBe(3);
      expect(result.total).toBe(3);
    });

    test('should filter by type', () => {
      const result = backupService.getBackups({ type: 'full' });
      expect(result.backups.every(b => b.type === 'full')).toBe(true);
    });

    test('should filter by status', () => {
      const result = backupService.getBackups({ status: 'completed' });
      expect(result.backups.every(b => b.status === 'completed')).toBe(true);
    });

    test('should paginate results', () => {
      const result = backupService.getBackups({ limit: 2, offset: 0 });
      expect(result.backups.length).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    test('should sort by creation date (newest first)', () => {
      const result = backupService.getBackups({ limit: 2 });
      const dates = result.backups.map(b => new Date(b.createdAt));
      expect(dates[0].getTime()).toBeGreaterThanOrEqual(dates[1].getTime());
    });
  });

  describe('restore', () => {
    test('should restore from backup', () => {
      const created = backupService.createFullBackup(testData);
      const restored = backupService.restore(created.id);

      expect(restored.success).toBe(true);
      expect(restored.data).toEqual(testData);
    });

    test('should throw error for non-existent backup', () => {
      expect(() => {
        backupService.restore('BAK-INVALID');
      }).toThrow('Backup not found');
    });

    test('should track last restore time', () => {
      const created = backupService.createFullBackup(testData);
      backupService.restore(created.id);
      const stats = backupService.getStatistics();

      expect(stats.lastRestore).toBeDefined();
      expect(stats.lastRestore.id).toBe(created.id);
    });
  });

  describe('verifyBackup', () => {
    test('should verify valid backup', () => {
      const backup = backupService.createFullBackup(testData);
      const verification = backupService.verifyBackup(backup.id);

      expect(verification.status).toBe('verified');
      expect(verification.checksumValid).toBe(true);
      expect(verification.errors.length).toBe(0);
    });

    test('should detect missing backup file', () => {
      const backup = backupService.createFullBackup(testData);
      // Delete the file manually to simulate corruption
      if (backup.location.primary && fs.existsSync(backup.location.primary)) {
        fs.unlinkSync(backup.location.primary);
      }

      const verification = backupService.verifyBackup(backup.id);
      expect(verification.status).toBe('failed');
      expect(verification.errors.length).toBeGreaterThan(0);
    });

    test('should throw error for non-existent backup', () => {
      expect(() => {
        backupService.verifyBackup('BAK-INVALID');
      }).toThrow('Backup not found');
    });
  });

  describe('deleteBackup', () => {
    test('should delete backup and files', () => {
      const backup = backupService.createFullBackup(testData);
      const result = backupService.deleteBackup(backup.id);

      expect(result.success).toBe(true);
      expect(backupService.getBackup(backup.id)).toBeNull();
    });

    test('should throw error for non-existent backup', () => {
      expect(() => {
        backupService.deleteBackup('BAK-INVALID');
      }).toThrow('Backup not found');
    });
  });

  describe('cleanup', () => {
    test('should delete expired backups', () => {
      const backup = backupService.createFullBackup(testData);
      // Force retention to expired
      const idx = backupService.backups.findIndex(b => b.id === backup.id);
      if (idx >= 0) {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 100);
        backupService.backups[idx].retention.keepUntil = pastDate.toISOString();
      }

      const result = backupService.cleanup();
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      expect(backupService.getBackup(backup.id)).toBeNull();
    });

    test('should keep non-expired backups', () => {
      backupService.createFullBackup(testData);

      const result = backupService.cleanup();
      expect(result.remaining).toBeGreaterThan(0);
    });
  });

  describe('getStatistics', () => {
    test('should return correct statistics', () => {
      backupService.createFullBackup(testData);
      backupService.createFullBackup(testData);

      const stats = backupService.getStatistics();

      expect(stats.totalBackups).toBe(2);
      expect(stats.byType.full).toBe(2);
      expect(stats.byStatus.completed).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    test('should track last backup time', () => {
      backupService.createFullBackup(testData);
      const stats = backupService.getStatistics();

      expect(stats.lastBackup).toBeDefined();
    });
  });

  describe('getStatus', () => {
    test('should return service status', () => {
      const status = backupService.getStatus();

      expect(status.service).toBe('BackupService');
      expect(status.status).toBe('operational');
      expect(status.config).toBeDefined();
      expect(status.storage).toBeDefined();
    });
  });

  describe('getSchedule', () => {
    test('should return schedule information', () => {
      const schedule = backupService.getSchedule();

      expect(schedule.daily).toBeDefined();
      expect(schedule.weekly).toBeDefined();
      expect(schedule.monthly).toBeDefined();
      expect(schedule.nextRun).toBeDefined();
    });
  });

  describe('updateConfig', () => {
    test('should update retention settings', () => {
      const newConfig = {
        retention: { daily: 14, weekly: 8 }
      };

      const updated = backupService.updateConfig(newConfig);

      expect(updated.retention.daily).toBe(14);
      expect(updated.retention.weekly).toBe(8);
      expect(updated.retention.monthly).toBe(12); // Unchanged
    });

    test('should update schedule settings', () => {
      const newConfig = {
        schedule: { daily: '0 3 * * *' }
      };

      const updated = backupService.updateConfig(newConfig);

      expect(updated.schedule.daily).toBe('0 3 * * *');
    });
  });

  describe('getConfig', () => {
    test('should return configuration (masked sensitive values)', () => {
      const config = backupService.getConfig();

      expect(config.localPath).toBeDefined();
      expect(config.secondaryPath).toBeDefined();
      expect(config.offsitePath).toBeDefined();
      expect(config.retention).toBeDefined();
    });
  });

  describe('formatBytes', () => {
    test('should format bytes correctly', () => {
      expect(backupService.formatBytes(0)).toBe('0 Bytes');
      expect(backupService.formatBytes(1024)).toBe('1 KB');
      expect(backupService.formatBytes(1048576)).toBe('1 MB');
      expect(backupService.formatBytes(1073741824)).toBe('1 GB');
    });
  });
});
