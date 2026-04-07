# AIEmployee.vn - Staging Environment

## Quick Start

```bash
# Start the staging environment
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api

# Stop
docker-compose down
```

## Services

| Service | URL | Description |
|---------|-----|-------------|
| API | http://localhost:3000 | Backend API |
| Frontend | http://localhost:8080 | Landing page |

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - API status
- `GET /api/plans` - Pricing plans
- `POST /api/contacts` - Contact form
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task

## Testing

```bash
# Run API tests
cd api && npm test
```

## Development

```bash
# Run API directly (without Docker)
cd api && npm run dev

# Rebuild after code changes
docker-compose up -d --build
```