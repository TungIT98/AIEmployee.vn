#!/bin/bash
# Script to initialize Elasticsearch ILM policy and index template
# Run after Elasticsearch is up: ./setup-elasticsearch.sh

ES_URL="http://localhost:9200"

echo "Waiting for Elasticsearch to be ready..."
until curl -s "$ES_URL/_cluster/health" | grep -q '"status":"green"\|"status":"yellow"'; do
  sleep 5
done
echo "Elasticsearch is ready!"

# Create ILM policy
echo "Creating ILM policy..."
curl -X PUT "$ES_URL/_ilm/policy/aiemployee-logs-policy" \
  -H "Content-Type: application/json" \
  -d @ilm-policy.json
echo ""

# Create index template
echo "Creating index template..."
curl -X PUT "$ES_URL/_index_template/aiemployee-logs-template" \
  -H "Content-Type: application/json" \
  -d @index-template.json
echo ""

# Create initial write index
echo "Creating initial write index..."
curl -X PUT "$ES_URL/aiemployee-logs-access-000001" \
  -H "Content-Type: application/json" \
  -d '{"aliases": {"aiemployee-logs": {"is_write_index": true}}}'
echo ""

echo "Elasticsearch setup complete!"
