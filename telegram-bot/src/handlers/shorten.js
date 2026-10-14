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
  // Forwarded or multi-link messages must be handled as a set of URL occurrences,
  // not validated as one long URL. Shorten each unique destination once.
  if (options.forwardedMessage && !options.batchHandled) {
    const matches = extractUrlOccurrencesFromTelegramMessage(options.forwardedMessage);
    if (matches.length > 1) {
      const loading = await ctx.reply('⚡ <i>Shortening ' + matches.length + ' links...</i>', { parse_mode: 'HTML' });
      try {
        const token = ctx.auth?.isLinked ? ctx.auth.token : null;
        const uniqueUrls = [...new Set(matches.map((match) => match.normalizedUrl))];
        const shortByUrl = new Map();
        for (const url of uniqueUrls) {
          const response = await createShortUrl(url, token, null);
          const data = response.data;
          shortByUrl.set(url, data.shortUrl || data.short_url);
        }
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
        const replacements = matches.map((match) => ({
          ...match,
          shortUrl: shortByUrl.get(match.normalizedUrl),
        }));
        return replyWithShortenedForward(ctx, options.forwardedMessage, replacements);
      } catch (err) {
        await ctx.telegram.deleteMessage(ctx.chat.id, loading.message_id).catch(() => {});
        return ctx.reply('❌ <b>Could not shorten the links:</b>\n' + escapeHtml(err.message || 'Server error occurred.'), { parse_mode: 'HTML' });
      }
    }
  }
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
      const occurrences = extractUrlOccurrencesFromTelegramMessage(options.forwardedMessage)
        .filter((match) => match.normalizedUrl === targetUrl)
        .map((match) => ({ ...match, shortUrl }));
      await replyWithShortenedForward(ctx, options.forwardedMessage, occurrences.length
        ? occurrences
        : [{ originalUrl: rawUrl, normalizedUrl: targetUrl, shortUrl, start: null, end: null }]);
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
export const replaceUrlOccurrencesInText = (text, replacements) => {
  let outputText = text;
  const ranged = replacements
    .filter((item) => Number.isInteger(item.start) && Number.isInteger(item.end)
      && item.start >= 0 && item.end >= item.start && item.end <= text.length)
    .sort((a, b) => b.start - a.start);
  let lastStart = Infinity;
  for (const item of ranged) {
    if (item.start === lastStart) continue;
    outputText = outputText.slice(0, item.start) + item.shortUrl + outputText.slice(item.end);
    lastStart = item.start;
  }
  for (const item of replacements.filter((value) => !Number.isInteger(value.start) || !Number.isInteger(value.end))) {
    const candidates = [...new Set([item.originalUrl, item.normalizedUrl, getVisibleUrlVariant(item.normalizedUrl)].filter(Boolean))];
    for (const candidate of candidates) outputText = outputText.split(candidate).join(item.shortUrl);
  }
  const missing = [...new Set(replacements.map((item) => item.shortUrl))]
    .filter((shortUrl) => shortUrl && !outputText.includes(shortUrl));
  if (missing.length) outputText = outputText.trimEnd() + '\n\n' + missing.join('\n');
  return outputText;
};
const replyWithShortenedForward = async (ctx, message, replacements) => {
  const text = typeof message.text === 'string' ? message.text : message.caption;
  if (typeof text !== 'string') {
    const links = [...new Set(replacements.map((item) => item.shortUrl))];
    return ctx.reply(links.join('\n'), { reply_parameters: { message_id: message.message_id } });
  }

  const outputText = replaceUrlOccurrencesInText(text, replacements);

  if (typeof message.text === 'string') {
    return ctx.reply(outputText, {
      reply_parameters: { message_id: message.message_id },
      link_preview_options: { is_disabled: true },
    });
  }

  const copied = await ctx.telegram.copyMessage(ctx.chat.id, ctx.chat.id, message.message_id, {
    reply_parameters: { message_id: message.message_id },
  });
  // No QR/analytics/open-link keyboard is attached to a forwarded copy.
  return ctx.telegram.editMessageCaption(ctx.chat.id, copied.message_id, undefined, outputText, {
    reply_markup: { inline_keyboard: [] },
  });
};

const getVisibleUrlVariant = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.host + parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
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
 * Dedicated custom-alias command so users can discover it from Telegram's command menu.
 * Usage: /alias <url> <alias>
 */
export const handleAliasCommand = async (ctx) => {
  const parts = (ctx.message?.text || '').trim().split(/\s+/);
  const candidate = parts[1] || '';
  const customAlias = parts[2] || '';

  if (!candidate || !customAlias || parts.length > 3) {
    return ctx.reply(
      '✨ <b>Create a Custom Alias</b>\n\nUsage: <code>/alias &lt;url&gt; &lt;alias&gt;</code>\nExample: <code>/alias https://example.com my-brand</code>\n\nCustom aliases require a linked Axly account. Use <code>/account</code> to connect first.',
      { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() }
    );
  }

  return executeShorten(ctx, candidate, { customAlias });
};

/**
 * Extract URL occurrences, preserving Telegram entity ranges and hidden link destinations.
 * Entity offsets are UTF-16 positions, as required by Telegram and JavaScript String.slice().
 */
export const extractUrlOccurrencesFromTelegramMessage = (message) => {
  if (!message) return [];
  const text = typeof message.text === 'string' ? message.text : typeof message.caption === 'string' ? message.caption : '';
  const matches = [];
  const seenRanges = new Set();

  const add = (candidate, start = null, end = null, hidden = false, trimTrailingPunctuation = true) => {
    if (typeof candidate !== 'string' || !candidate.trim()) return;
    const value = candidate.trim();
    const clean = trimTrailingPunctuation ? value.replace(/[.,!?;:)\\]}]+$/, '') : value;
    const checked = validateUrl(clean);
    if (!checked.valid) return;
    let rangeStart = Number.isInteger(start) ? start : null;
    let rangeEnd = Number.isInteger(end) ? end : null;
    if (rangeStart !== null && rangeEnd !== null && trimTrailingPunctuation) {
      rangeEnd -= value.length - clean.length;
    }
    const key = rangeStart !== null && rangeEnd !== null ? String(rangeStart) + ':' + String(rangeEnd) : null;
    if (key && seenRanges.has(key)) return;
    if (key) seenRanges.add(key);
    matches.push({ originalUrl: clean, normalizedUrl: checked.url, start: rangeStart, end: rangeEnd, hidden });
  };

  for (const entity of message.entities || message.caption_entities || []) {
    if (!Number.isInteger(entity.offset) || !Number.isInteger(entity.length)) continue;
    const start = entity.offset;
    const end = start + entity.length;
    if (entity.type === 'text_link' && typeof entity.url === 'string') {
      add(entity.url, start, end, true, false);
    } else if (entity.type === 'url') {
      add(text.slice(start, end), start, end, false, true);
    }
  }

  const pattern = /(?:https?:\/\/|www\.)[^\s<>]+|\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(?:\/[^\s<>]*)?/gi;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0].replace(/[.,!?;:)\\]}]+$/, '');
    if (raw) add(raw, match.index, match.index + raw.length, false, false);
  }
  return matches.sort((a, b) => {
    if (a.start === null) return 1;
    if (b.start === null) return -1;
    return a.start - b.start;
  });
};

/** Return unique normalized URLs for routing and request deduplication. */
export const extractAllUrlsFromTelegramMessage = (message) => (
  [...new Set(extractUrlOccurrencesFromTelegramMessage(message).map((match) => match.normalizedUrl))]
);

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

  // Forwarded messages and messages with multiple URLs take priority over prompt state.
  const isForwarded = Boolean(ctx.message.forward_origin || ctx.message.forward_from || ctx.message.forward_from_chat || ctx.message.is_automatic_forward);
  const allUrls = extractAllUrlsFromTelegramMessage(ctx.message);
  if (isForwarded && allUrls.length > 0) {
    return executeShorten(ctx, allUrls[0], { forwardedMessage: ctx.message });
  }
  if (allUrls.length > 1) {
    return executeShorten(ctx, allUrls[0], { forwardedMessage: ctx.message });
  }

  // Only treat a plain response as a URL while waiting for a URL input.
  if (ctx.userState === 'awaiting_shorten_url') {
    const extracted = extractUrlFromTelegramMessage(ctx.message);
    if (extracted) return executeShorten(ctx, extracted);
    return ctx.reply('⚠️ Please send a valid URL, or use /cancel to exit.');
  }

  const extracted = extractUrlFromTelegramMessage(ctx.message);
  if (extracted) return executeShorten(ctx, extracted);

  return next();
};
