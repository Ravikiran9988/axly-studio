/**
 * URL Shortening Handler (/shorten and Direct URL Input)
 */

import QRCode from 'qrcode';
import { validateUrl, extractUrlFromText, isValidCustomAlias } from '../utils/validation.js';
import { formatLinkCreatedMessage, escapeHtml } from '../utils/formatters.js';
import { getLinkActionsKeyboard, getCancelKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';
import { createShortUrl } from '../services/axlyApi.js';
import { setUserState, clearUserState } from '../middleware/authSession.js';

/**
 * Handle URL shortening operation
 */
export const executeShorten = async (ctx, rawUrl, options = {}) => {
  const validation = validateUrl(rawUrl);
  if (!validation.valid) {
    return ctx.reply(`⚠️ ${validation.error}`, {
      reply_markup: getCancelKeyboard(),
    });
  }

  const targetUrl = validation.url;
  const customAlias = options.customAlias ? String(options.customAlias).trim().toLowerCase() : null;

  if (customAlias) {
    if (!ctx.auth?.isLinked || !ctx.auth?.token) {
      return ctx.reply(
        '🔐 <b>Custom aliases require a linked Axly account.</b>\n\nUse <code>/account</code> to connect your account, then try again.',
        { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() }
      );
    }
    if (!isValidCustomAlias(customAlias)) {
      return ctx.reply(
        '⚠️ Alias must be 3–30 characters using letters, numbers, hyphens or underscores.',
        { parse_mode: 'HTML', reply_markup: getCancelKeyboard() }
      );
    }
  }

  clearUserState(ctx.from.id);

  const loadingMsg = await ctx.reply('⚡ <i>Shortening link with Axly Studio...</i>', {
    parse_mode: 'HTML',
  });

  try {
    const isGuest = !ctx.auth?.isLinked;
    const userToken = ctx.auth?.isLinked ? ctx.auth.token : null;
    const response = await createShortUrl(targetUrl, userToken, customAlias);

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    const linkData = response.data;
    const shortUrl = linkData.shortUrl || linkData.short_url;
    const message = formatLinkCreatedMessage(linkData, isGuest, ctx.auth?.user);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: getLinkActionsKeyboard(linkData.shortCode || linkData.short_code, shortUrl),
    });

    // If auto-QR is enabled, also generate and send QR code
    if (ctx.preferences?.autoQr) {
      try {
        const qrBuffer = await QRCode.toBuffer(shortUrl, {
          width: 360,
          margin: 2,
          color: { dark: '#4c1d95', light: '#ffffff' },
        });
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          { caption: `📱 QR Code for ${shortUrl}` }
        );
      } catch (qrErr) {
        console.error('Auto QR generation error:', qrErr.message);
      }
    }
  } catch (err) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    if (err.code === 'GUEST_RATE_LIMIT_EXCEEDED') {
      return ctx.reply(
        `⏳ <b>Guest Rate Limit Reached</b>\n\nYou've reached the free guest limit (10 links/hr).\nPlease link your free Axly account with <code>/account</code> to continue creating links!`,
        {
          parse_mode: 'HTML',
          reply_markup: getMainMenuKeyboard(),
        }
      );
    }

    return ctx.reply(
      `❌ <b>Failed to Shorten URL:</b>\n${escapeHtml(err.message || 'Server error occurred.')}`,
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  }
};

/**
 * Handle /shorten command
 */
export const handleShortenCommand = async (ctx) => {
  const text = ctx.message?.text || '';
  const parts = text.trim().split(/\s+/);
  const candidate = parts[1] || '';
  const customAlias = parts[2] || null;

  if (parts.length > 3) {
    return ctx.reply(
      'Usage: <code>/shorten &lt;url&gt; [alias]</code>\nExample: <code>/shorten https://example.com my-brand</code>',
      { parse_mode: 'HTML' }
    );
  }

  if (candidate) {
    return executeShorten(ctx, candidate, { customAlias });
  }

  // No URL provided in command: prompt user
  setUserState(ctx.from.id, 'awaiting_shorten_url');
  return ctx.reply(
    '🔗 <b>Please send the long URL you want to shorten:</b>\n(e.g. <code>https://yourwebsite.com/long-page</code>)',
    {
      parse_mode: 'HTML',
      reply_markup: getCancelKeyboard(),
    }
  );
};

/**
 * Handle text messages that may contain direct URLs or conversational state
 */
export const handleDirectTextMessage = async (ctx, next) => {
  const text = ctx.message?.text?.trim() || '';

  // Ignore commands
  if (text.startsWith('/')) {
    return next();
  }

  // 1. If in awaiting_shorten_url state
  if (ctx.userState === 'awaiting_shorten_url') {
    return executeShorten(ctx, text);
  }

  // 2. Direct URL auto-detection
  const extracted = extractUrlFromText(text);
  if (extracted) {
    return executeShorten(ctx, extracted);
  }

  return next();
};
