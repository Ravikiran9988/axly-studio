/**
 * Axly Studio Telegram Bot Application Entry Point
 * Designed for standalone deployment on Render, Railway, VPS, or Docker
 */

import http from 'http';
import dotenv from 'dotenv';
import { createBot } from './bot.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true' || process.env.USE_WEBHOOK === '1';
const WEBHOOK_DOMAIN = process.env.WEBHOOK_DOMAIN;
const SECRET_PATH = `/webhook/${BOT_TOKEN ? BOT_TOKEN.split(':')[0] : 'bot'}`;

let server;
let bot;

const startServer = () => {
  // Lightweight HTTP server for Render health checks and Webhook receiver
  server = http.createServer(async (req, res) => {
    // 1. Health check probes
    if (req.url === '/healthz' || req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        service: 'axly-telegram-bot',
        timestamp: new Date().toISOString(),
        mode: USE_WEBHOOK ? 'webhook' : 'polling',
      }));
    }

    // 2. Webhook endpoint if enabled
    if (USE_WEBHOOK && bot && req.url === SECRET_PATH && req.method === 'POST') {
      try {
        const webhookCallback = bot.webhookCallback(SECRET_PATH);
        return webhookCallback(req, res);
      } catch (err) {
        console.error('Webhook processing error:', err);
        res.writeHead(500);
        return res.end();
      }
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, () => {
    console.log(`[OK] Health check server listening on port ${PORT}`);
  });
};

const main = async () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║             Axly Studio Telegram Bot             ║
║            Production-Ready Integration          ║
╠══════════════════════════════════════════════════╣
║  -- Mode:      ${(process.env.NODE_ENV || 'development').padEnd(33)} ║
║  -- Port:      ${String(PORT).padEnd(33)} ║
║  -- Transport: ${(USE_WEBHOOK ? 'Webhook' : 'Long-Polling').padEnd(33)} ║
║  -- API URL:   ${(process.env.AXLY_API_URL || 'http://localhost:5000').padEnd(33)} ║
╚══════════════════════════════════════════════════╝
  `);

  startServer();

  if (!BOT_TOKEN) {
    console.warn('[WARN] TELEGRAM_BOT_TOKEN is not defined in environment.');
    console.warn('[WARN] Bot message listener is paused. HTTP health check server is active.');
    return;
  }

  try {
    bot = createBot(BOT_TOKEN);

    if (USE_WEBHOOK && WEBHOOK_DOMAIN) {
      const webhookUrl = `${WEBHOOK_DOMAIN.replace(/\/+$/, '')}${SECRET_PATH}`;
      console.log(`[INFO] Configuring webhook at: ${webhookUrl}`);
      await bot.telegram.setWebhook(webhookUrl);
      console.log('[OK] Telegram webhook registered successfully.');
    } else {
      console.log('[INFO] Launching Telegram bot with long-polling (dropPendingUpdates: true)...');
      await bot.launch({
        dropPendingUpdates: true,
      });
      console.log('[OK] Axly Studio Telegram Bot is actively listening for updates!');
    }
  } catch (err) {
    console.error('[FATAL] Failed to initialize Telegram Bot:', err.message);
  }
};

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  if (bot) {
    bot.stop(signal);
  }
  if (server) {
    server.close(() => {
      console.log('HTTP server closed. Exiting process.');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Prevent unhandled crashes
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Promise Rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

// Run directly
const isDirectEntry = process.argv[1]?.replace(/\\/g, '/').endsWith('telegram-bot/src/index.js') ||
  process.argv[1]?.replace(/\\/g, '/').endsWith('src/index.js');

if (process.env.NODE_ENV !== 'test' && isDirectEntry) {
  main();
}

export { server, bot, startServer };
