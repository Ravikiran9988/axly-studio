/**
 * My Links Listing and Pagination Handler (/mylinks and action:mylinks:<page>)
 */

import { getUserUrls } from '../services/axlyApi.js';
import { formatMyLinksList, escapeHtml } from '../utils/formatters.js';
import { getPaginationKeyboard, getAccountKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';

export const handleMyLinks = async (ctx, pageNumber = 1) => {
  const isCallback = Boolean(ctx.callbackQuery);
  if (isCallback) {
    await ctx.answerCbQuery().catch(() => {});
  }

  // 1. Guard: Authentication check
  if (!ctx.auth?.isLinked || !ctx.auth?.token) {
    const text = `🔒 <b>Account Required for My Links</b>\n\nTo view, search, and manage your trackable links from Telegram, please connect your Axly Studio account.\n\nUse <code>/account</code> or tap the button below:`;
    if (isCallback) {
      return ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: getAccountKeyboard(false),
      }).catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: getAccountKeyboard(false) }));
    }
    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: getAccountKeyboard(false),
    });
  }

  // 2. Fetch links from Axly API
  try {
    const page = Math.max(1, parseInt(pageNumber, 10) || 1);
    const limit = 5;
    const response = await getUserUrls(ctx.auth.token, { page, limit });

    const links = response.data || [];
    const pagination = response.pagination || { page: 1, pages: 1, total: links.length, limit };

    const messageText = formatMyLinksList(links, pagination, ctx.auth.user);
    const keyboard = links.length > 0 && pagination.pages > 1
      ? getPaginationKeyboard(pagination.page, pagination.pages)
      : getMainMenuKeyboard();

    if (isCallback) {
      return ctx.editMessageText(messageText, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      }).catch(() => ctx.reply(messageText, { parse_mode: 'HTML', reply_markup: keyboard }));
    }

    return ctx.reply(messageText, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (err) {
    const errorText = `❌ <b>Failed to fetch your links:</b>\n${escapeHtml(err.message || 'Server error occurred.')}`;
    if (isCallback) {
      return ctx.editMessageText(errorText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() })
        .catch(() => ctx.reply(errorText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() }));
    }
    return ctx.reply(errorText, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(),
    });
  }
};

/**
 * Callback router for pagination: action:mylinks:<page>
 */
export const handleMyLinksCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const pageStr = data.replace(/^action:mylinks:/, '').trim();
  const page = parseInt(pageStr, 10) || 1;
  return handleMyLinks(ctx, page);
};
