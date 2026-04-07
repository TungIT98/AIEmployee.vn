#!/usr/bin/env node
/**
 * Basic API Monitoring Script
 * Tracks: uptime, response times, error rates
 *
 * Usage: node monitor_api.js [--url=https://aiemployee.vn] [--staging]
 */

const https = require('https');
const http = require('http');

const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value;
  return acc;
}, {});

const URL = args.url || (args.staging ? 'https://staging.aiemployee.vn' : 'https://aiemployee.vn');
const TIMEOUT = 10000; // 10 seconds

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const protocol = url.startsWith('https') ? https : http;

    const req = protocol.get(url, { timeout: TIMEOUT }, (res) => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      let data = '';

      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          url,
          status,
          duration,
          timestamp: new Date().toISOString(),
          error: null,
          isError: status >= 400
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        url,
        status: 0,
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
        error: err.message,
        isError: true
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url,
        status: 0,
        duration: TIMEOUT,
        timestamp: new Date().toISOString(),
        error: 'TIMEOUT',
        isError: true
      });
    });
  });
}

async function runChecks() {
  console.log(`\n=== API Monitor - ${new Date().toISOString()} ===`);
  console.log(`Target: ${URL}\n`);

  const result = await fetchUrl(URL);

  // Format output
  const statusIcon = result.isError ? '❌' : '✅';
  const statusText = result.isError ? 'DOWN/ERROR' : 'UP';

  console.log(`${statusIcon} Status: ${statusText}`);
  console.log(`   HTTP Code: ${result.status || 'N/A'}`);
  console.log(`   Response Time: ${result.duration}ms`);
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }

  // Export metrics in a simple format for logging
  const metricLine = `[${result.timestamp}] URL=${result.url} STATUS=${result.status || 0} DURATION_MS=${result.duration} ERROR=${result.error || 'none'}`;
  console.log(`\nMetric: ${metricLine}`);

  // Exit with error code if site is down
  process.exit(result.isError ? 1 : 0);
}

runChecks().catch(err => {
  console.error('Monitor error:', err);
  process.exit(1);
});