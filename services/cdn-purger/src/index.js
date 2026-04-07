const express = require('express');
const winston = require('winston');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure logger
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

// Middleware
app.use(express.json());

// CDN Providers
const cdnProviders = {
  cloudflare: async (zoneId, apiToken, files) => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ files })
    });
    return response.json();
  },

  cloudfront: async (distributionId, apiToken, files) => {
    const response = await fetch(`https://cloudfront.amazonaws.com/api/${distributionId}/purge`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ Paths: { Items: files } })
    });
    return response.json();
  }
};

// Purge cache endpoint
app.post('/purge', async (req, res) => {
  const { files = [] } = req.body;
  const provider = process.env.CDN_PROVIDER || 'cloudflare';
  const zoneId = process.env.CDN_ZONE_ID;
  const apiToken = process.env.CDN_API_TOKEN;
  const distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;

  logger.info(`Purge request received for ${files.length} files via ${provider}`);

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'No files specified for purge' });
  }

  try {
    let result;
    if (provider === 'cloudflare') {
      if (!zoneId || !apiToken) {
        throw new Error('Missing CloudFlare credentials (CDN_ZONE_ID, CDN_API_TOKEN)');
      }
      result = await cdnProviders.cloudflare(zoneId, apiToken, files);
    } else if (provider === 'cloudfront') {
      if (!distributionId || !apiToken) {
        throw new Error('Missing CloudFront credentials (CLOUDFRONT_DISTRIBUTION_ID, CDN_API_TOKEN)');
      }
      result = await cdnProviders.cloudfront(distributionId, apiToken, files);
    } else {
      throw new Error(`Unknown CDN provider: ${provider}`);
    }

    logger.info('Purge completed successfully', { result });
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Purge failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Purge all endpoint
app.post('/purge-all', async (req, res) => {
  const provider = process.env.CDN_PROVIDER || 'cloudflare';
  const zoneId = process.env.CDN_ZONE_ID;
  const apiToken = process.env.CDN_API_TOKEN;

  logger.info('Purge all request received');

  try {
    let result;
    if (provider === 'cloudflare') {
      if (!zoneId || !apiToken) {
        throw new Error('Missing CloudFlare credentials');
      }
      result = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ purge_everything: true })
      }).then(r => r.json());
    } else {
      throw new Error('Purge all is only supported for CloudFlare');
    }

    logger.info('Purge all completed successfully');
    res.json({ success: true, result });
  } catch (error) {
    logger.error('Purge all failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const provider = process.env.CDN_PROVIDER;
  const hasCredentials = !!(process.env.CDN_API_TOKEN &&
    (provider === 'cloudflare' ? process.env.CDN_ZONE_ID : process.env.CLOUDFRONT_DISTRIBUTION_ID));

  res.json({
    status: 'healthy',
    provider,
    credentialsConfigured: hasCredentials,
    timestamp: new Date().toISOString()
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP cdn_purger_requests_total Total number of CDN purge requests
# TYPE cdn_purger_requests_total counter
cdn_purger_requests_total{provider="${process.env.CDN_PROVIDER || 'unknown'}"} 0
  `.trim());
});

// Start server
app.listen(PORT, () => {
  logger.info(`CDN Purger service started on port ${PORT}`);
  logger.info(`Provider: ${process.env.CDN_PROVIDER || 'not configured'}`);
});