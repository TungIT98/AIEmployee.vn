const express = require('express');
const winston = require('winston');
const archiver = require('archiver');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const app = express();

// Configuration
const BACKUP_PROVIDER = process.env.BACKUP_PROVIDER || 's3';
const BACKUP_REGION = process.env.BACKUP_REGION || 'us-east-1';
const BACKUP_BUCKET = process.env.BACKUP_BUCKET;
const ES_HOST = process.env.ES_HOST || 'http://elasticsearch-master:9200';
const ES_USER = process.env.ES_USER || 'elastic';
const ES_PASSWORD = process.env.ES_PASSWORD;

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize S3 client
let s3Client = null;
if (BACKUP_PROVIDER === 's3' && BACKUP_BUCKET) {
  s3Client = new S3Client({
    region: BACKUP_REGION
  });
}

// Middleware
app.use(express.json());

// Backup state
let lastBackup = null;
let lastBackupStatus = null;
let isRunning = false;

// Perform Elasticsearch snapshot backup
async function performElasticsearchBackup() {
  logger.info('Starting Elasticsearch backup');

  try {
    // Create snapshot repository if not exists
    const repoExists = await fetch(`${ES_HOST}/_snapshot/backup`, {
      headers: { 'Authorization': `Basic ${Buffer.from(`${ES_USER}:${ES_PASSWORD}`).toString('base64')}` }
    }).then(r => r.ok);

    if (!repoExists) {
      // Create S3 repository
      await fetch(`${ES_HOST}/_snapshot/backup`, {
        method: 'PUT',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${ES_USER}:${ES_PASSWORD}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 's3',
          settings: {
            bucket: BACKUP_BUCKET,
            region: BACKUP_REGION,
            compress: true
          }
        })
      });
    }

    // Create snapshot
    const snapshotName = `backup-${Date.now()}`;
    const response = await fetch(`${ES_HOST}/_snapshot/backup/${snapshotName}?wait_for_completion=true`, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${ES_USER}:${ES_PASSWORD}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        indices: ['.kibana', 'logs-*', 'metrics-*'],
        include_global_state: false
      })
    });

    const result = await response.json();
    logger.info('Elasticsearch backup completed', { snapshotName, result });

    // Upload to S3
    if (s3Client) {
      const backupKey = `backups/es-snapshots/${snapshotName}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: BACKUP_BUCKET,
        Key: backupKey,
        Body: JSON.stringify(result),
        ContentType: 'application/json'
      }));
      logger.info('Backup uploaded to S3', { bucket: BACKUP_BUCKET, key: backupKey });
    }

    return { success: true, snapshotName, result };
  } catch (error) {
    logger.error('Elasticsearch backup failed', { error: error.message });
    return { success: false, error: error.message };
  }
}

// File system backup
async function performFilesystemBackup(sourcePaths) {
  logger.info('Starting filesystem backup', { sourcePaths });

  return new Promise((resolve, reject) => {
    const archive = archiver('tar', { gzip: true });
    const chunks = [];

    archive.on('data', chunk => chunks.push(chunk));

    archive.on('error', err => {
      logger.error('Filesystem backup failed', { error: err.message });
      reject(err);
    });

    archive.on('finish', async () => {
      const buffer = Buffer.concat(chunks);

      if (s3Client) {
        const backupKey = `backups/filesystem/backup-${Date.now()}.tar.gz`;
        await s3Client.send(new PutObjectCommand({
          Bucket: BACKUP_BUCKET,
          Key: backupKey,
          Body: buffer,
          ContentType: 'application/gzip'
        }));
        logger.info('Filesystem backup uploaded to S3', { bucket: BACKUP_BUCKET, key: backupKey });
      }

      resolve({ success: true, size: buffer.length });
    });

    for (const path of sourcePaths) {
      archive.directory(path, path.replace('/', ''));
    }

    archive.finalize();
  });
}

// API Endpoints
app.post('/backup', async (req, res) => {
  if (isRunning) {
    return res.status(409).json({ error: 'Backup already in progress' });
  }

  const { type = 'elasticsearch', paths = [] } = req.body;

  isRunning = true;
  lastBackupStatus = 'running';

  try {
    let result;
    if (type === 'elasticsearch') {
      result = await performElasticsearchBackup();
    } else if (type === 'filesystem') {
      result = await performFilesystemBackup(paths);
    } else {
      throw new Error(`Unknown backup type: ${type}`);
    }

    lastBackup = new Date().toISOString();
    lastBackupStatus = result.success ? 'success' : 'failed';
    res.json({ success: true, result, timestamp: lastBackup });
  } catch (error) {
    lastBackupStatus = 'failed';
    res.status(500).json({ success: false, error: error.message });
  } finally {
    isRunning = false;
  }
});

app.get('/backup/status', (req, res) => {
  res.json({
    isRunning,
    lastBackup,
    lastBackupStatus,
    provider: BACKUP_PROVIDER,
    bucket: BACKUP_BUCKET
  });
});

app.get('/health', (req, res) => {
  const healthy = s3Client !== null || BACKUP_PROVIDER !== 's3';
  res.json({
    status: healthy ? 'healthy' : 'degraded',
    provider: BACKUP_PROVIDER,
    bucketConfigured: !!BACKUP_BUCKET,
    s3Configured: !!s3Client,
    lastBackup,
    lastBackupStatus
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP backup_agent_running Whether a backup is currently running
# TYPE backup_agent_running gauge
backup_agent_running ${isRunning ? 1 : 0}

# HELP backup_agent_last_status Last backup status (1=success, 0=failed, -1=unknown)
# TYPE backup_agent_last_status gauge
backup_agent_last_status{status="${lastBackupStatus || 'unknown'}"} ${lastBackupStatus === 'success' ? 1 : lastBackupStatus === 'failed' ? 0 : -1}

# HELP backup_agent_last_timestamp Unix timestamp of last backup
# TYPE backup_agent_last_timestamp gauge
backup_agent_last_timestamp ${lastBackup ? Date.parse(lastBackup) / 1000 : 0}
  `.trim());
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Backup agent started on port ${PORT}`, {
    provider: BACKUP_PROVIDER,
    region: BACKUP_REGION,
    bucket: BACKUP_BUCKET
  });
});