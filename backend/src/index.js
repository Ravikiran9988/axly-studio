import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config, validateEnv } from './config/env.js';
import { closePool, query } from './db/pool.js';
import authRoutes from './routes/auth.js';
import urlRoutes from './routes/urls.js';
import { redirect } from './controllers/redirectController.js';

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

// CORS configuration
app.use(cors({
  origin: [
    config.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:80',
    'http://localhost',
  ],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (skip in test environment)
if (config.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

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

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/urls', urlRoutes);

// Short URL redirection route (public, handles /:shortCode)
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

// Start server only when run directly (not when required/imported by test runners)
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  server = app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════╗
║               Axly URL Shortener                 ║
║            Production-Ready API v1.0.0           ║
╠══════════════════════════════════════════════════╣
║  🚀 API Server:    http://localhost:${PORT}         ║
║  🌐 Short Domain:  ${config.SHORT_DOMAIN.padEnd(29)} ║
║  📊 Mode:          ${config.NODE_ENV.padEnd(29)} ║
╚══════════════════════════════════════════════════╝
    `);
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
