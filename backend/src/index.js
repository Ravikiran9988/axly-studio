import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config, validateEnv } from './config/env.js';
import { closePool, query } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import authRoutes from './routes/auth.js';
import urlRoutes from './routes/urls.js';
import adminRoutes from './routes/admin.js';
import campaignRoutes from './routes/campaigns.js';
import experimentRoutes from './routes/experiments.js';
import analyticsRoutes from './routes/analytics.js';
import reportRoutes from './routes/reports.js';
import apiKeyRoutes from './routes/apiKeys.js';
import webhookRoutes from './routes/webhooks.js';
import workspaceRoutes from './routes/workspaces.js';
import domainRoutes from './routes/domains.js';
import pageRoutes from './routes/pages.js';
import privacyRoutes from './routes/privacy.js';
import notificationRoutes from './routes/notifications.js';
import telegramRoutes from './routes/telegram.js';
import { redirect, unlockPasswordProtectedLink } from './controllers/redirectController.js';

// Validate environment variables on startup
validateEnv();

const app = express();
const PORT = config.PORT;

// Trust proxy setting (for deployment behind Nginx / Cloudflare / reverse proxy)
if (config.TRUST_PROXY) {
  app.set('trust proxy', config.TRUST_PROXY);
}

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible SPA framing / external scripts if needed
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration: fixed first-party origins plus verified custom page domains.
// Domain registration does not grant API permissions; authenticated routes still require a session.
const allowedOrigins = [
  config.FRONTEND_URL,
  'https://url.axly.in',
  'https://axly.in',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:80',
  'http://localhost',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    let parsed;
    try { parsed = new URL(origin); } catch { return callback(null, false); }
    if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
      return callback(null, false);
    }
    if (parsed.hostname === 'axly.in' || parsed.hostname.endsWith('.axly.in')) {
      return callback(null, true);
    }
    query(
      "SELECT 1 FROM custom_domains WHERE LOWER(domain) = LOWER($1) AND domain_type = 'page' AND status = 'active' LIMIT 1",
      [parsed.hostname.toLowerCase()]
    ).then(result => callback(null, result.rows.length > 0))
      .catch(() => callback(null, false));
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (skip in test environment)
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Liveness probe (Kubernetes / container orchestrator)
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', liveness: true, timestamp: new Date().toISOString() });
});

// Readiness probe (checks database connection)
app.get('/readyz', async (req, res) => {
  try {
    const start = Date.now();
    await query('SELECT 1');
    const latency = Date.now() - start;
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      latencyMs: latency,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      database: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Global API rate limiting
const apiLimiter = rateLimit({
  windowMs: config.rateLimits.generalWindowMs,
  max: config.rateLimits.generalMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { 
    success: false, 
    message: 'Too many requests. Please try again later.' 
  }
});

app.use('/api/', apiLimiter);

// Health check endpoint (verifies database connectivity)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'healthy';
  let dbLatencyMs = null;

  try {
    const start = Date.now();
    await query('SELECT 1');
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  const statusCode = dbStatus === 'healthy' ? 200 : 503;

  res.status(statusCode).json({ 
    success: dbStatus === 'healthy', 
    status: dbStatus === 'healthy' ? 'ok' : 'degraded',
    message: 'Axly URL Shortener API', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      }
    }
  });
});

// Public platform broadcast / announcement banner
app.get('/api/announcement', async (req, res) => {
  try {
    const result = await query("SELECT value FROM platform_settings WHERE key = 'system_announcement_banner'");
    if (result.rows.length > 0 && result.rows[0].value && result.rows[0].value.enabled) {
      return res.json({ success: true, announcement: result.rows[0].value });
    }
    res.json({ success: true, announcement: null });
  } catch (err) {
    res.json({ success: true, announcement: null });
  }
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/experiments', experimentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/keys', apiKeyRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/user', privacyRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/telegram', telegramRoutes);

// Short URL redirection & password unlock route
app.post('/:shortCode/unlock', unlockPasswordProtectedLink);
app.get('/:shortCode', redirect);

// 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource not found.' });
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (config.NODE_ENV !== 'test') {
    console.error('Unhandled application error:', err);
  }
  res.status(err.status || 500).json({ 
    success: false, 
    message: err.message || 'Internal server error.' 
  });
});

let server;

// Process-level unhandled exception safety
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

// Start server only when run directly (not when imported by tests)
const isDirectEntry = process.env.NODE_ENV !== 'test' && 
  !process.argv[1]?.includes('test') && 
  Boolean(process.argv[1]?.replace(/\\/g, '/').endsWith('index.js'));

if (isDirectEntry) {
  // Gate incoming traffic on successful schema migration.
  runMigrations().then(() => {
    server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║               Axly URL Shortener                 ║
║            Production-Ready API v1.0.0           ║
╠══════════════════════════════════════════════════╣
║  >> API Server:    http://localhost:${PORT}         ║
║  -- Short Domain:  ${config.SHORT_DOMAIN.padEnd(29)} ║
║  -- Mode:          ${config.NODE_ENV.padEnd(29)} ║
╚══════════════════════════════════════════════════╝
    `);
    });
  }).catch(async (err) => {
    console.error('[FATAL] Database migrations failed; refusing to start API:', err.message);
    await closePool();
    process.exitCode = 1;
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}. Gracefully shutting down...`);
    if (server) {
      server.close(async () => {
        console.log('HTTP server closed.');
        await closePool();
        console.log('PostgreSQL pool drained. Exiting process.');
        process.exit(0);
      });
    } else {
      await closePool();
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { server };
export default app;
