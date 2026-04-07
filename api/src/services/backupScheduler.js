/**
 * Backup Scheduler - COM-132
 * Automated backup scheduling for 3-2-1 backup strategy
 */

const cron = require('node-cron');
const BackupService = require('./backup');

class BackupScheduler {
  constructor(backupService = null) {
    this.backupService = backupService || new BackupService();
    this.scheduledTasks = [];
    this.isRunning = false;

    // Schedule configuration
    this.schedules = {
      daily: '0 2 * * *',      // 2 AM daily
      weekly: '0 3 * * 0',      // 3 AM Sunday
      monthly: '0 4 1 * *',     // 4 AM 1st of month
      restorationTest: '0 5 15 * *' // 5 AM 15th of month (monthly restoration test)
    };
  }

  /**
   * Get data to backup (hook for customization)
   */
  async getBackupData() {
    // This should be customized based on what data needs to be backed up
    // For now, returns sample data structure
    return {
      timestamp: new Date().toISOString(),
      systemState: 'sample',
      // Add actual data sources here (database, files, etc.)
    };
  }

  /**
   * Run daily incremental backup
   */
  async runDailyBackup() {
    const method = 'daily';
    console.log(`[BackupScheduler] Starting ${method} backup at ${new Date().toISOString()}`);

    try {
      const data = await this.getBackupData();

      // Find the latest full backup to base incremental on
      const backups = this.backupService.getBackups({ type: 'full', limit: 1 });
      const baseBackupId = backups.backups.length > 0 ? backups.backups[0].id : null;

      let backup;
      if (baseBackupId) {
        backup = this.backupService.createIncrementalBackup(data, baseBackupId, {
          description: `Daily incremental backup`,
          tags: ['scheduled', 'daily']
        });
      } else {
        // No full backup exists, create one
        backup = this.backupService.createFullBackup(data, {
          description: `Daily backup (no prior full found)`,
          tags: ['scheduled', 'daily']
        });
      }

      console.log(`[BackupScheduler] ${method} backup completed: ${backup.id}`);
      return backup;
    } catch (error) {
      console.error(`[BackupScheduler] ${method} backup failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run weekly full backup
   */
  async runWeeklyBackup() {
    const method = 'weekly';
    console.log(`[BackupScheduler] Starting ${method} backup at ${new Date().toISOString()}`);

    try {
      const data = await this.getBackupData();
      const backup = this.backupService.createFullBackup(data, {
        description: `Weekly full backup`,
        tags: ['scheduled', 'weekly']
      });

      console.log(`[BackupScheduler] ${method} backup completed: ${backup.id}`);
      return backup;
    } catch (error) {
      console.error(`[BackupScheduler] ${method} backup failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run monthly full backup
   */
  async runMonthlyBackup() {
    const method = 'monthly';
    console.log(`[BackupScheduler] Starting ${method} backup at ${new Date().toISOString()}`);

    try {
      const data = await this.getBackupData();
      const backup = this.backupService.createFullBackup(data, {
        description: `Monthly full backup (end of month)`,
        tags: ['scheduled', 'monthly']
      });

      console.log(`[BackupScheduler] ${method} backup completed: ${backup.id}`);
      return backup;
    } catch (error) {
      console.error(`[BackupScheduler] ${method} backup failed:`, error.message);
      throw error;
    }
  }

  /**
   * Run restoration test (monthly)
   */
  async runRestorationTest() {
    const method = 'restoration-test';
    console.log(`[BackupScheduler] Starting ${method} at ${new Date().toISOString()}`);

    try {
      // Get latest full backup
      const backups = this.backupService.getBackups({ type: 'full', status: 'completed', limit: 1 });

      if (backups.backups.length === 0) {
        console.log(`[BackupScheduler] No completed full backup found for restoration test`);
        return { success: false, reason: 'No backup found' };
      }

      const latestBackup = backups.backups[0];
      console.log(`[BackupScheduler] Testing restoration of backup: ${latestBackup.id}`);

      // Verify backup integrity first
      const verification = this.backupService.verifyBackup(latestBackup.id);
      console.log(`[BackupScheduler] Verification result: ${verification.status}`);

      if (verification.status !== 'verified') {
        console.error(`[BackupScheduler] Backup verification failed:`, verification.errors);
        return {
          success: false,
          backupId: latestBackup.id,
          verification,
          error: 'Verification failed'
        };
      }

      // Attempt restoration
      const restoreResult = this.backupService.restore(latestBackup.id);
      console.log(`[BackupScheduler] Restoration test successful: ${latestBackup.id}`);

      return {
        success: true,
        backupId: latestBackup.id,
        verification,
        restoreSource: restoreResult.source,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[BackupScheduler] Restoration test failed:`, error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.isRunning) {
      console.log('[BackupScheduler] Already running');
      return;
    }

    console.log('[BackupScheduler] Starting backup scheduler...');

    // Schedule daily incremental backup
    this.scheduledTasks.push(
      cron.schedule(this.schedules.daily, async () => {
        await this.runDailyBackup();
      }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
      })
    );

    // Schedule weekly full backup
    this.scheduledTasks.push(
      cron.schedule(this.schedules.weekly, async () => {
        await this.runWeeklyBackup();
      }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
      })
    );

    // Schedule monthly full backup
    this.scheduledTasks.push(
      cron.schedule(this.schedules.monthly, async () => {
        await this.runMonthlyBackup();
      }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
      })
    );

    // Schedule monthly restoration test
    this.scheduledTasks.push(
      cron.schedule(this.schedules.restorationTest, async () => {
        await this.runRestorationTest();
      }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
      })
    );

    this.isRunning = true;
    console.log('[BackupScheduler] Scheduler started with schedules:', this.schedules);
  }

  /**
   * Stop the scheduler
   */
  stop() {
    console.log('[BackupScheduler] Stopping scheduler...');
    for (const task of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks = [];
    this.isRunning = false;
    console.log('[BackupScheduler] Scheduler stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedules: this.schedules,
      scheduledTasksCount: this.scheduledTasks.length,
      lastBackup: this.backupService.stats.lastBackup,
      lastRestore: this.backupService.stats.lastRestore
    };
  }

  /**
   * Run all backup types manually (for testing)
   */
  async runAllBackups() {
    console.log('[BackupScheduler] Running all backup types manually...');
    const results = {
      daily: await this.runDailyBackup(),
      weekly: await this.runWeeklyBackup(),
      monthly: await this.runMonthlyBackup(),
      restorationTest: await this.runRestorationTest()
    };
    return results;
  }
}

// Run as standalone if called directly
if (require.main === module) {
  const scheduler = new BackupScheduler();

  console.log('[BackupScheduler] Running in standalone mode...');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      scheduler.start();
      console.log('[BackupScheduler] Scheduler running. Press Ctrl+C to stop.');
      break;

    case 'daily':
      scheduler.runDailyBackup().then(() => process.exit(0));
      break;

    case 'weekly':
      scheduler.runWeeklyBackup().then(() => process.exit(0));
      break;

    case 'monthly':
      scheduler.runMonthlyBackup().then(() => process.exit(0));
      break;

    case 'test':
      scheduler.runRestorationTest().then(() => process.exit(0));
      break;

    case 'all':
      scheduler.runAllBackups().then(() => process.exit(0));
      break;

    case 'status':
      console.log('[BackupScheduler] Status:', scheduler.getStatus());
      break;

    default:
      console.log('[BackupScheduler] Unknown command:', command);
      console.log('Usage: node backupScheduler.js [start|daily|weekly|monthly|test|all|status]');
  }
}

module.exports = BackupScheduler;