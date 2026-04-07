# Kibana Dashboards for AIEmployee Logs

## Overview
This directory contains saved objects and setup scripts for Kibana dashboards to visualize:
- API request logs
- Error tracking
- Performance metrics
- Security events (failed auth, rate limits)

## Index Patterns
- `aiemployee-logs-*` - Main logs index pattern

## Index Suffixes
- `aiemployee-logs-access-*` - API access logs
- `aiemployee-logs-auth-*` - Authentication logs
- `aiemployee-logs-error-*` - Error logs
- `aiemployee-logs-change-*` - Data change logs
- `aiemployee-logs-security-*` - Security event logs

## Setup

### 1. Wait for Kibana to be ready
```bash
curl -s http://localhost:5601/api/status
```

### 2. Create Index Pattern
In Kibana UI:
1. Go to Stack Management > Index Patterns
2. Create index pattern: `aiemployee-logs-*`
3. Set time field to: `timestamp`

### 3. Create ILM Policy
```bash
curl -X PUT "http://localhost:9200/_ilm/policy/aiemployee-logs-policy" \
  -H "Content-Type: application/json" \
  -d @../../elasticsearch/ilm-policy.json
```

### 4. Create Index Template
```bash
curl -X PUT "http://localhost:9200/_index_template/aiemployee-logs-template" \
  -H "Content-Type: application/json" \
  -d @../../elasticsearch/index-template.json
```

### 5. Create Initial Write Index
```bash
curl -X PUT "http://localhost:9200/aiemployee-logs-access-000001" \
  -H "Content-Type: application/json" \
  -d '{"aliases": {"aiemployee-logs": {"is_write_index": true}}}'
```

## Dashboard Panels

### API Request Logs Panel
- Type: Lens visualization
- Metrics: Request count, response time, status codes
- Filters: method, path, statusCode, duration

### Error Tracking Panel
- Type: Lens visualization
- Metrics: Error count, error rate, top errors
- Filters: type=error, level=error

### Performance Metrics Panel
- Type: Lens visualization
- Metrics: p50, p95, p99 response times
- Filters: type=access, duration histogram

### Security Events Panel
- Type: Lens visualization
- Metrics: Failed auth count, rate limit hits, blocked IPs
- Filters: tags=security_event

## Import Saved Objects (Optional)
```bash
curl -X POST "http://localhost:5601/api/saved_objects/_import" \
  -H "kbn-xsrf: true" \
  --form file=@aiemployee-logs.ndjson
```
