# Multi-Region Deployment Runbook

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Deployment Procedures](#deployment-procedures)
4. [Failover Procedures](#failover-procedures)
5. [Rollback Procedures](#rollback-procedures)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Troubleshooting](#troubleshooting)
8. [Checklists](#checklists)

---

## Overview

This runbook covers operations for the multi-region deployment of the AIEmployee platform. It supports three regions:
- **us-east-1** (Primary)
- **us-west-2** (Secondary/Failover)
- **eu-west-1** (EU Region for GDPR compliance)

### Service Topology
```
                    ┌─────────────────────────────────────────────┐
                    │              CloudFlare CDN                │
                    └─────────────────┬───────────────────────────┘
                                      │
                    ┌─────────────────┼───────────────────────────┐
                    │                 │                           │
              ┌─────▼─────┐     ┌─────▼─────┐               ┌──────▼──────┐
              │  Route 53 │     │  Route 53 │               │  Route 53   │
              │ Geo Routing│    │ Latency  │               │ Failover    │
              └─────┬─────┘     └─────┬─────┘               └──────┬──────┘
                    │                 │                           │
        ┌───────────┼─────────────────┼───────────────────────────┼───────────┐
        │           │                 │                           │           │
   ┌────▼────┐ ┌────▼────┐      ┌────▼────┐                ┌────▼────┐
   │us-east-1│ │us-west-2│      │eu-west-1│                │ Backup  │
   │Primary  │ │Secondary│      │   EU    │                │ Region  │
   └─────────┘ └─────────┘      └─────────┘                └─────────┘
```

---

## Architecture

### Infrastructure Components

| Component | Region | Purpose |
|-----------|--------|---------|
| API Gateway | All | Request routing, rate limiting |
| Elasticsearch | us-east-1 (master) | Log aggregation, search |
| Elasticsearch | us-west-2 (replica) | Cross-region replication |
| Logstash | us-east-1 | Log processing pipeline |
| Kibana | us-east-1 | Monitoring dashboards |
| CDN | Global | Static asset caching |
| Health Monitor | All | Regional health checks |

### Data Flow

1. **User Request** → CloudFlare CDN → Route 53 DNS
2. **DNS Routing** → Lowest latency region based on geolocation
3. **API Gateway** → Routes to regional API service
4. **Logging** → All requests logged to regional Elasticsearch
5. **Replication** → Elasticsearch cross-cluster replication to secondary

---

## Deployment Procedures

### Standard Deployment

#### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- Access to container registry
- Cloud provider CLI configured

#### Steps

1. **Prepare Environment**
   ```bash
   cd infrastructure/multi-region
   export IMAGE_REGISTRY=registry.example.com
   export VERSION=1.2.3
   export CDN_PROVIDER=cloudflare
   export CDN_API_TOKEN=your_token_here
   ```

2. **Run Pre-deployment Checks**
   ```bash
   ./deploy.sh deploy --region us-east-1 --version $VERSION --check
   ```

3. **Deploy to Primary Region**
   ```bash
   ./deploy.sh deploy --region us-east-1 --version $VERSION
   ```

4. **Verify Deployment**
   ```bash
   # Check service health
   curl https://api.example.com/health

   # Check Kibana
   curl https://kibana.example.com/api/status

   # View deployment logs
   ./deploy.sh logs -f
   ```

5. **Deploy to Secondary Regions**
   ```bash
   ./deploy.sh deploy --region us-west-2 --version $VERSION
   ./deploy.sh deploy --region eu-west-1 --version $VERSION
   ```

6. **Purge CDN Cache**
   ```bash
   ./deploy.sh purge-cache
   ```

### Blue-Green Deployment

1. **Deploy to green environment**
   ```bash
   REGION=us-east-1-green VERSION=1.2.3 ./deploy.sh deploy
   ```

2. **Run smoke tests against green**
   ```bash
   SMOKE_TARGET=us-east-1-green ./deploy.sh smoke-test
   ```

3. **Switch DNS to green**
   ```bash
   ./failover.sh switch --from us-east-1 --to us-east-1-green
   ```

4. **Keep old environment running for rollback**
   ```bash
   # Old environment stays on standby for 24 hours
   ```

---

## Failover Procedures

### Automatic Failover

The system automatically detects failures via health checks and initiates failover after 3 consecutive failures (configurable).

1. **Health Monitor** detects region failure
2. **Alert** sent to operations team
3. **DNS** updated to route traffic to healthy region
4. **Database** failover initiated (if applicable)
5. **Verification** performed after failover

### Manual Failover

```bash
# Check current status
./failover.sh --status

# Test failover readiness
./failover.sh --test

# Initiate manual failover
./failover.sh --initiate
```

### Failover Sequence

1. **Pre-check**: Verify target region health
2. **DNS Update**: Route traffic to target region
3. **Database Failover**: Promote replica to primary
4. **Verification**: Confirm services are operational
5. **Notification**: Alert operations team

### Post-Failover Actions

1. **Investigate** the cause of original region failure
2. **Update** DNS health checks
3. **Monitor** replication lag
4. **Plan** recovery of failed region
5. **Document** incident

---

## Rollback Procedures

### Quick Rollback (Same Version)

```bash
# Rollback to previous version
./deploy.sh --rollback --region us-east-1

# Verify rollback
curl https://api.example.com/health
```

### Region Rollback

```bash
# Stop new region deployment
docker-compose -f docker-compose.global.yml -f docker-compose.us-west-2.yml down

# Restore old configuration
git revert HEAD
git push

# Redeploy old version
./deploy.sh deploy --region us-west-2 --version previous_tag
```

### Full Rollback

```bash
# 1. Stop all deployments
./deploy.sh stop

# 2. Revert to previous Docker Compose
git checkout HEAD~1 -- infrastructure/multi-region/

# 3. Restart services
./deploy.sh deploy --region us-east-1
```

---

## Monitoring & Alerting

### Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `/health` | Basic health check |
| `/health/ready` | Readiness probe |
| `/health/live` | Liveness probe |
| `/api/status` | Detailed service status |

### Key Metrics

| Metric | Threshold | Action |
|--------|-----------|--------|
| API Latency | > 500ms p99 | Alert + investigate |
| Error Rate | > 1% | Alert + investigate |
| ES Replication Lag | > 30s | Alert |
| Region Health | Any unhealthy | Immediate alert |
| CDN Cache Hit Rate | < 80% | Investigate |

### Kibana Dashboards

- **Global Operations**: `/app/dashboards/global-ops`
- **API Performance**: `/app/dashboards/api-perf`
- **ES Replication**: `/app/dashboards/es-replication`
- **CDN Analytics**: `/app/dashboards/cdn-analytics`

### Alert Routing

| Severity | Channel | Contacts |
|----------|---------|----------|
| Critical | PagerDuty | On-call DevOps |
| High | Slack #incidents | DevOps team |
| Medium | Slack #alerts | Monitoring |
| Low | Email | Team lead |

---

## Troubleshooting

### Common Issues

#### Region Health Check Failing
```bash
# SSH to region
ssh user@api.us-east-1.example.com

# Check container status
docker ps

# View logs
docker logs aiemployee-api-staging

# Restart service
docker-compose restart api
```

#### Elasticsearch Replication Lag
```bash
# Check replication status
curl http://elasticsearch-master:9200/_cat/replication?v

# Force sync
curl -X POST "http://elasticsearch-master:9200/_ccr/auto_follow/auto_follow_pattern/_pause"
curl -X POST "http://elasticsearch-master:9200/_ccr/auto_follow/auto_follow_pattern/_resume"
```

#### CDN Cache Issues
```bash
# Purge specific URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{"files":["https://example.com/assets/*"]}'

# Check cache status
curl -I https://example.com/assets/app.js
```

#### Database Connection Failover
```bash
# Check RDS failover status
aws rds describe-db-instances --db-instance-identifier aiemployee-db

# Check Aurora Global Database
aws rds describe-global-clusters --global-cluster-identifier aiemployee-global
```

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| DevOps On-Call | +1-555-0100 | CTO |
| AWS Support | Support Console | - |
| CloudFlare Support | support.cloudflare.com | - |
| Database Admin | +1-555-0101 | VP Engineering |

---

## Checklists

### Pre-Deployment Checklist
- [ ] Version tagged in git
- [ ] Docker images built and pushed
- [ ] CDN cache cleared
- [ ] Backup completed
- [ ] Monitoring dashboards accessible
- [ ] On-call notified of deployment
- [ ] Rollback plan documented

### Post-Deployment Checklist
- [ ] Smoke tests passed
- [ ] All health checks green
- [ ] No increase in error rate
- [ ] Latency within SLA
- [ ] ES replication healthy
- [ ] CDN cache hit rate normal
- [ ] Update deployment log

### Failover Checklist
- [ ] Target region verified healthy
- [ ] Operations team notified
- [ ] Incident created
- [ ] DNS updated
- [ ] Database failover initiated
- [ ] Verification complete
- [ ] Post-mortem scheduled

---

## Appendix

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `IMAGE_REGISTRY` | Yes | Container registry URL |
| `VERSION` | Yes | Docker image tag |
| `CDN_PROVIDER` | Yes | cloudflare, cloudfront |
| `CDN_API_TOKEN` | Yes | CDN API authentication |
| `REGION` | Yes | Target region |
| `ES_PASSWORD` | Yes | Elasticsearch password |
| `BACKUP_BUCKET` | Yes | S3 backup bucket name |

### Region-Specific Endpoints

| Region | API | Kibana | Health |
|--------|-----|--------|--------|
| us-east-1 | api-us.example.com | kibana-us.example.com | api-us.example.com/health |
| us-west-2 | api-west.example.com | kibana-west.example.com | api-west.example.com/health |
| eu-west-1 | api-eu.example.com | kibana-eu.example.com | api-eu.example.com/health |

### Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-04-03 | Initial multi-region setup | DevOps |
| 1.1.0 | - | Added EU region | - |
| 1.2.0 | - | CDN integration | - |