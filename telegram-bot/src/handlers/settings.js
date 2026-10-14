/**
 * User Settings and Preferences Handler (/settings and callback actions)
 */

import { getSettingsKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';
import { toggleUserPreference } from '../middleware/authSession.js';

export const handleSettings = async (ctx) => {
  const isCallback = Boolean(ctx.callbackQuery);
  if (isCallback) {
    await ctx.answerCbQuery().catch(() => {});
  }

  const prefs = ctx.preferences || { autoQr: false };
  const text = `⚙️ <b>Axly Studio Bot Settings</b>

Customize your Telegram bot experience:

• <b>Auto QR on Shorten:</b> Automatically generate and attach a QR code photo whenever you shorten a link.

Tap a toggle below to update your preference:`;

  const keyboard = getSettingsKeyboard(prefs);

  if (isCallback) {
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

export const handleToggleAutoQr = async (ctx) => {
  const updatedPrefs = toggleUserPreference(ctx.from.id, 'autoQr');
  ctx.preferences = updatedPrefs;
  await ctx.answerCbQuery(`Auto QR ${updatedPrefs.autoQr ? 'Enabled' : 'Disabled'}`).catch(() => {});

  const text = `⚙️ <b>Axly Studio Bot Settings</b>

Customize your Telegram bot experience:

• <b>Auto QR on Shorten:</b> Automatically generate and attach a QR code photo whenever you shorten a link.

Tap a toggle below to update your preference:`;

  return ctx.editMessageText(text, {
    parse_mode: 'HTML',
    reply_markup: getSettingsKeyboard(updatedPrefs),
  }).catch(() => {});
};
