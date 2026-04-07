#!/bin/bash
# ELK Stack Setup Script for AIEmployee
# Run this after `docker-compose up -d` to initialize Elasticsearch

set -e

ES_URL="${ES_URL:-http://localhost:9200}"
KIBANA_URL="${KIBANA_URL:-http://localhost:5601}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================"
echo "AIEmployee ELK Stack Setup"
echo "============================================"
echo ""

# Wait for Elasticsearch
echo "[1/5] Waiting for Elasticsearch to be ready..."
until curl -s "$ES_URL/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
  echo "  Waiting for Elasticsearch..."
  sleep 5
done
echo "  Elasticsearch is ready!"

# Create ILM Policy
echo "[2/5] Creating ILM policy..."
curl -s -X PUT "$ES_URL/_ilm/policy/aiemployee-logs-policy" \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/elasticsearch/ilm-policy.json"
echo "  Done!"

# Create Index Template
echo "[3/5] Creating index template..."
curl -s -X PUT "$ES_URL/_index_template/aiemployee-logs-template" \
  -H "Content-Type: application/json" \
  -d @"$SCRIPT_DIR/elasticsearch/index-template.json"
echo "  Done!"

# Create initial write indices for each log type
echo "[4/5] Creating initial write indices..."
for type in access auth error change security; do
  index_name="aiemployee-logs-$type-000001"
  alias_name="aiemployee-logs-$type"

  curl -s -X PUT "$ES_URL/$index_name" \
    -H "Content-Type: application/json" \
    -d "{\"aliases\": {\"$alias_name\": {\"is_write_index\": true}}}"
  echo "  Created $index_name"
done
echo "  Done!"

# Wait for Kibana
echo "[5/5] Waiting for Kibana to be ready..."
until curl -s "$KIBANA_URL/api/status" | grep -q '"overall":{"level":"available"'; do
  echo "  Waiting for Kibana..."
  sleep 5
done
echo "  Kibana is ready!"

echo ""
echo "============================================"
echo "ELK Stack Setup Complete!"
echo "============================================"
echo ""
echo "Services:"
echo "  Elasticsearch: $ES_URL"
echo "  Kibana:        $KIBANA_URL"
echo ""
echo "Indices created:"
echo "  - aiemployee-logs-access-000001"
echo "  - aiemployee-logs-auth-000001"
echo "  - aiemployee-logs-error-000001"
echo "  - aiemployee-logs-change-000001"
echo "  - aiemployee-logs-security-000001"
echo ""
echo "Next steps:"
echo "  1. Open Kibana at $KIBANA_URL"
echo "  2. Go to Stack Management > Index Patterns"
echo "  3. Create index pattern: aiemployee-logs-*"
echo "  4. Set time field to: timestamp"
echo "  5. Go to Dashboard to view logs"
echo ""
