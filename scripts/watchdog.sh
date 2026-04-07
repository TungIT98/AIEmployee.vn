#!/bin/bash
#===============================================================================
# Container Health Watchdog
# Monitors Docker container health and triggers recovery actions
# Usage: ./watchdog.sh [--interval <seconds>] [--log-file <path>]
#===============================================================================
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INTERVAL="${INTERVAL:-30}"
LOG_FILE="${LOG_FILE:-/var/log/aiemployee-watchdog.log}"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/../docker-compose.yml}"
CONTAINERS=("aiemployee-api-staging" "aiemployee-frontend-staging" "aiemployee-elasticsearch" "aiemployee-logstash" "aiemployee-kibana")

# Alert thresholds
UNHEALTHY_THRESHOLD=3
RESTART_COOLDOWN=300

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

#===============================================================================
# Logging functions
#===============================================================================
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}
log_info() { log "INFO" "$*"; }
log_warn() { log "${YELLOW}WARN${NC}" "$*"; }
log_error() { log "${RED}ERROR${NC}" "$*"; }
log_success() { log "${GREEN}OK${NC}" "$*"; }

#===============================================================================
# Check container health
#===============================================================================
check_container_health() {
    local container="$1"
    local status
    local health
    local unhealthy_count=0

    # Check if container exists
    if ! docker ps -a --format '{{.Names}}' | grep -q "^${container}$"; then
        log_warn "Container ${container} does not exist"
        return 1
    fi

    # Get container status
    status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
    health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}"none"{{end}}' "$container" 2>/dev/null || echo "unknown")

    case "$health" in
        "healthy")
            log_success "Container ${container} is healthy"
            # Reset unhealthy counter on healthy status
            docker rm -f "${container}-unhealthy-count" 2>/dev/null || true
            return 0
            ;;
        "unhealthy")
            log_error "Container ${container} is UNHEALTHY"
            # Increment unhealthy counter
            local count_file="${container}-unhealthy-count"
            local count=$(docker inspect --format='{{.Name}}' "$count_file" 2>/dev/null | grep -oE '[0-9]+' || echo "0")
            count=$((count + 1))
            log_warn "Unhealthy count for ${container}: ${count}/${UNHEALTHY_THRESHOLD}"

            if [ "$count" -ge "$UNHEALTHY_THRESHOLD" ]; then
                log_error "Container ${container} exceeded unhealthy threshold - triggering recovery"
                recover_container "$container"
            fi
            return 1
            ;;
        "starting")
            log_info "Container ${container} is still starting..."
            return 0
            ;;
        "none")
            # Container doesn't have a healthcheck defined
            if [ "$status" = "running" ]; then
                log_info "Container ${container} is running (no healthcheck)"
                return 0
            else
                log_warn "Container ${container} is ${status}"
                return 1
            fi
            ;;
        *)
            log_warn "Container ${container} has unknown health status: ${health}"
            return 1
            ;;
    esac
}

#===============================================================================
# Recover container
#===============================================================================
recover_container() {
    local container="$1"
    local timestamp=$(date +%s)
    local cooldown_file="/tmp/${container}-restart-cooldown"

    # Check cooldown
    if [ -f "$cooldown_file" ]; then
        local last_restart=$(cat "$cooldown_file")
        local elapsed=$((timestamp - last_restart))
        if [ "$elapsed" -lt "$RESTART_COOLDOWN" ]; then
            log_warn "Container ${container} is in restart cooldown (${elapsed}s < ${RESTART_COOLDOWN}s)"
            return 0
        fi
    fi

    log_info "Attempting recovery for ${container}..."

    # Try to restart the container
    if docker restart "$container"; then
        log_success "Container ${container} restarted successfully"
        echo "$timestamp" > "$cooldown_file"

        # Log the incident
        log_warn "RECOVERY: Container ${container} was restarted at $(date '+%Y-%m-%d %H:%M:%S')"
    else
        log_error "Failed to restart container ${container}"
        return 1
    fi
}

#===============================================================================
# Monitor all containers
#===============================================================================
monitor_containers() {
    local failed=0
    local total=0

    for container in "${CONTAINERS[@]}"; do
        total=$((total + 1))
        if ! check_container_health "$container"; then
            failed=$((failed + 1))
        fi
    done

    if [ "$failed" -gt 0 ]; then
        log_warn "Health check summary: ${failed}/${total} containers unhealthy"
    else
        log_info "Health check summary: all ${total} containers healthy"
    fi

    return $failed
}

#===============================================================================
# Show status report
#===============================================================================
show_status() {
    log_info "=== Container Health Status ==="
    for container in "${CONTAINERS[@]}"; do
        local status health
        status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}"none"{{end}}' "$container" 2>/dev/null || echo "unknown")

        local icon="✅"
        if [ "$health" = "unhealthy" ] || [ "$status" != "running" ]; then
            icon="❌"
        elif [ "$health" = "starting" ]; then
            icon="⏳"
        fi

        printf "  %s %-30s status=%-10s health=%s\n" "$icon" "$container" "$status" "$health"
    done
}

#===============================================================================
# Main loop
#===============================================================================
main() {
    log_info "Starting Container Health Watchdog..."
    log_info "Monitoring interval: ${INTERVAL}s"
    log_info "Containers: ${CONTAINERS[*]}"

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --interval)
                INTERVAL="$2"
                shift 2
                ;;
            --log-file)
                LOG_FILE="$2"
                shift 2
                ;;
            status)
                show_status
                exit 0
                ;;
            *)
                echo "Usage: $0 {monitor|status} [--interval <seconds>] [--log-file <path>]"
                exit 1
                ;;
        esac
    done

    # Main monitoring loop
    while true; do
        monitor_containers
        sleep "$INTERVAL"
    done
}

#===============================================================================
# CLI Interface
#===============================================================================
case "${1:-monitor}" in
    monitor)
        main "$@"
        ;;
    status)
        show_status
        ;;
    *)
        echo "Usage: $0 {monitor|status} [--interval <seconds>] [--log-file <path>]"
        exit 1
        ;;
esac
