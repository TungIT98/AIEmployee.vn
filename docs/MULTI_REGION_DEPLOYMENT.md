# Multi-Region Deployment Runbook

**Reference:** COM-133
**Last Updated:** 2026-04-03

---

## Architecture Overview

### Regions

| Region ID | Name | Priority | Weight | Default Endpoint |
|-----------|------|----------|--------|-------------------|
| ap-southeast-1 | Southeast Asia (Singapore) | 1 | 100 | http://localhost:3000 |
| ap-northeast-1 | Asia Pacific (Tokyo) | 2 | 80 | http://localhost:3001 |
| us-east-1 | US East (Virginia) | 3 | 60 | http://localhost:3002 |

### 3-2-1-1 Redundancy Strategy

| Rule | Description |
|------|-------------|
| **3** | Three regions deployed |
| **2** | Two availability zones per region (recommended) |
| **1** | One active region at a time |
| **1** | One failover mechanism |

---

## Environment Variables

### Region Configuration

```bash
# Primary Region (Singapore)
REGION_AP_SE_1=http://api-sgp.example.com

# Secondary Region (Tokyo)
REGION_AP_NE_1=http://api-nrt.example.com

# Tertiary Region (Virginia)
REGION_US_E_1=http://api-iad.example.com
```

### CDN Configuration

```bash
CDN_ENABLED=true
CDN_PROVIDER=cloudflare
CDN_STATIC_PATH=/static
CDN_CACHE_TTL=86400
```

### Failover Configuration

```bash
FAILOVER_ENABLED=true
FAILOVER_INTERVAL=30000
FAILOVER_THRESHOLD=3
FAILOVER_RECOVERY=2
AUTO_FAILOVER=true
```

### Replication Configuration

```bash
REPLICATION_ENABLED=true
REPLICATION_STRATEGY=async
REPLICATION_DELAY=1000
```

---

## Deployment

### 1. Deploy to Singapore (Primary)

```bash
# Build image
docker build -t aiemployee-api:1.0.0 ./api

# Run container
docker run -d \
  --name aiemployee-api-sgp \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e REGION_AP_SE_1=http://localhost:3000 \
  -e REGION_AP_NE_1=http://api-nrt.example.com \
  -e REGION_US_E_1=http://api-iad.example.com \
  -e CDN_ENABLED=true \
  -e AUTO_FAILOVER=true \
  aiemployee-api:1.0.0
```

### 2. Deploy to Tokyo (Secondary)

```bash
docker run -d \
  --name aiemployee-api-nrt \
  -p 3001:3000 \
  -e NODE_ENV=production \
  -e REGION_AP_SE_1=http://api-sgp.example.com \
  -e REGION_AP_NE_1=http://localhost:3001 \
  -e REGION_US_E_1=http://api-iad.example.com \
  -e CDN_ENABLED=true \
  -e AUTO_FAILOVER=true \
  aiemployee-api:1.0.0
```

### 3. Deploy to Virginia (Tertiary)

```bash
docker run -d \
  --name aiemployee-api-iad \
  -p 3002:3000 \
  -e NODE_ENV=production \
  -e REGION_AP_SE_1=http://api-sgp.example.com \
  -e REGION_AP_NE_1=http://api-nrt.example.com \
  -e REGION_US_E_1=http://localhost:3002 \
  -e CDN_ENABLED=true \
  -e AUTO_FAILOVER=true \
  aiemployee-api:1.0.0
```

---

## CDN Configuration

### Cloudflare Setup

1. Create a Cloudflare account and add your domain
2. Configure origin servers to point to your primary region
3. Set up Page Rules for static assets:

```
Rule 1: *example.com/static/*
  - Cache Level: Cache Everything
  - Edge Cache TTL: 1 week
  - Browser Cache TTL: 1 day

Rule 2: *example.com/api/*
  - Cache Level: Bypass
  - Origin Cache Control: On
```

### Static Asset Caching Headers

The service automatically adds CDN headers for static assets:

```javascript
// Assets under /static get:
Cache-Control: public, max-age=86400
CDN-Cache-TTL: 86400
Edge-Locations: sin, nrt, iad, lax, fra
```

---

## Geographic Load Balancing

### Weighted Round-Robin

Traffic is distributed based on region weights:

| Region | Weight | Traffic % |
|--------|--------|-----------|
| Singapore | 100 | ~50% |
| Tokyo | 80 | ~25% |
| Virginia | 60 | ~20% |

### Latency-Based Routing

For production, configure your DNS provider:

```
# Route53 Latency Records
api-sgp.example.com -> api-sgp:3000 (latency SG)
api-nrt.example.com -> api-nrt:3000 (latency JP)
api-iad.example.com -> api-iad:3000 (latency US)
```

---

## Data Replication

### Async Replication (Default)

```javascript
// Fire-and-forget replication to secondary regions
await multiRegionService.replicateData(data, 'async');
```

### Sync Replication

```javascript
// Wait for all regions to acknowledge
await multiRegionService.replicateData(data, 'sync');
```

### Replication Endpoint

```bash
POST /api/replicate
Content-Type: application/json

{
  "data": { ... },
  "timestamp": "2026-04-03T00:00:00Z",
  "sourceRegion": "ap-southeast-1"
}
```

---

## Failover Procedures

### Automatic Failover

Failover triggers when:
1. Health check fails 3 consecutive times (default threshold)
2. Region endpoint becomes unreachable
3. HTTP response indicates region is down

### Manual Failover

```bash
# Check current active region
curl http://localhost:3000/api/multi-region/status

# Manually trigger failover
curl -X POST http://localhost:3000/api/multi-region/failover \
  -H "Content-Type: application/json" \
  -d '{"targetRegion": "ap-northeast-1"}'
```

### Failover Flow

```
1. Health check detects primary failure
2. System evaluates all region health statuses
3. Failover executes to highest priority healthy region
4. DNS updated to point to new primary (external)
5. Replication reconfigured to new primary as source
```

---

## Health Monitoring

### Health Check Endpoint

```bash
GET /health
GET /api/multi-region/status
GET /api/multi-region/regions
```

### Health Check Response

```json
{
  "service": "MultiRegion",
  "activeRegion": "ap-southeast-1",
  "healthyRegions": 3,
  "totalRegions": 3,
  "cdnEnabled": true,
  "failoverEnabled": true
}
```

### Region Status Response

```json
[
  {
    "id": "ap-southeast-1",
    "name": "Southeast Asia (Singapore)",
    "isActive": true,
    "health": "healthy",
    "lastHealthCheck": "2026-04-03T00:00:00Z",
    "requestsHandled": 15000
  }
]
```

---

## Disaster Recovery

### Scenario: Complete Region Failure

1. **Detect**: Health checks fail for affected region
2. **Isolate**: Automatic failover activates
3. **Redirect**: DNS updated to healthy region
4. **Verify**: Check replication status across regions
5. **Recover**: Deploy fresh instance to failed region
6. **Sync**: Re-sync data from primary to recovered region
7. **Restore**: Switch DNS back after recovery

### Scenario: Data Corruption

1. **Detect**: Verification checks report inconsistency
2. **Isolate**: Mark corrupted region as unhealthy
3. **Restore**: Promote secondary region to primary
4. **Repair**: Fix corruption in isolated region
5. **Rejoin**: Re-add region to cluster after repair

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Single Region Failover | < 5 min | < 1 min |
| Complete Data Loss | < 30 min | < 15 min |
| Cross-Region Failover | < 10 min | < 5 min |

---

## Multi-Region Service API

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/multi-region/status` | Service status |
| GET | `/api/multi-region/config` | Full configuration |
| GET | `/api/multi-region/regions` | All region statuses |
| GET | `/api/multi-region/regions/:id` | Specific region status |
| POST | `/api/multi-region/failover` | Manual failover |
| POST | `/api/multi-region/replicate` | Trigger replication |

### Usage Example

```javascript
const MultiRegionService = require('./src/services/multiRegion');
const multiRegion = new MultiRegionService();

// Get status
const status = multiRegion.getStatus();

// Route request with failover
const result = await multiRegion.routeRequest('/api/data', {
  timeout: 5000
});

// Get CDN headers
const headers = multiRegion.getCDNHeaders('/static/app.js');
```

---

## Monitoring & Alerts

### Key Metrics

- `multi_region_active_region` - Current active region
- `multi_region_healthy_regions` - Number of healthy regions
- `multi_region_requests_total` - Total requests by region
- `multi_region_failovers_total` - Total failovers
- `multi_region_last_failover` - Timestamp of last failover

### Alert Rules

```yaml
alerts:
  - name: RegionUnhealthy
    condition: region.health != 'healthy' for 5 min
    severity: warning

  - name: AllRegionsUnhealthy
    condition: healthyRegions == 0
    severity: critical

  - name: FailoverOccurred
    condition: failovers > 0 in 1 hour
    severity: info
```

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REGION_AP_SE_1` | http://localhost:3000 | Singapore endpoint |
| `REGION_AP_NE_1` | http://localhost:3001 | Tokyo endpoint |
| `REGION_US_E_1` | http://localhost:3002 | Virginia endpoint |
| `CDN_ENABLED` | false | Enable CDN features |
| `CDN_PROVIDER` | cloudflare | CDN provider |
| `CDN_STATIC_PATH` | /static | Static assets path |
| `CDN_CACHE_TTL` | 86400 | Cache TTL in seconds |
| `FAILOVER_ENABLED` | true | Enable failover |
| `FAILOVER_INTERVAL` | 30000 | Health check interval (ms) |
| `FAILOVER_THRESHOLD` | 3 | Failures before failover |
| `AUTO_FAILOVER` | true | Automatic failover |
| `REPLICATION_ENABLED` | false | Enable replication |
| `REPLICATION_STRATEGY` | async | sync, async, eventual |