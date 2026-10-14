/**
 * Axly Studio Telegram Bot Application Entry Point
 * Standalone service for Render, Railway, VPS, or Docker.
 */
import http from 'http';
import dotenv from 'dotenv';
import { createBot } from './bot.js';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const API_URL = (process.env.AXLY_API_URL || '').trim();
const BOT_SECRET = process.env.TELEGRAM_BOT_SECRET || '';
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true' || process.env.USE_WEBHOOK === '1';
const WEBHOOK_DOMAIN = (process.env.WEBHOOK_DOMAIN || '').trim();
const SECRET_PATH = `/webhook/${BOT_TOKEN ? BOT_TOKEN.split(':')[0] : 'bot'}`;

let server;
let bot;
let botReady = false;
let webhookCallback;

const startServer = () => {
  server = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/health' || req.url === '/') {
      const statusCode = botReady ? 200 : 503;
      res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({
        status: botReady ? 'ok' : 'not_ready',
        service: 'axly-telegram-bot',
        timestamp: new Date().toISOString(),
        mode: USE_WEBHOOK ? 'webhook' : 'polling',
      }));
    }

    if (USE_WEBHOOK && botReady && webhookCallback && req.url === SECRET_PATH && req.method === 'POST') {
      return webhookCallback(req, res);
    }

    res.writeHead(404);
    res.end();
  });

  server.on('error', (err) => {
    console.error('[FATAL] Health server error:', err.message);
    botReady = false;
  });

  server.listen(PORT, () => {
    console.log(`[OK] Health check server listening on port ${PORT}`);
  });
};

const validateBotEnvironment = () => {
  if (!BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is required; refusing to run a health-only bot service.');
  }
  if (!API_URL) {
    throw new Error('AXLY_API_URL is required; configure it to the deployed Axly API.');
  }
  let parsedApiUrl;
  try {
    parsedApiUrl = new URL(API_URL);
  } catch {
    throw new Error('AXLY_API_URL must be a valid absolute URL.');
  }
  if (process.env.NODE_ENV === 'production' && parsedApiUrl.protocol !== 'https:') {
    throw new Error('AXLY_API_URL must use HTTPS in production.');
  }
  if (process.env.NODE_ENV === 'production' && BOT_SECRET.length < 32) {
    throw new Error('TELEGRAM_BOT_SECRET must be configured with at least 32 characters in production.');
  }
  if (USE_WEBHOOK && !WEBHOOK_DOMAIN) {
    throw new Error('WEBHOOK_DOMAIN is required when USE_WEBHOOK=true.');
  }
};

const main = async () => {
  validateBotEnvironment();
  console.log(`[INFO] Starting Axly Studio Telegram Bot in ${USE_WEBHOOK ? 'webhook' : 'long-polling'} mode.`);
  startServer();
  bot = createBot(BOT_TOKEN);

  if (USE_WEBHOOK) {
    const webhookUrl = `${WEBHOOK_DOMAIN.replace(/\\/+$/, '')}${SECRET_PATH}`;
    webhookCallback = bot.webhookCallback(SECRET_PATH);
    console.log('[INFO] Registering Telegram webhook.');
    await bot.telegram.setWebhook(webhookUrl);
    botReady = true;
    console.log('[OK] Telegram webhook registered; bot is ready.');
    return;
  }

  console.log('[INFO] Starting Telegram long-polling.');
  await bot.launch({ dropPendingUpdates: false });
  botReady = true;
  console.log('[OK] Axly Studio Telegram Bot is ready and listening for updates.');
};

const shutdown = (signal, exitCode = 0) => {
  console.log(`Received ${signal}. Shutting down Axly Studio Telegram Bot...`);
  botReady = false;
  if (bot) bot.stop(signal);
  if (server?.listening) {
    server.close(() => process.exit(exitCode));
  } else {
    process.exit(exitCode);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Promise Rejection:', reason);
  shutdown('UNHANDLED_REJECTION', 1);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  shutdown('UNCAUGHT_EXCEPTION', 1);
});

const isDirectEntry = process.argv[1]?.replace(/\\\\/g, '/').endsWith('telegram-bot/src/index.js') ||
  process.argv[1]?.replace(/\\\\/g, '/').endsWith('src/index.js');

if (process.env.NODE_ENV !== 'test' && isDirectEntry) {
  main().catch((err) => {
    console.error('[FATAL] Bot startup failed:', err.message);
    botReady = false;
    if (server?.listening) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });
}

export { server, bot, startServer };
