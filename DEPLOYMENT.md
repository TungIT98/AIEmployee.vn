# AIEmployee.vn Deployment Guide

## Overview

This document describes the CI/CD pipeline and deployment process for AIEmployee.vn.

## Architecture

```
GitHub Repo → GitHub Actions → Staging Server → Production Server
                (CI/CD)           (auto)           (manual)
```

## Environments

| Environment | URL | Branch | Deployment |
|-------------|-----|--------|------------|
| Staging | `https://staging.aiemployee.vn` | `main` | Automatic on merge |
| Production | `https://aiemployee.vn` | `main` | Manual approval |

## CI Pipeline

The CI pipeline runs on every pull request and push to `main`/`develop`:

1. **HTML Validation** - Validates HTML syntax using html5-parser
2. **Link Check** - Verifies all internal links exist
3. **JavaScript Lint** - Checks inline JavaScript for errors
4. **API Tests** - Runs Postman collection (when backend is ready)

## Deployment Pipeline

### Staging Deployment (Automatic)

1. Code merged to `main` branch
2. CI pipeline runs (tests must pass)
3. Automatic deployment to staging server
4. Smoke test verifies deployment

### Production Deployment (Manual)

1. Go to GitHub Actions → Deploy workflow
2. Click "Run workflow"
3. Select "production" environment
4. Wait for deployment to complete
5. Verify at `https://aiemployee.vn`

## GitHub Secrets Required

Configure these in GitHub → Settings → Secrets:

| Secret | Description |
|--------|-------------|
| `STAGING_SERVER` | SSH host for staging server |
| `STAGING_SSH_KEY` | Private SSH key for staging |
| `PRODUCTION_SERVER` | SSH host for production server |
| `PRODUCTION_SSH_KEY` | Private SSH key for production |

## Local Development

```bash
# Serve locally (requires Python)
cd products/aiemployee-vn
python -m http.server 8080

# Or with Node.js
npx serve .
```

## Future Backend API

When the backend API (COM-12) is implemented:

1. Add `api/` folder with endpoints
2. Include Postman collection at `api/aiemployee-api.postman_collection.json`
3. Set up `api/staging.postman_environment.json` and `api/production.postman_environment.json`
4. Enable `api-tests` job in `ci.yml`
5. Add API URL secrets

## Rollback Procedure

If a deployment fails:

1. Go to GitHub Actions → Deploy workflow
2. Find the last successful run
3. Click "Re-run jobs"

For manual rollback on servers:

```bash
# On staging/production server
cd /var/www/aiemployee-vn
git pull origin main
```

## Monitoring

- Staging: Check logs at `/var/log/aiemployee-vn/staging.log`
- Production: Check logs at `/var/log/aiemployee-vn/production.log`

## Support

For deployment issues, contact the DevOps engineer or create an issue in the project.