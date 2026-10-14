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

    if (options.forwardedMessage) {
      await replyWithShortenedForward(ctx, options.forwardedMessage, rawUrl, targetUrl, shortUrl, linkData);
    } else {
      const message = formatLinkCreatedMessage(linkData, isGuest, ctx.auth?.user);
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: getLinkActionsKeyboard(linkData.shortCode || linkData.short_code, shortUrl),
      });
    }

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
 * Reply with a copy of a forwarded message, replacing its URL but preserving its text/media.
 * Telegram does not permit a bot to edit the incoming message itself.
 */
const replyWithShortenedForward = async (ctx, message, rawUrl, normalizedUrl, shortUrl, linkData) => {
  const text = typeof message.text === 'string' ? message.text : message.caption;
  const code = linkData.shortCode || linkData.short_code || shortUrl.split('/').pop();

  if (typeof text !== 'string') {
    return ctx.reply(shortUrl, {
      reply_parameters: { message_id: message.message_id },
      reply_markup: getLinkActionsKeyboard(code, shortUrl),
    });
  }

  const entities = message.entities || message.caption_entities || [];
  let outputText = text;
  let replaced = false;

  // Prefer Telegram's entity ranges. Offsets are UTF-16 code units, matching String.slice().
  for (const entity of entities) {
    const start = entity.offset;
    const end = Number.isInteger(start) && Number.isInteger(entity.length) ? start + entity.length : -1;
    if (end < 0) continue;

    if (entity.type === 'text_link' && typeof entity.url === 'string') {
      const checked = validateUrl(entity.url);
      if (checked.valid && (checked.url === normalizedUrl || entity.url === rawUrl)) {
        outputText = text.slice(0, start) + shortUrl + text.slice(end);
        replaced = true;
        break;
      }
    } else if (entity.type === 'url') {
      const visibleUrl = text.slice(start, end);
      const checked = validateUrl(visibleUrl);
      if (checked.valid && (checked.url === normalizedUrl || visibleUrl === rawUrl)) {
        outputText = text.slice(0, start) + shortUrl + text.slice(end);
        replaced = true;
        break;
      }
    }
  }

  if (!replaced) {
    const candidates = [rawUrl, normalizedUrl].filter(Boolean);
    for (const candidate of candidates) {
      const index = text.indexOf(candidate);
      if (index >= 0) {
        outputText = text.slice(0, index) + shortUrl + text.slice(index + candidate.length);
        replaced = true;
        break;
      }
    }
  }

  if (!replaced) {
    // Support visible URLs without an explicit scheme and preserve trailing punctuation.
    const match = text.match(/(?:https?:\/\/|www\.)[^\s<>]+|\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s<>]*)?/i);
    if (match && match.index !== undefined) {
      const candidate = match[0];
      const trimmed = candidate.replace(/[.,!?;:]+$/, '');
      const punctuation = candidate.slice(trimmed.length);
      const checked = validateUrl(trimmed);
      if (checked.valid && checked.url === normalizedUrl) {
        outputText = text.slice(0, match.index) + shortUrl + punctuation + text.slice(match.index + candidate.length);
        replaced = true;
      }
    }
  }

  if (!replaced) outputText = `${text.trimEnd()}\n\n${shortUrl}`;

  if (typeof message.text === 'string') {
    return ctx.reply(outputText, {
      reply_parameters: { message_id: message.message_id },
      reply_markup: getLinkActionsKeyboard(code, shortUrl),
      link_preview_options: { is_disabled: true },
    });
  }

  // Preserve the media by copying it, then replace the caption on the bot's copy.
  const copied = await ctx.telegram.copyMessage(
    ctx.chat.id,
    ctx.chat.id,
    message.message_id,
    { reply_parameters: { message_id: message.message_id } }
  );
  return ctx.telegram.editMessageCaption(
    ctx.chat.id,
    copied.message_id,
    undefined,
    outputText,
    { reply_markup: getLinkActionsKeyboard(code, shortUrl) }
  );
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
 * Extract a validated URL from Telegram text, captions, or hidden text links.
 */
export const extractUrlFromTelegramMessage = (message) => {
  if (!message) return null;
  const text = typeof message.text === 'string'
    ? message.text
    : typeof message.caption === 'string' ? message.caption : '';
  const entities = message.entities || message.caption_entities || [];

  for (const entity of entities) {
    let candidate = null;
    if (entity.type === 'text_link' && typeof entity.url === 'string') {
      candidate = entity.url;
    } else if (entity.type === 'url' && Number.isInteger(entity.offset) && Number.isInteger(entity.length)) {
      candidate = text.slice(entity.offset, entity.offset + entity.length);
    }
    if (candidate) {
      const checked = validateUrl(candidate);
      if (checked.valid) return checked.url;
    }
  }
  return extractUrlFromText(text);
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
  const extracted = extractUrlFromTelegramMessage(ctx.message);
  if (extracted) {
    const isForwarded = Boolean(ctx.message.forward_origin || ctx.message.forward_from || ctx.message.forward_from_chat || ctx.message.is_automatic_forward);
    return executeShorten(ctx, extracted, isForwarded ? { forwardedMessage: ctx.message } : {});
  }

  return next();
};
