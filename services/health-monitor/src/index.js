const express = require('express');
const winston = require('winston');

const app = express();

const REGION = process.env.REGION || 'unknown';
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || '30s';
const FAILOVER_THRESHOLD = parseInt(process.env.FAILOVER_THRESHOLD || '3', 10);
const API_ENDPOINT = process.env.API_ENDPOINT || 'http://api-gateway:3000/health';
const ES_ENDPOINT = process.env.ES_ENDPOINT || 'http://elasticsearch-master:9200';

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

// Health state
let consecutiveFailures = 0;
let isHealthy = true;
let lastCheck = null;
let lastFailure = null;

async function checkEndpoint(url, name) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      timeout: 10000
    });
    if (response.ok) {
      return { name, healthy: true, status: response.status };
    } else {
      return { name, healthy: false, status: response.status };
    }
  } catch (error) {
    return { name, healthy: false, error: error.message };
  }
}

async function performHealthCheck() {
  lastCheck = new Date().toISOString();
  logger.info('Performing health check', { region: REGION });

  const [apiHealth, esHealth] = await Promise.all([
    checkEndpoint(API_ENDPOINT, 'api'),
    checkEndpoint(`${ES_ENDPOINT}/_cluster/health`, 'elasticsearch')
  ]);

  const allHealthy = apiHealth.healthy && esHealth.healthy;

  if (!allHealthy) {
    consecutiveFailures++;
    lastFailure = new Date().toISOString();
    logger.warn('Health check failed', {
      region: REGION,
      consecutiveFailures,
      failoverThreshold: FAILOVER_THRESHOLD,
      apiHealth,
      esHealth
    });

    if (consecutiveFailures >= FAILOVER_THRESHOLD && isHealthy) {
      isHealthy = false;
      logger.error('FAILOVER TRIGGERED - Region unhealthy', {
        region: REGION,
        failures: consecutiveFailures
      });
      // In production, this would trigger DNS failover via AWS SDK
    }
  } else {
    if (!isHealthy) {
      logger.info('Region recovered - health restored', { region: REGION });
    }
    consecutiveFailures = 0;
    isHealthy = true;
  }

  return { apiHealth, esHealth, isHealthy: allHealthy };
}

// Health check loop
setInterval(async () => {
  await performHealthCheck();
}, parseInterval(CHECK_INTERVAL));

function parseInterval(str) {
  const match = str.match(/^(\d+)(s|m|h|d)?$/);
  if (!match) return 30000;
  const value = parseInt(match[1], 10);
  const unit = match[2] || 's';
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] || 1000);
}

// API endpoints
app.get('/health', (req, res) => {
  res.json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    region: REGION,
    consecutiveFailures,
    lastCheck,
    lastFailure,
    endpoints: {
      api: API_ENDPOINT,
      elasticsearch: ES_ENDPOINT
    }
  });
});

app.get('/health/ready', (req, res) => {
  if (isHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready', reason: 'health check failed' });
  }
});

app.get('/health/live', (req, res) => {
  res.json({ status: 'alive' });
});

app.get('/status', async (req, res) => {
  const result = await performHealthCheck();
  res.json({
    region: REGION,
    isHealthy: result.isHealthy,
    checks: result,
    consecutiveFailures,
    failoverThreshold: FAILOVER_THRESHOLD,
    lastCheck,
    lastFailure
  });
});

app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP health_monitor_healthy Whether the region is healthy (1=healthy, 0=unhealthy)
# TYPE health_monitor_healthy gauge
health_monitor_healthy{region="${REGION}"} ${isHealthy ? 1 : 0}

# HELP health_monitor_failures_total Total consecutive health check failures
# TYPE health_monitor_failures_total gauge
health_monitor_failures_total{region="${REGION}"} ${consecutiveFailures}

# HELP health_monitor_last_check_timestamp Unix timestamp of last check
# TYPE health_monitor_last_check_timestamp gauge
health_monitor_last_check_timestamp{region="${REGION}"} ${lastCheck ? Date.parse(lastCheck) / 1000 : 0}
  `.trim());
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  logger.info(`Health monitor started for region ${REGION} on port ${PORT}`);
  performHealthCheck();
});