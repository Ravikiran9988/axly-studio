/**
 * Axly Studio Telegram Bot Application Entry Point
 * Standalone service for Render, Railway, VPS, or Docker.
 */
import http from 'http';
import { createHash, timingSafeEqual } from 'node:crypto';
import dotenv from 'dotenv';
import { createBot } from './bot.js';

dotenv.config();

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const API_URL = (process.env.AXLY_API_URL || '').trim();
const BOT_SECRET = process.env.TELEGRAM_BOT_SECRET || '';
const USE_WEBHOOK = process.env.USE_WEBHOOK === 'true' || process.env.USE_WEBHOOK === '1';
const WEBHOOK_DOMAIN = (process.env.WEBHOOK_DOMAIN || '').trim();
const WEBHOOK_SECRET_TOKEN = process.env.WEBHOOK_SECRET_TOKEN || '';
// A path derived from the private bot token is harder to guess than the public bot ID.
const SECRET_PATH = `/webhook/${BOT_TOKEN ? createHash('sha256').update(BOT_TOKEN).digest('hex') : 'bot'}`;
const INSECURE_BOT_SECRETS = new Set([
  'axly_telegram_bot_internal_secret_key',
  'replace_with_a_secure_random_32_character_bot_secret',
  'replace_with_random_32_char_or_longer_secret',
  'changeme',
  'secret',
]);

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
      const suppliedSecret = req.headers['x-telegram-bot-api-secret-token'];
      const supplied = typeof suppliedSecret === 'string' ? Buffer.from(suppliedSecret) : Buffer.alloc(0);
      const expected = Buffer.from(WEBHOOK_SECRET_TOKEN);
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
        res.writeHead(403);
        return res.end();
      }
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
  if (process.env.NODE_ENV === 'production' && (BOT_SECRET.length < 32 || INSECURE_BOT_SECRETS.has(BOT_SECRET.toLowerCase()))) {
    throw new Error('TELEGRAM_BOT_SECRET must be a non-placeholder random value of at least 32 characters in production.');
  }
  if (USE_WEBHOOK) {
    if (!WEBHOOK_DOMAIN) {
      throw new Error('WEBHOOK_DOMAIN is required when USE_WEBHOOK=true.');
    }
    let parsedWebhookDomain;
    try {
      parsedWebhookDomain = new URL(WEBHOOK_DOMAIN);
    } catch {
      throw new Error('WEBHOOK_DOMAIN must be a valid absolute URL.');
    }
    if (parsedWebhookDomain.protocol !== 'https:') {
      throw new Error('WEBHOOK_DOMAIN must use HTTPS.');
    }
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(WEBHOOK_SECRET_TOKEN)) {
      throw new Error('WEBHOOK_SECRET_TOKEN must be a random 32-256 character token when USE_WEBHOOK=true.');
    }
  }
};

const main = async () => {
  validateBotEnvironment();
  console.log(`[INFO] Starting Axly Studio Telegram Bot in ${USE_WEBHOOK ? 'webhook' : 'long-polling'} mode.`);
  startServer();
  bot = createBot(BOT_TOKEN);
  // Validate the Telegram credential before registering the bot as healthy.
  bot.botInfo = await bot.telegram.getMe();
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Open welcome screen and main menu' },
    { command: 'shorten', description: 'Shorten a URL' },
    { command: 'alias', description: 'Create a custom short-link alias' },
    { command: 'qr', description: 'Generate a QR code for a URL' },
    { command: 'mylinks', description: 'View and manage your links' },
    { command: 'stats', description: 'View click analytics and statistics' },
    { command: 'account', description: 'View or connect your Axly account' },
    { command: 'link', description: 'Link your Axly account with a code' },
    { command: 'settings', description: 'Change bot preferences' },
    { command: 'cancel', description: 'Cancel the current action' },
    { command: 'help', description: 'Show all commands and instructions' },
  ]);
  console.log('[OK] Telegram command menu registered.');

  if (USE_WEBHOOK) {
    const webhookUrl = `${WEBHOOK_DOMAIN.replace(/\/+$/, '')}${SECRET_PATH}`;
    webhookCallback = bot.webhookCallback(SECRET_PATH);
    console.log('[INFO] Registering Telegram webhook.');
    await bot.telegram.setWebhook(webhookUrl, { secret_token: WEBHOOK_SECRET_TOKEN, drop_pending_updates: false });
    botReady = true;
    console.log('[OK] Telegram webhook registered; bot is ready.');
    return;
  }

  // Preflight polling configuration. In Telegraf 4.x, launch() can remain pending
  // for the lifetime of long-polling, so do not await it to set readiness.
  await bot.telegram.deleteWebhook({ drop_pending_updates: false });
  const pollingPromise = bot.launch({ dropPendingUpdates: false });
  botReady = true;
  pollingPromise.catch((err) => {
    console.error('[FATAL] Telegram polling stopped:', err.message);
    shutdown('POLLING_FAILED', 1);
  });
  console.log('[OK] Axly Studio Telegram Bot is ready and listening for updates.');
};

const shutdown = (signal, exitCode = 0) => {
  console.log(`Received ${signal}. Shutting down Axly Studio Telegram Bot...`);
  botReady = false;
  if (bot) {
    try { bot.stop(signal); } catch { /* Bot may not have completed startup. */ }
  }
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

const entrypoint = (process.argv[1] || '').split(String.fromCharCode(92)).join('/');
const isDirectEntry = entrypoint.endsWith('telegram-bot/src/index.js') || entrypoint.endsWith('src/index.js');

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
