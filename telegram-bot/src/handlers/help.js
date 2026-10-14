/**
 * /help Command Handler
 */

import { formatHelpMessage } from '../utils/formatters.js';
import { getMainMenuKeyboard } from '../utils/keyboards.js';

export const handleHelp = async (ctx) => {
  return ctx.reply(formatHelpMessage(), {
    parse_mode: 'HTML',
    reply_markup: getMainMenuKeyboard(),
  });
};
