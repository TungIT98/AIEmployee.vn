# Frontend Dockerfile - Multi-stage build for static HTML/JS site
FROM node:20-alpine AS builder

WORKDIR /build

# Copy only package files for better layer caching
COPY package*.json ./

# For static HTML/JS, we don't need node build steps
# This stage is here for future asset compilation (e.g., TypeScript, SASS)
FROM nginx:alpine

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy static files
COPY . /usr/share/nginx/html/

# Custom nginx configuration for SPA routing and security headers
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
\
    # Security headers \
    add_header X-Frame-Options "SAMEORIGIN" always; \
    add_header X-Content-Type-Options "nosniff" always; \
    add_header X-XSS-Protection "1; mode=block" always; \
    add_header Referrer-Policy "strict-origin-when-cross-origin" always; \
\
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_proxied any; \
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json; \
\
    # Cache control for static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
\
    # SPA routing - serve index.html for all non-file routes \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
\
    # Health check endpoint \
    location /health { \
        access_log off; \
        return 200 "ok"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]