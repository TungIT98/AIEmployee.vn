# Multi-Region Global Scale Infrastructure

## Overview

This directory contains the infrastructure code for deploying the AIEmployee platform across multiple geographic regions with global load balancing, CDN caching, and disaster recovery capabilities.

## Architecture

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

## Directory Structure

```
infrastructure/
├── multi-region/
│   ├── docker-compose.global.yml      # Main compose file for global services
│   ├── docker-compose.us-west-2.yml   # Region-specific override for us-west-2
│   ├── deploy.sh                      # Deployment automation script
│   ├── failover.sh                    # Regional failover automation
│   ├── runbook.md                     # Operations runbook
│   └── backup.conf                    # 3-2-1 backup configuration
├── elk/
│   ├── logstash/
│   │   ├── config/logstash.yml        # Logstash base configuration
│   │   └── pipeline/main.conf         # Log processing pipeline
│   └── kibana/
│       └── dashboards/
│           ├── global-operations.json # Multi-region health dashboard
│           └── api-performance.json   # API performance dashboard
services/
├── cdn-purger/                        # CDN cache purge service
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.js
├── health-monitor/                     # Regional health monitoring
│   ├── Dockerfile
│   ├── package.json
│   └── src/index.js
└── backup-agent/                       # Backup service (3-2-1)
    ├── Dockerfile
    ├── package.json
    └── src/index.js
```

## Regions

| Region | Role | Purpose |
|--------|------|---------|
| us-east-1 | Primary | Main production region |
| us-west-2 | Secondary | Failover and West Coast coverage |
| eu-west-1 | EU | GDPR-compliant EU data residency |

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- AWS CLI (for Route 53, S3, ECR)
- CloudFlare account (for CDN)

## Environment Variables

```bash
# AWS
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export AWS_DEFAULT_REGION=us-east-1

# CDN
export CDN_PROVIDER=cloudflare
export CDN_API_TOKEN=xxx
export CDN_ZONE_ID=xxx

# Elasticsearch
export ES_PASSWORD=xxx

# Backup
export BACKUP_BUCKET=aiemployee-backups
export BACKUP_REGION=us-east-1
```

## Deployment

### Deploy All Regions

```bash
cd infrastructure/multi-region

# Deploy to primary region
./deploy.sh deploy --region us-east-1 --version 1.0.0

# Deploy to secondary regions
./deploy.sh deploy --region us-west-2 --version 1.0.0
./deploy.sh deploy --region eu-west-1 --version 1.0.0
```

### Check Deployment Status

```bash
./deploy.sh status
```

### Rollback

```bash
./deploy.sh --rollback --region us-east-1
```

## Failover

### Check Failover Status

```bash
./failover.sh --status
```

### Test Failover Readiness

```bash
./failover.sh --test
```

### Initiate Manual Failover

```bash
./failover.sh --initiate
```

## Monitoring

- **Kibana**: https://kibana.example.com
- **Health Dashboard**: `/app/dashboards/global-ops`
- **API Dashboard**: `/app/dashboards/api-perf`

## Backup

The 3-2-1 backup strategy is implemented:
- **3** copies of data
- **2** different storage types (S3 + Azure)
- **1** copy offsite (eu-west-1)

### Trigger Backup

```bash
curl -X POST http://backup-agent:8080/backup -d '{"type":"elasticsearch"}'
```

### Check Backup Status

```bash
curl http://backup-agent:8080/backup/status
```

## Support

- Documentation: [runbook.md](./runbook.md)
- Issues: Create ticket in project