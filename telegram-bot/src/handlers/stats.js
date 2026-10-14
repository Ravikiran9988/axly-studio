/**
 * Analytics and Click Statistics Handler (/stats and callback actions)
 */

import { getDashboardStats, getUserUrls, getUrlAnalytics } from '../services/axlyApi.js';
import { formatDashboardStats, formatLinkAnalytics, escapeHtml } from '../utils/formatters.js';
import { getAccountKeyboard, getMainMenuKeyboard } from '../utils/keyboards.js';

/**
 * Handle overall or link-specific statistics
 */
export const handleStats = async (ctx, shortCode = null) => {
  const isCallback = Boolean(ctx.callbackQuery);
  if (isCallback) {
    await ctx.answerCbQuery().catch(() => {});
  }

  // 1. Guard: Authentication check
  if (!ctx.auth?.isLinked || !ctx.auth?.token) {
    const text = `🔒 <b>Account Required for Analytics</b>\n\nTo view real-time click metrics, country breakdowns, and referrer data, please connect your Axly Studio account.\n\nUse <code>/account</code> or tap the button below:`;
    if (isCallback) {
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: getAccountKeyboard(false) })
        .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: getAccountKeyboard(false) }));
    }
    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: getAccountKeyboard(false),
    });
  }

  // 2. If shortCode is provided: fetch detailed analytics for that link
  if (shortCode) {
    try {
      // Find the link by short_code using user's URL list
      const cleanCode = shortCode.trim().toLowerCase();
      const searchRes = await getUserUrls(ctx.auth.token, { search: cleanCode, limit: 10 });
      const found = (searchRes.data || []).find(u => u.short_code.toLowerCase() === cleanCode);

      if (!found) {
        const notFoundText = `⚠️ <b>Link Not Found</b>\n\nNo link with code <code>${escapeHtml(cleanCode)}</code> was found in your Axly account.\nCheck <code>/mylinks</code> to see your available links.`;
        return ctx.reply(notFoundText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });
      }

      const analyticsRes = await getUrlAnalytics(found.id, ctx.auth.token);
      const text = formatLinkAnalytics(found, analyticsRes.data?.analytics || {});

      if (isCallback) {
        return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() })
          .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() }));
      }
      return ctx.reply(text, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });
    } catch (err) {
      const errText = `❌ <b>Failed to fetch analytics for ${escapeHtml(shortCode)}:</b>\n${escapeHtml(err.message)}`;
      return ctx.reply(errText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });
    }
  }

  // 3. Otherwise: fetch overall dashboard stats
  try {
    const statsRes = await getDashboardStats(ctx.auth.token);
    const text = formatDashboardStats(statsRes.data || {}, ctx.auth.user);

    if (isCallback) {
      return ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() })
        .catch(() => ctx.reply(text, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() }));
    }
    return ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: getMainMenuKeyboard(),
    });
  } catch (err) {
    const errText = `❌ <b>Failed to fetch dashboard analytics:</b>\n${escapeHtml(err.message)}`;
    return ctx.reply(errText, { parse_mode: 'HTML', reply_markup: getMainMenuKeyboard() });
  }
};

/**
 * Handle /stats command
 */
export const handleStatsCommand = async (ctx) => {
  const text = ctx.message?.text || '';
  const parts = text.split(/\s+/);
  const candidateCode = parts[1] ? parts[1].trim() : null;
  return handleStats(ctx, candidateCode);
};

/**
 * Handle action:stats and action:stats:<codeOrId>
 */
export const handleStatsCallback = async (ctx) => {
  const data = ctx.callbackQuery?.data || '';
  const code = data.replace(/^action:stats:?/, '').trim();
  return handleStats(ctx, code || null);
};
