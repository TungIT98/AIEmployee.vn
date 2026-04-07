#!/bin/bash
#===============================================================================
# Regional Failover Script
# Usage: ./failover.sh [--initiate | --test | --status]
#===============================================================================
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-west-2}"
EU_REGION="${EU_REGION:-eu-west-1}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-30}"
FAILOVER_THRESHOLD="${FAILOVER_THRESHOLD:-3}"
LOG_FILE="/var/log/aiemployee-failover.log"
STATE_FILE="/var/run/aiemployee-failover.state"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

#-------------------------------------------------------------------------------
# Logging
#-------------------------------------------------------------------------------
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "${BLUE}INFO${NC}" "$*"; }
log_warn() { log "${YELLOW}WARN${NC}" "$*"; }
log_error() { log "${RED}ERROR${NC}" "$*"; }
log_success() { log "${GREEN}SUCCESS${NC}" "$*"; }

#-------------------------------------------------------------------------------
# State management
#-------------------------------------------------------------------------------
read_state() {
    if [[ -f "$STATE_FILE" ]]; then
        source "$STATE_FILE"
    else
        ACTIVE_REGION="$PRIMARY_REGION"
        LAST_FAILOVER=""
        FAILOVER_COUNT=0
    fi
}

write_state() {
    cat > "$STATE_FILE" << EOF
ACTIVE_REGION=$ACTIVE_REGION
LAST_FAILOVER=$(date -Iseconds)
FAILOVER_COUNT=$((FAILOVER_COUNT + 1))
EOF
}

#-------------------------------------------------------------------------------
# Health check functions
#-------------------------------------------------------------------------------
check_region_health() {
    local region="$1"
    local endpoint="$2"
    local max_retries=3
    local retry_count=0

    while [[ $retry_count -lt $max_retries ]]; do
        if curl -sf --max-time 10 "$endpoint" > /dev/null; then
            return 0
        fi
        retry_count=$((retry_count + 1))
        sleep 5
    done
    return 1
}

check_elasticsearch_health() {
    local region="$1"
    local endpoint="$2"

    local response=$(curl -sf --max-time 10 "$endpoint/_cluster/health" 2>/dev/null || echo '{"status":"unavailable"}')
    echo "$response" | grep -q '"status":"green"\|"status":"yellow"' && return 0
    return 1
}

#-------------------------------------------------------------------------------
# DNS failover via Route 53
#-------------------------------------------------------------------------------
update_dns_failover() {
    local from_region="$1"
    local to_region="$2"

    log_info "Updating DNS failover from ${from_region} to ${to_region}..."

    # Route 53 failover configuration
    local hosted_zone_id="${ROUTE53_HOSTED_ZONE_ID}"
    local record_name="${DNS_RECORD_NAME:-api.example.com}"

    # Calculate new weight (lower weight = less traffic)
    case "$to_region" in
        us-east-1)
            local us_east_weight=100
            local us_west_weight=0
            local eu_west_weight=0
            ;;
        us-west-2)
            local us_east_weight=0
            local us_west_weight=100
            local eu_west_weight=0
            ;;
        eu-west-1)
            local us_east_weight=0
            local us_west_weight=0
            local eu_west_weight=100
            ;;
    esac

    # Update Route 53 records
    aws route53 change-resource-record-sets \
        --hosted-zone-id "$hosted_zone_id" \
        --change-batch "{
            \"Changes\": [
                {
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"${record_name}\",
                        \"Type\": \"A\",
                        \"SetIdentifier\": \"api-${to_region}\",
                        \"Weight\": ${us_east_weight},
                        \"Region\": \"us-east-1\",
                        \"HealthCheckId\": \"${HEALTH_CHECK_ID_US_EAST}\"
                    }
                },
                {
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"${record_name}\",
                        \"Type\": \"A\",
                        \"SetIdentifier\": \"api-us-west-2\",
                        \"Weight\": ${us_west_weight},
                        \"Region\": \"us-west-2\",
                        \"HealthCheckId\": \"${HEALTH_CHECK_ID_US_WEST}\"
                    }
                },
                {
                    \"Action\": \"UPSERT\",
                    \"ResourceRecordSet\": {
                        \"Name\": \"${record_name}\",
                        \"Type\": \"A\",
                        \"SetIdentifier\": \"api-eu-west-1\",
                        \"Weight\": ${eu_west_weight},
                        \"Region\": \"eu-west-1\",
                        \"HealthCheckId\": \"${HEALTH_CHECK_ID_EU_WEST}\"
                    }
                }
            ]
        }"

    log_success "DNS updated for ${to_region}"
}

#-------------------------------------------------------------------------------
# Database failover
#-------------------------------------------------------------------------------
initiate_db_failover() {
    local from_region="$1"
    local to_region="$2"

    log_info "Initiating database failover from ${from_region} to ${to_region}..."

    # For managed databases (RDS, Aurora, etc.)
    case "${DB_TYPE:-}" in
        aurora)
            aws rds failover-global-cluster \
                --global-cluster-identifier "${GLOBAL_CLUSTER_ID}" \
                --target-region "$to_region"
            ;;
        rds)
            aws rds reboot-db-instance \
                --db-instance-identifier "${DB_INSTANCE_ID}" \
                --force-failover
            ;;
        elasticache)
            # Redis replication group failover
            aws elasticache replication-group-failover \
                --replication-group-id "${REDIS_GROUP_ID}"
            ;;
        *)
            log_warn "Unknown DB type: ${DB_TYPE:-unknown}. Skipping DB failover."
            ;;
    esac

    log_success "Database failover initiated"
}

#-------------------------------------------------------------------------------
# Elasticsearch cross-cluster replication
#-------------------------------------------------------------------------------
verify_es_replication() {
    local target_region="$1"
    local master_endpoint="${ES_MASTER_ENDPOINT:-http://elasticsearch-master:9200}"
    local replica_endpoint="${ES_REPLICA_ENDPOINT:-http://elasticsearch-replica:9201}"

    log_info "Verifying Elasticsearch replication..."

    # Check replication status
    local replication_status=$(curl -sf "$replica_endpoint/_ccr/status" 2>/dev/null || echo '{"status":"error"}')

    if echo "$replication_status" | grep -q '"status":"active"'; then
        log_success "Elasticsearch replication is active"
        return 0
    else
        log_warn "Elasticsearch replication may be lagging"
        return 1
    fi
}

#-------------------------------------------------------------------------------
# Alert notification
#-------------------------------------------------------------------------------
send_alert() {
    local severity="$1"
    local message="$2"

    log_info "Sending ${severity} alert: ${message}"

    # Send to alerting system (PagerDuty, Slack, etc.)
    case "${ALERT_PROVIDER:-}" in
        pagerduty)
            curl -X POST "https://events.pagerduty.com/v2/enqueue" \
                 -H "Content-Type: application/json" \
                 -d "{\"routing_key\":\"${PAGERDUTY_KEY}\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"${message}\",\"severity\":\"${severity}\"}}"
            ;;
        slack)
            curl -X POST "https://slack.com/api/chat.postMessage" \
                 -H "Authorization: Bearer ${SLACK_TOKEN}" \
                 -H "Content-Type: application/json" \
                 -d "{\"channel\":\"${SLACK_CHANNEL}\",\"text\":\"[${severity}] ${message}\"}"
            ;;
        *)
            log_warn "No alert provider configured"
            ;;
    esac
}

#-------------------------------------------------------------------------------
# Failover initiation
#-------------------------------------------------------------------------------
initiate_failover() {
    read_state

    local failed_region="$ACTIVE_REGION"
    local target_region=""

    # Determine target region based on failed region
    case "$failed_region" in
        us-east-1)
            target_region="us-west-2"
            ;;
        us-west-2)
            target_region="eu-west-1"
            ;;
        eu-west-1)
            target_region="us-east-1"
            ;;
    esac

    log_warn "=== INITIATING FAILOVER ==="
    log_warn "Failed region: $failed_region"
    log_warn "Target region: $target_region"
    log_warn "Failover count: $FAILOVER_COUNT"

    # Pre-failover checks
    if ! check_region_health "$target_region" "http://api.${target_region}.example.com/health"; then
        log_error "Target region ${target_region} is not healthy. Aborting failover."
        send_alert "critical" "Failover aborted - target region ${target_region} is unhealthy"
        exit 1
    fi

    # Send critical alert
    send_alert "critical" "Failover initiated from ${failed_region} to ${target_region}"

    # Stop traffic to failed region
    update_dns_failover "$failed_region" "$target_region"

    # Verify Elasticsearch replication is up to date
    if ! verify_es_replication "$target_region"; then
        log_warn "ES replication may be behind. Continuing anyway."
    fi

    # Initiate database failover
    initiate_db_failover "$failed_region" "$target_region"

    # Update state
    ACTIVE_REGION="$target_region"
    write_state

    # Verify failover
    sleep 60
    if check_region_health "$target_region" "http://api.${target_region}.example.com/health"; then
        log_success "=== FAILOVER COMPLETED SUCCESSFULLY ==="
        send_alert "info" "Failover completed successfully to ${target_region}"
    else
        log_error "Failover verification failed"
        send_alert "critical" "Failover verification failed - manual intervention required"
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# Failover test (no actual failover)
#-------------------------------------------------------------------------------
test_failover() {
    log_info "=== RUNNING FAILOVER TEST ==="

    read_state

    log_info "Current active region: $ACTIVE_REGION"
    log_info "Primary region: $PRIMARY_REGION"
    log_info "Secondary region: $SECONDARY_REGION"
    log_info "EU region: $EU_REGION"

    # Test health checks
    for region in "$PRIMARY_REGION" "$SECONDARY_REGION" "$EU_REGION"; do
        if check_region_health "$region" "http://api.${region}.example.com/health"; then
            log_success "${region}: Healthy"
        else
            log_warn "${region}: Unhealthy"
        fi
    done

    # Test ES replication
    verify_es_replication "$SECONDARY_REGION"

    log_success "=== FAILOVER TEST COMPLETED ==="
}

#-------------------------------------------------------------------------------
# Show failover status
#-------------------------------------------------------------------------------
show_status() {
    read_state

    echo ""
    echo "=== Failover Status ==="
    echo "Active Region: $ACTIVE_REGION"
    echo "Primary Region: $PRIMARY_REGION"
    echo "Secondary Region: $SECONDARY_REGION"
    echo "EU Region: $EU_REGION"
    echo "Last Failover: ${LAST_FAILOVER:-never}"
    echo "Failover Count: ${FAILOVER_COUNT:-0}"
    echo ""

    # Check health of each region
    echo "=== Region Health ==="
    for region in "$PRIMARY_REGION" "$SECONDARY_REGION" "$EU_REGION"; do
        if check_region_health "$region" "http://api.${region}.example.com/health"; then
            echo -e "  ${GREEN}${region}: HEALTHY${NC}"
        else
            echo -e "  ${RED}${region}: UNHEALTHY${NC}"
        fi
    done
    echo ""
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------
main() {
    mkdir -p "$(dirname "$LOG_FILE")" "$(dirname "$STATE_FILE")"

    case "${1:-}" in
        --initiate|-i)
            initiate_failover
            ;;
        --test|-t)
            test_failover
            ;;
        --status|-s)
            show_status
            ;;
        *)
            echo "Usage: $0 {--initiate|--test|--status}"
            echo ""
            echo "Commands:"
            echo "  --initiate, -i    Initiate failover to backup region"
            echo "  --test, -t        Test failover readiness (no actual failover)"
            echo "  --status, -s      Show current failover status"
            exit 1
            ;;
    esac
}

main "$@"