# AIEmployee.vn Deployment Guide

**Platform:** Node.js / Express
**Port:** 3000 (default)
**Environment:** Development & Production

---

## Prerequisites

- Node.js 18+
- npm 9+
- 512MB RAM minimum
- Internet connection (for Vietnamese e-invoice API calls)

---

## Local Development

### 1. Install Dependencies

```bash
cd company-os/api
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

Server starts with hot-reload on `http://localhost:3000`.

### 3. Run Tests

```bash
npm test
```

---

## Production Deployment

### Option 1: Standalone Server

```bash
npm install --production
npm start
```

### Option 2: PM2 Process Manager (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/server.js --name aiemployee-api

# Enable startup script
pm2 startup
pm2 save
```

### Option 3: Docker

```bash
# Build image
docker build -t aiemployee-api .

# Run container
docker run -d -p 3000:3000 \
  --name aiemployee-api \
  aiemployee-api
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| NODE_ENV | development | Environment mode |
| DATA_DIR | ./data | Data storage directory |

### Example Production Start

```bash
PORT=8080 NODE_ENV=production npm start
```

---

## Data Storage

The API uses in-memory storage by default (`src/data/store.js`). Data persists while the process runs but is lost on restart.

### For Production Data Persistence

Replace `src/data/store.js` with a database adapter:

```javascript
// Example: MongoDB adapter
const MongoStore = require('./stores/mongo');
const store = new MongoStore(process.env.MONGODB_URI);
```

---

## Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name api.aiemployee.vn;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## SSL Termination

For HTTPS, place SSL certificate in front of the API:

```nginx
server {
    listen 443 ssl;
    server_name api.aiemployee.vn;

    ssl_certificate /etc/ssl/certs/aiemployee.crt;
    ssl_certificate_key /etc/ssl/private/aiemployee.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Health Checks

```bash
# Service status
curl http://localhost:3000/api/status

# Should return:
{
  "success": true,
  "data": {
    "service": "AIEmployee API",
    "version": "1.0.0",
    "status": "operational"
  }
}
```

### Nginx Health Check Config

```nginx
location /health {
    proxy_pass http://127.0.0.1:3000/api/status;
    access_log off;
}
```

---

## Logging

- **Development**: Console output with color
- **Production**: JSON logs to stdout (for PM2/Docker)

### Log Levels

```javascript
// In server.js, set NODE_ENV for log level
// development: verbose
// production: info + errors only
```

---

## Vietnamese E-Invoice (TKP ACI) Notes

The e-invoice feature calls external TKP ACI API endpoints. Ensure:

1. Firewall allows outbound HTTPS to TKP ACI portal
2. Valid TKP ACI credentials configured
3. Seller company has valid MST (tax code) registered

---

## Scaling

### Horizontal Scaling

Run multiple API instances behind a load balancer:

```bash
# Instance 1
pm2 start src/server.js --name aiemployee-1 -i 0

# Instance 2
PORT=3001 pm2 start src/server.js --name aiemployee-2
```

Note: In-memory storage does NOT sync across instances. Use a shared database for production.

---

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process on port 3000
lsof -i :3000
kill -9 <PID>
```

### E-Invoice Submission Fails
1. Check TKP ACI portal status
2. Verify seller/buyer tax codes are valid
3. Check network connectivity to TKP ACI

### High Memory Usage
```bash
pm2 restart aiemployee-api --update-env
```
