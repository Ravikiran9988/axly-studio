/**
 * QR Code Generation Handler (/qr and callback actions)
 */

import QRCode from 'qrcode';
import { validateUrl } from '../utils/validation.js';
import { getCancelKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';
import { setUserState, clearUserState } from '../middleware/authSession.js';
import { escapeHtml } from '../utils/formatters.js';

const FRONTEND_URL = process.env.AXLY_FRONTEND_URL || 'https://url.axly.in';

/**
 * Generate and send QR code image
 */
export const executeGenerateQr = async (ctx, targetUrl) => {
  const validation = validateUrl(targetUrl);
  if (!validation.valid) {
    return ctx.reply(`⚠️ ${validation.error}`, {
      reply_markup: getCancelKeyboard(),
    });
  }

  clearUserState(ctx.from.id);

  const loadingMsg = await ctx.reply('📱 <i>Generating high-resolution QR code...</i>', {
    parse_mode: 'HTML',
  });

  try {
    const url = validation.url;
    const qrBuffer = await QRCode.toBuffer(url, {
      width: 450,
      margin: 2,
      color: {
        dark: '#4c1d95', // Axly purple
        light: '#ffffff',
      },
    });

    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption: `📱 <b>QR Code Generated!</b>\n\n🎯 <b>Encoded URL:</b>\n<code>${escapeHtml(url)}</code>\n\nScan this code with any camera or phone to visit the link.`,
        parse_mode: 'HTML',
      }
    );
  } catch (err) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    return ctx.reply(`❌ <b>Failed to generate QR code:</b> ${escapeHtml(err.message)}`, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(),
    });
  }
};

/**
 * Handle /qr command
 */
export const handleQrCommand = async (ctx) => {
  const text = ctx.message?.text || '';
  const parts = text.split(/\s+/);
  const candidate = parts.slice(1).join(' ').trim();

  if (candidate) {
    return executeGenerateQr(ctx, candidate);
  }

  // Prompt user for URL
  setUserState(ctx.from.id, 'awaiting_qr_url');
  return ctx.reply(
    '📱 <b>Please send the URL you want to convert into a QR code:</b>\n(e.g. <code>https://example.com</code>)',
    {
      parse_mode: 'HTML',
      reply_markup: getCancelKeyboard(),
    }
  );
};

/**
 * Handle QR action callback (e.g. action:qr:abc123)
 */
export const handleQrCallback = async (ctx) => {
  await ctx.answerCbQuery('Generating QR code...').catch(() => {});
  const data = ctx.callbackQuery?.data || '';
  const shortCode = data.replace(/^action:qr:/, '').trim();

  if (!shortCode) {
    return ctx.reply('⚠️ Invalid short link code.');
  }

  // Resolve short URL
  const shortUrl = `${FRONTEND_URL}/${shortCode}`;
  return executeGenerateQr(ctx, shortUrl);
};
