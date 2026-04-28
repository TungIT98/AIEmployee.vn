const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const apiRoutes = require('./routes/api');
const dashboardRoutes = require('./routes/dashboard');
const { ApiSecurityService, InputSanitizer } = require('./services/apiSecurity');
const { LoggingService, accessLogMiddleware } = require('./services/logging');
const { RealTimeService } = require('./services/realTime');
const { AgentLifecycleManager } = require('./state/agentManager');
const { TaskQueueManager } = require('./state/taskQueue');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Create HTTP server for WebSocket support
const server = http.createServer(app);

// Initialize Real-Time Service (WebSocket/SSE)
const realTimeService = new RealTimeService(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://aiemployee.vn',
      'https://www.aiemployee.vn',
      'http://localhost:8080',
      'http://localhost:3000',
      'null'
    ],
    methods: ['GET', 'POST']
  }
});

// Initialize Agent Lifecycle Manager
const agentManager = new AgentLifecycleManager({
  healthCheckInterval: 60000
});

// Initialize Task Queue Manager (global for dashboard access)
const taskQueueManager = new TaskQueueManager({
  maxConcurrent: 5
});

// Global references for dashboard routes
global.agentManager = agentManager;
global.taskQueueManager = taskQueueManager;

// Initialize logging service with ELK integration
const loggingService = new LoggingService({
  elasticsearchEnabled: process.env.ELASTICSEARCH_URL ? true : false,
  logstashHost: process.env.LOGSTASH_HOST || 'localhost',
  logstashPort: process.env.LOGSTASH_PORT || 5044,
  serviceName: 'aiemployee-api'
});

// Initialize API security service with rate limiting
const apiSecurity = new ApiSecurityService({
  redisUrl: process.env.REDIS_URL, // Optional Redis for distributed rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute window
    maxRequests: 100    // 100 requests per window
  }
});

const sanitizer = new InputSanitizer();

// Middleware

// SSL/TLS Enforcement: Redirect HTTP to HTTPS in production
// Note: In production, this should also be handled at the load balancer/reverse proxy level
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      return next();
    }
    // Redirect HTTP to HTTPS
    const httpsHost = req.headers['host']?.replace(/:\d+$/, (m) => m.replace(/^\:/, ':443'));
    return res.redirect(301, `https://${httpsHost || req.headers.host}${req.originalUrl}`);
  });
}

// Enhanced Security Headers (SSL/TLS enforcement per COM-G7)
// Configure helmet with strict HSTS and security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [] // Force upgrade of HTTP to HTTPS
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  xFrameOptions: 'DENY',
  referrerPolicy: 'strict-origin-when-cross-origin'
}));

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'https://aiemployee.vn',
    'https://www.aiemployee.vn',
    'http://localhost:8080',
    'http://localhost:3000',
    'null'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  credentials: true,
  maxAge: 86400 // 24 hours preflight cache
}));
app.use(express.json({ limit: '10kb' })); // Prevent large payload attacks

// Request ID middleware for tracing (A04: Insecure Design - exception handling)
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Apply access logging middleware (logs all API requests to ELK)
app.use(accessLogMiddleware(loggingService));

// Apply rate limiting to all API routes (per IP + endpoint)
app.use('/api', apiSecurity.rateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 100,
  endpoints: {
    // Stricter limits for auth endpoints
    '/auth/login': { maxRequests: 10, windowMs: 60 * 1000 },
    '/auth/register': { maxRequests: 10, windowMs: 60 * 1000 },
    '/auth/reset-password': { maxRequests: 5, windowMs: 60 * 1000 },
    // Standard API limits
    '/contacts': { maxRequests: 30, windowMs: 60 * 1000 },
    '/subscriptions': { maxRequests: 30, windowMs: 60 * 1000 },
    '/employees': { maxRequests: 50, windowMs: 60 * 1000 },
    '/tasks': { maxRequests: 50, windowMs: 60 * 1000 }
  }
}));

// SSRF Protection Middleware (A10:2023 - Server-Side Request Forgery)
app.use('/api', (req, res, next) => {
  // Validate URLs in request body before processing
  if (req.body && typeof req.body === 'object') {
    const urlFields = ['url', 'webhookUrl', 'callbackUrl', 'redirectUri', 'website'];
    for (const field of urlFields) {
      if (req.body[field]) {
        const validated = sanitizer.sanitizeUrl(req.body[field]);
        if (!validated) {
          return res.status(400).json({
            error: 'Invalid URL',
            message: `URL in field '${field}' is not allowed. Only http/https protocols are permitted.`,
            requestId: req.id
          });
        }
        req.body[field] = validated;
      }
    }
  }
  next();
});

// Register real-time event listeners
realTimeService.registerAgentManager(agentManager);
realTimeService.registerTaskQueue(taskQueueManager);

// Initialize dashboard routes with real-time service
dashboardRoutes.initialize({
  realTimeService,
  dashboardAnalytics: null // Will be set if dashboard analytics is available
});

// Routes
app.use('/api', apiRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      logging: loggingService.getStatus(),
      realTime: realTimeService.getStatus()
    }
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', requestId: req.id });
});

// Enhanced Error Handler (A04: Insecure Design - exception handling)
// Differentiates error types, includes correlation ID, doesn't leak stack traces
app.use((err, req, res, next) => {
  const correlationId = req.id;

  // Log error to ELK via logging service
  loggingService.logError({
    message: err.message,
    error: err,
    stack: err.stack,
    resource: req.path,
    userId: req.user?.id,
    metadata: {
      method: req.method,
      correlationId,
      statusCode: err.status || err.statusCode || 500
    }
  });

  // Determine status code based on error type
  let statusCode = err.status || err.statusCode || 500;

  // Don't leak internal error details in production
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    err.message = 'Internal server error';
  }

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    requestId: correlationId
  });
});

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('Shutting down gracefully...');
  realTimeService.shutdown();
  await loggingService.shutdown();
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Only start server if running directly (not imported for testing)
if (require.main === module) {
  // Initialize WebSocket server
  realTimeService.initialize();

  server.listen(PORT, () => {
    console.log(`AIEmployee API server running on port ${PORT}`);
    console.log(`Logging to ELK: ${loggingService.getStatus().elasticsearch.enabled}`);
    console.log(`Real-time service: ${realTimeService.getStatus().status}`);
  });
}

module.exports = { app, server, loggingService, apiSecurity, realTimeService, agentManager, taskQueueManager };
