/**
 * Axly Studio Telegram Bot Initialization & Route Registration
 */

import { Telegraf } from 'telegraf';
import { rateLimitMiddleware } from './middleware/rateLimit.js';
import { authSessionMiddleware, setUserState } from './middleware/authSession.js';

import { handleStart } from './handlers/start.js';
import { handleHelp } from './handlers/help.js';
import { handleShortenCommand, handleDirectTextMessage, extractUrlFromTelegramMessage, executeShorten } from './handlers/shorten.js';
import { handleQrCommand, handleQrCallback, executeGenerateQr } from './handlers/qr.js';
import { handleMyLinks, handleMyLinksCallback } from './handlers/myLinks.js';
import { handleStatsCommand, handleStatsCallback } from './handlers/stats.js';
import {
  handleAccount,
  handleLinkCommand,
  handleUnlinkConfirm,
  handleUnlinkExecute,
} from './handlers/account.js';
import { handleSettings, handleToggleAutoQr } from './handlers/settings.js';
import { handleCancel } from './handlers/cancel.js';
import { getCancelKeyboard } from './utils/keyboards.js';

/**
 * Creates and configures the Telegraf bot instance
 * @param {string} token 
 * @returns {Telegraf}
 */
export const createBot = (token) => {
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is missing.');
  }

  const bot = new Telegraf(token);

  // 1. Global Middleware
  bot.use(rateLimitMiddleware);
  bot.use(authSessionMiddleware);

  // 2. Command Handlers
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('shorten', handleShortenCommand);
  bot.command('qr', handleQrCommand);
  bot.command('mylinks', (ctx) => handleMyLinks(ctx, 1));
  bot.command('stats', handleStatsCommand);
  bot.command('account', handleAccount);
  bot.command('link', handleLinkCommand);
  bot.command('settings', handleSettings);
  bot.command('cancel', handleCancel);

  // 3. Inline Keyboard Action Callbacks
  bot.action('action:prompt_shorten', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    setUserState(ctx.from.id, 'awaiting_shorten_url');
    return ctx.reply(
      '🔗 <b>Please send the long URL you want to shorten:</b>\n(e.g. <code>https://yourwebsite.com/long-page</code>)',
      {
        parse_mode: 'HTML',
        reply_markup: getCancelKeyboard(),
      }
    );
  });

  bot.action('action:prompt_qr', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
    setUserState(ctx.from.id, 'awaiting_qr_url');
    return ctx.reply(
      '📱 <b>Please send the URL you want to convert into a QR code:</b>\n(e.g. <code>https://example.com</code>)',
      {
        parse_mode: 'HTML',
        reply_markup: getCancelKeyboard(),
      }
    );
  });

  bot.action(/^action:mylinks:(\d+)$/, handleMyLinksCallback);
  bot.action(/^action:stats(:.*)?$/, handleStatsCallback);
  bot.action(/^action:qr:(.+)$/, handleQrCallback);
  bot.action('action:account', handleAccount);
  bot.action('action:unlink_confirm', handleUnlinkConfirm);
  bot.action('action:unlink_do', handleUnlinkExecute);
  bot.action('action:settings', handleSettings);
  bot.action('action:toggle_auto_qr', handleToggleAutoQr);
  bot.action('action:menu', handleStart);
  bot.action('action:help', handleHelp);
  bot.action('action:cancel', handleCancel);
  bot.action('action:noop', async (ctx) => {
    await ctx.answerCbQuery().catch(() => {});
  });

  // 4. Text Message Processing (Conversational state & Direct URLs)
  bot.on('text', async (ctx, next) => {
    // If user is waiting to input a QR URL
    if (ctx.userState === 'awaiting_qr_url') {
      const text = ctx.message.text.trim();
      return executeGenerateQr(ctx, text);
    }

    return handleDirectTextMessage(ctx, next);
  });

  // 5. Forwarded media/posts may carry URLs in captions, including hidden text links.
  // Text updates are handled above; this handler only processes caption-only messages.
  bot.on('message', async (ctx, next) => {
    const message = ctx.message;
    if (!message || typeof message.text === 'string' || typeof message.caption !== 'string') {
      return next();
    }
    const extracted = extractUrlFromTelegramMessage(message);
    if (!extracted) return next();

    const isForwarded = Boolean(
      message.forward_origin || message.forward_from ||
      message.forward_from_chat || message.is_automatic_forward
    );
    return executeShorten(ctx, extracted, isForwarded ? { forwardedMessage: message } : {});
  });

  // 6. Centralized Error Handler
  bot.catch((err, ctx) => {
    console.error(`[TELEGRAM ERROR] Update ${ctx.update?.update_id}:`, err.message);
    // Never leak secrets or stack traces to the user
    ctx.reply(
      '⚠️ <b>Oops! Something went wrong.</b> Please try again or use <code>/cancel</code> to reset.',
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

  return bot;
};
