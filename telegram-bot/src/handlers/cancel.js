/**
 * Cancel Handler (/cancel and action:cancel)
 */

import { clearUserState } from '../middleware/authSession.js';
import { getMainMenuKeyboard } from '../utils/keyboards.js';

export const handleCancel = async (ctx) => {
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery().catch(() => {});
  }

  clearUserState(ctx.from?.id);

  const text = '❌ <b>Action cancelled.</b> What would you like to do next?';
  const keyboard = getMainMenuKeyboard();

  if (ctx.callbackQuery) {
    return ctx.editMessageText(text, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    }).catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard }));
  }

  return ctx.reply(text, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
};
