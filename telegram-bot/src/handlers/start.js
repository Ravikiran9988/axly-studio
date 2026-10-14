/**
 * /start Command and Deep-Linking Handler
 */

import { formatWelcomeMessage, escapeHtml } from '../utils/formatters.js';
import { getMainMenuKeyboard } from '../utils/keyboards.js';
import { verifyAndLink } from '../services/accountLinking.js';
import { clearUserState } from '../middleware/authSession.js';

export const handleStart = async (ctx) => {
  clearUserState(ctx.from.id);

  // Check for deep-linking payload: /start <payload>
  const payload = ctx.payload || (ctx.message?.text?.split(/\s+/)[1] || '').trim();

  // Handle deep-link account connection: /start link_AX123456 or link_axly_tlink_...
  if (payload.startsWith('link_')) {
    const rawCode = payload.replace(/^link_/, '').trim();
    if (rawCode) {
      const statusMsg = await ctx.reply('🔄 <i>Verifying linking code with Axly Studio...</i>', { parse_mode: 'HTML' });
      try {
        const result = await verifyAndLink(ctx.from.id, rawCode, ctx.from);
        if (result.success) {
          await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
          return ctx.reply(
            `🎉 <b>Account Linked Successfully!</b>\n\nWelcome back, <b>${escapeHtml(result.user.name)}</b> (${escapeHtml(result.user.email)}).\nYour Telegram account is now connected to your Axly Studio account (<b>${escapeHtml(result.user.plan || 'Free').toUpperCase()}</b> plan).\n\nAll your links and analytics are now synchronized!`,
            {
              parse_mode: 'HTML',
              reply_markup: getMainMenuKeyboard(),
            }
          );
        }
      } catch (err) {
        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        return ctx.reply(
          `❌ <b>Account Linking Failed</b>\n\n${escapeHtml(err.message || 'The linking code is invalid or has expired.')}\n\nPlease generate a fresh code in your Axly dashboard (Settings > Telegram Bot).`,
          {
            parse_mode: 'HTML',
            reply_markup: getMainMenuKeyboard(),
          }
        );
      }
    }
  }

  // Standard welcome message
  const firstName = ctx.from?.first_name || '';
  return ctx.reply(formatWelcomeMessage(firstName), {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
};
