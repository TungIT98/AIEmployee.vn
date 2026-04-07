# Backup & Restoration Procedures

**Reference:** COM-132
**Last Updated:** 2026-04-03

---

## 3-2-1 Backup Strategy

Our backup strategy follows the 3-2-1 rule:

| Rule | Description |
|------|-------------|
| **3** | Three total copies of data |
| **2** | Two different media types/locations |
| **1** | One offsite/异地 backup |

### Backup Locations

| Location | Path | Purpose |
|----------|------|---------|
| Primary | `./backups` | Local primary storage |
| Secondary | `./backups/secondary` | Alternate media/mount point |
| Offsite | `./backups/offsite` | Cloud/restricted access storage |

---

## Backup Schedule

| Type | Frequency | Time | Cron Expression |
|------|-----------|------|------------------|
| Incremental | Daily | 2:00 AM | `0 2 * * *` |
| Full | Weekly | 3:00 AM Sunday | `0 3 * * 0` |
| Full | Monthly | 4:00 AM 1st | `0 4 1 * *` |
| Restoration Test | Monthly | 5:00 AM 15th | `0 5 15 * *` |

---

## Restoration Procedures

### Quick Restoration (Production)

```bash
# Navigate to API directory
cd api

# Run restoration test to verify backup availability
node src/services/backupScheduler.js test

# For manual restore, use the BackupService
node -e "
const BackupService = require('./src/services/backup');
const bs = new BackupService();
const result = bs.restore('BAK-F-20260403-0001');
console.log('Restored data:', result);
"
```

### Step-by-Step Restoration

#### 1. Identify the Backup to Restore

```javascript
// List all completed backups
const backups = backupService.getBackups({ status: 'completed' });
console.log(backups);

// Get specific backup
const backup = backupService.getBackup('BAK-F-20260403-0001');
```

#### 2. Verify Backup Integrity

```javascript
// Always verify before restoring
const verification = backupService.verifyBackup('BAK-F-20260403-0001');
console.log(verification);

// Verification checks:
// - Checksum validation
// - File existence in all 3 locations
// - Data corruption detection
```

#### 3. Perform Restoration

```javascript
// Restore from primary location
const result = backupService.restore('BAK-F-20260403-0001');
console.log(result);
// Returns: { success: true, data: {...}, source: 'primary' }
```

#### 4. Verify Restored Data

```javascript
// Validate restored data structure and content
if (result.success) {
  console.log('Restoration successful from:', result.source);
  console.log('Data timestamp:', result.data.timestamp);
}
```

---

## Monthly Restoration Testing

Restoration tests run automatically on the 15th of each month at 5:00 AM.

### Manual Test Execution

```bash
# Run restoration test manually
cd api
node src/services/backupScheduler.js test

# Run all backup types
node src/services/backupScheduler.js all
```

### Test Results

The restoration test:
1. Selects the latest full backup
2. Verifies backup integrity (checksum + file existence)
3. Performs a test restoration
4. Logs results with source location

---

## Backup Verification Checks

### Automatic Verification

The `verifyBackup()` method checks:

| Check | Description |
|-------|-------------|
| Primary location | File exists + checksum match |
| Secondary location | File exists + checksum match |
| Offsite location | File exists + checksum match |

### Manual Verification

```bash
# Check backup status
node -e "
const BackupService = require('./src/services/backup');
const bs = new BackupService();
console.log(bs.getStatus());
"
```

---

## Retention Policy

| Backup Type | Retention | Keep Days |
|-------------|-----------|-----------|
| Full | 12 months | ~360 days |
| Weekly | 4 weeks | ~28 days |
| Incremental | 7 days | ~7 days |

---

## Emergency Restoration (Disaster Recovery)

### Scenario: Complete Data Loss

1. **Stop the application** to prevent further data writes
2. **Identify the latest clean backup** using `getBackups()`
3. **Verify backup integrity** using `verifyBackup()`
4. **Restore data** using `restore()`
5. **Validate application state**
6. **Resume operations**

### Scenario: Corruption Detected

1. **Isolate affected systems**
2. **Identify uncorrupted backup** (check verification status)
3. **Restore from verified backup**
4. **Compare restored data with pre-corruption state**
5. **Resume with clean data**

---

## Backup Service API

### BackupService Methods

```javascript
// Create backups
createFullBackup(data, metadata)
createIncrementalBackup(data, baseBackupId, metadata)
createDifferentialBackup(data, baseBackupId, metadata)

// Restore & Verify
restore(backupId)
verifyBackup(backupId)

// Management
getBackup(backupId)
getBackups({ type, status, fromDate, toDate, limit, offset })
deleteBackup(backupId)
cleanup()

// Status & Config
getStatus()
getStatistics()
getSchedule()
getConfig()
updateConfig(newConfig)
```

---

## Monitoring

### Backup Statistics

```javascript
const stats = backupService.getStatistics();
// Returns: { totalBackups, totalSize, byType, byStatus, lastBackup, lastRestore }
```

### Storage Monitoring

Monitor backup directory sizes:
- Primary: `BACKUP_LOCAL_PATH` (default: `./backups`)
- Secondary: `BACKUP_SECONDARY_PATH` (default: `./backups/secondary`)
- Offsite: `BACKUP_OFFSITE_PATH` (default: `./backups/offsite`)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Backup failed | Check disk space, permissions, file locks |
| Checksum mismatch | Run verification, restore from alternate location |
| Missing offsite backup | Verify offsite path configuration and network |
| Scheduler not running | Check cron service status, timezone settings |

---

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKUP_LOCAL_PATH` | `./backups` | Primary backup location |
| `BACKUP_SECONDARY_PATH` | `./backups/secondary` | Secondary backup location |
| `BACKUP_OFFSITE_PATH` | `./backups/offsite` | Offsite backup location |