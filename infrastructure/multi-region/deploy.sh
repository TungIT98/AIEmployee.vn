#!/bin/bash
#===============================================================================
# Multi-Region Deployment Script
# Usage: ./deploy.sh [--region <region>] [--version <version>] [--rollback]
#===============================================================================
set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGION="${REGION:-us-east-1}"
VERSION="${VERSION:-latest}"
IMAGE_REGISTRY="${IMAGE_REGISTRY:-registry.example.com}"
CDN_PROVIDER="${CDN_PROVIDER:-cloudflare}"
LOG_FILE="/var/log/aiemployee-deploy.log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

#-------------------------------------------------------------------------------
# Logging functions
#-------------------------------------------------------------------------------
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
log_success() { log "${GREEN}SUCCESS${NC}" "$*"; }

#-------------------------------------------------------------------------------
# Pre-deployment checks
#-------------------------------------------------------------------------------
pre_deploy_check() {
    log_info "Running pre-deployment checks..."

    # Check Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check required environment variables
    local required_vars=("IMAGE_REGISTRY" "CDN_API_TOKEN")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log_warn "Environment variable ${var} is not set"
        fi
    done

    # Check Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed"
        exit 1
    fi

    log_success "Pre-deployment checks passed"
}

#-------------------------------------------------------------------------------
# Build and push images
#-------------------------------------------------------------------------------
build_and_push_images() {
    log_info "Building and pushing images for version ${VERSION}..."

    local services=("api" "cdn-purger" "backup-agent" "health-monitor")

    for service in "${services[@]}"; do
        log_info "Building ${service}..."
        docker build -t "${IMAGE_REGISTRY}/aiemployee-${service}:${VERSION}" \
                     -t "${IMAGE_REGISTRY}/aiemployee-${service}:latest" \
                     "./services/${service}"

        log_info "Pushing ${service}..."
        docker push "${IMAGE_REGISTRY}/aiemployee-${service}:${VERSION}"
        docker push "${IMAGE_REGISTRY}/aiemployee-${service}:latest"
    done

    log_success "Images built and pushed"
}

#-------------------------------------------------------------------------------
# Deploy to region
#-------------------------------------------------------------------------------
deploy_to_region() {
    local target_region="$1"
    log_info "Deploying to region: ${target_region}"

    # Set region-specific environment
    export REGION="${target_region}"

    # Create region-specific override file
    local override_file="${SCRIPT_DIR}/docker-compose.${target_region}.yml"

    if [[ -f "$override_file" ]]; then
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" \
                       -f "$override_file" \
                       config > "${SCRIPT_DIR}/.docker-compose-merged.yml"
        docker-compose -f "${SCRIPT_DIR}/.docker-compose-merged.yml" up -d
    else
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" up -d
    fi

    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    sleep 30

    # Verify deployment
    if curl -sf "http://localhost:3000/health" > /dev/null; then
        log_success "Deployment to ${target_region} successful"
    else
        log_error "Health check failed for ${target_region}"
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# Purge CDN cache
#-------------------------------------------------------------------------------
purge_cdn_cache() {
    log_info "Purging CDN cache..."

    case "${CDN_PROVIDER}" in
        cloudflare)
            curl -X POST "https://api.cloudflare.com/client/v4/zones/${CDN_ZONE_ID}/purge_cache" \
                 -H "Authorization: Bearer ${CDN_API_TOKEN}" \
                 -H "Content-Type: application/json" \
                 --data '{"files":["https://app.example.com/*","https://assets.example.com/*"]}'
            ;;
        cloudfront)
            aws cloudfront create-invalidation \
               --distribution-id "${CLOUDFRONT_DISTRIBUTION_ID}" \
               --paths "/*"
            ;;
        *)
            log_warn "Unknown CDN provider: ${CDN_PROVIDER}"
            ;;
    esac

    log_success "CDN cache purged"
}

#-------------------------------------------------------------------------------
# Run smoke tests
#-------------------------------------------------------------------------------
run_smoke_tests() {
    log_info "Running smoke tests..."

    local endpoints=(
        "http://localhost:3000/health"
        "http://localhost:3000/api/status"
        "http://localhost:5601/api/status"
    )

    for endpoint in "${endpoints[@]}"; do
        if curl -sf "$endpoint" > /dev/null; then
            log_success "Smoke test passed: $endpoint"
        else
            log_error "Smoke test failed: $endpoint"
            return 1
        fi
    done

    log_success "All smoke tests passed"
}

#-------------------------------------------------------------------------------
# Rollback to previous version
#-------------------------------------------------------------------------------
rollback() {
    log_warn "Rolling back to previous version..."

    local previous_version=$(docker images "${IMAGE_REGISTRY}/aiemployee-api" \
                             --format "{{.Tag}}" | head -n 2 | tail -n 1)

    if [[ -z "$previous_version" ]]; then
        log_error "No previous version found to rollback to"
        exit 1
    fi

    VERSION="$previous_version" deploy_to_region "$REGION"
    log_success "Rollback to ${previous_version} completed"
}

#-------------------------------------------------------------------------------
# Main deployment workflow
#-------------------------------------------------------------------------------
main() {
    log_info "Starting multi-region deployment..."
    log_info "Region: ${REGION}, Version: ${VERSION}"

    pre_deploy_check

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --region)
                REGION="$2"
                shift 2
                ;;
            --version)
                VERSION="$2"
                shift 2
                ;;
            --rollback)
                rollback
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    build_and_push_images
    deploy_to_region "$REGION"
    purge_cdn_cache
    run_smoke_tests

    log_success "Deployment completed successfully!"
    log_info "Services are available at:"
    log_info "  API: https://api.example.com (region: ${REGION})"
    log_info "  Kibana: https://kibana.example.com"
}

#-------------------------------------------------------------------------------
# CLI Interface
#-------------------------------------------------------------------------------
case "${1:-}" in
    deploy)
        shift
        main "$@"
        ;;
    status)
        log_info "Checking deployment status..."
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" ps
        ;;
    logs)
        shift
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" logs "$@"
        ;;
    stop)
        log_info "Stopping all services..."
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" down
        ;;
    clean)
        log_warn "Cleaning up containers and volumes..."
        docker-compose -f "${SCRIPT_DIR}/docker-compose.global.yml" down -v
        ;;
    *)
        echo "Usage: $0 {deploy|status|logs|stop|clean} [options]"
        echo ""
        echo "Commands:"
        echo "  deploy          Deploy services to region"
        echo "  status          Show deployment status"
        echo "  logs            Show service logs"
        echo "  stop            Stop all services"
        echo "  clean           Stop and remove all containers and volumes"
        echo ""
        echo "Options:"
        echo "  --region <region>   Target region (default: us-east-1)"
        echo "  --version <version> Docker image version (default: latest)"
        echo "  --rollback          Rollback to previous version"
        exit 1
        ;;
esac