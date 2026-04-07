# Health Check Documentation

## Overview

This document describes the Docker health check configuration and watchdog monitoring system for AIEmployee.vn infrastructure.

## Health Checks

All services have Docker `HEALTHCHECK` directives configured in `docker-compose.yml`:

| Service | Health Check | Interval | Timeout | Retries |
|---------|-------------|----------|---------|---------|
| api | `wget /health` | 30s | 10s | 3 |
| frontend | nginx PID check | 30s | 10s | 3 |
| elasticsearch | `curl /_cluster/health` | 30s | 10s | 5 |
| logstash | `curl /_node/stats` | 30s | 10s | 3 |
| kibana | `curl /api/status` | 30s | 10s | 10 |

## Health Check Status Commands

### View container health status

```bash
# All containers
docker ps --format "table {{.Names}}\t{{.Status}}"

# Detailed health info
docker inspect --format='{{.Name}}: {{.State.Health.Status}}' \
  $(docker ps -q --filter "name=aiemployee-")
```

### Individual service health

```bash
# API health
curl -sf http://localhost:3000/health || echo "API unhealthy"

# Elasticsearch cluster health
curl -s http://localhost:9200/_cluster/health | jq .

# Kibana status
curl -s http://localhost:5601/api/status | jq .

# Logstash node stats
curl -s http://localhost:9600/_node/stats | jq .
```

### Watchdog monitoring

```bash
# Start watchdog (continuous monitoring)
./scripts/watchdog.sh monitor --interval 30

# One-shot health status
./scripts/watchdog.sh status

# With custom log file
./scripts/watchdog.sh monitor --log-file /var/log/aiemployee-watchdog.log
```

## Health Check Failure Recovery

When a container fails health checks:

1. **Automatic restart**: Docker's `restart: unless-stopped` policy restarts unhealthy containers
2. **Watchdog monitoring**: The watchdog script tracks consecutive failures and triggers recovery after 3 failures
3. **Cooldown period**: 5-minute cooldown between restarts to prevent restart loops

## Start Period

All services use `start_period` to allow initialization time before health checks begin:

| Service | Start Period |
|---------|-------------|
| api | 20s |
| frontend | 15s |
| elasticsearch | 30s |
| logstash | 30s |
| kibana | 30s |

## Troubleshooting

### Container keeps restarting

Check logs:
```bash
docker logs <container-name>
docker inspect <container-name> | jq '.[0].State'
```

### Health check always failing

Verify the health check endpoint is working:
```bash
# For API
docker exec aiemployee-api-staging wget -q --spider http://localhost:3000/health

# For Elasticsearch
docker exec aiemployee-elasticsearch curl -s http://localhost:9200/_cluster/health

# For Kibana
docker exec aiemployee-kibana curl -s http://localhost:5601/api/status
```

### Watchdog not working

Ensure the watchdog script is executable:
```bash
chmod +x scripts/watchdog.sh
```
