/**
 * Account Connection and Verification Handler (/account, /link, and unlink flows)
 */

import { formatAccountMessage, escapeHtml } from '../utils/formatters.js';
import { getAccountKeyboard, getUnlinkConfirmKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';
import { verifyAndLink, unlink } from '../services/accountLinking.js';
import { isValidLinkCode } from '../utils/validation.js';

/**
 * Handle /account command and action:account callback
 */
export const handleAccount = async (ctx) => {
  const isCallback = Boolean(ctx.callbackQuery);
  if (isCallback) {
    await ctx.answerCbQuery().catch(() => {});
  }

  const isLinked = ctx.auth?.isLinked || false;
  const user = ctx.auth?.user || null;
  const message = formatAccountMessage(user, isLinked);
  const keyboard = getAccountKeyboard(isLinked);

  if (isCallback) {
    return ctx.editMessageText(message, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: keyboard,
    }).catch(() => ctx.reply(message, { parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: keyboard }));
  }

  return ctx.reply(message, {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    reply_markup: keyboard,
  });
};

/**
 * Handle /link <code> command
 */
export const handleLinkCommand = async (ctx) => {
  const text = ctx.message?.text || '';
  const parts = text.split(/\s+/);
  const code = (parts[1] || '').trim();

  if (!code) {
    return ctx.reply(
      '⚠️ <b>Missing Linking Code</b>\n\nUsage: <code>/link AX-XXXXXX</code>\n\nGenerate your 10-minute code on the Axly website under <b>Settings > Telegram Bot</b>.',
      {
        parse_mode: 'HTML',
        reply_markup: getAccountKeyboard(false),
      }
    );
  }

  if (!isValidLinkCode(code)) {
    return ctx.reply(
      '⚠️ <b>Invalid Code Format</b>\n\nLinking codes are formatted like <code>AX-XXXXXX</code> (or generated deep links).\nPlease check your code in the Axly dashboard.',
      { parse_mode: 'HTML' }
    );
  }

  const loadingMsg = await ctx.reply('🔄 <i>Verifying linking code with Axly Studio...</i>', { parse_mode: 'HTML' });

  try {
    const result = await verifyAndLink(ctx.from.id, code, ctx.from);
    if (!result?.success || !result.user) {
      throw new Error(result?.message || 'The linking code is invalid or has expired. Please generate a new code.');
    }
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});

    return ctx.reply(
      `🎉 <b>Account Linked Successfully!</b>\n\nWelcome back, <b>${escapeHtml(result.user.name)}</b> (${escapeHtml(result.user.email)}).\nYour Telegram account is now connected to your Axly Studio account (<b>${escapeHtml(result.user.plan || 'Free').toUpperCase()}</b> plan).\n\nAll your links and analytics are now synchronized!`,
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  } catch (err) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id).catch(() => {});
    return ctx.reply(
      `❌ <b>Linking Failed:</b>\n${escapeHtml(err.message || 'Invalid or expired linking code.')}`,
      {
        parse_mode: 'HTML',
        reply_markup: getAccountKeyboard(false),
      }
    );
  }
};

/**
 * Confirm unlinking
 */
export const handleUnlinkConfirm = async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  return ctx.editMessageText(
    '⚠️ <b>Are you sure you want to unlink your Telegram account?</b>\n\nYou will switch back to guest mode and will need to generate a new linking code to reconnect.',
    {
      parse_mode: 'HTML',
      reply_markup: getUnlinkConfirmKeyboard(),
    }
  );
};

/**
 * Execute unlinking
 */
export const handleUnlinkExecute = async (ctx) => {
  await ctx.answerCbQuery('Unlinking account...').catch(() => {});
  try {
    await unlink(ctx.from.id);
    return ctx.editMessageText(
      '✅ <b>Account Unlinked Successfully</b>\n\nYour Telegram account has been disconnected from your Axly Studio account. You can reconnect anytime using <code>/account</code>.',
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  } catch (err) {
    return ctx.editMessageText(
      `❌ <b>Failed to unlink account:</b> ${escapeHtml(err.message)}`,
      {
        parse_mode: 'HTML',
        reply_markup: getMainMenuKeyboard(),
      }
    );
  }
};
