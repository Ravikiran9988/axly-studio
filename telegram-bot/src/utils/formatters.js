/**
 * Message Formatters for Axly Studio Telegram Bot
 * Axly Brand Styling: Clean, modern, purple-accented, copy-friendly
 */

/**
 * Escape HTML characters for Telegram HTML mode
 * @param {string} text 
 * @returns {string}
 */
export const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

/**
 * Welcome message formatting
 */
export const formatWelcomeMessage = (userName = '') => {
  const greeting = userName ? `Hello, <b>${escapeHtml(userName)}</b>! ` : '';
  return `${greeting}Welcome to <b>Axly Studio</b>

Shorten links, generate QR codes, and manage your links — all from Telegram.

Choose a feature below to get started.`;
};

/**
 * Formats a newly created short URL response
 */
export const formatLinkCreatedMessage = (data, isGuest = true, user = null) => {
  const shortUrl = data.shortUrl || data.short_url;
  const originalUrl = data.originalUrl || data.original_url;
  const title = data.title ? `\n📌 <b>Title:</b> ${escapeHtml(data.title)}` : '';

  let accountBadge = '';
  if (!isGuest && user) {
    accountBadge = `\n👤 <i>Saved to ${escapeHtml(user.name || user.email)}'s account (${escapeHtml(user.plan || 'Free')})</i>`;
  }

  let guestNotice = '';
  if (isGuest) {
    guestNotice = `\n\n💡 <i>Guest Link. Link your account with <code>/account</code> to view real-time click tracking and analytics.</i>`;
  }

  return `✨ <b>Link Shortened Successfully!</b>

🔗 <b>Short Link:</b> (tap to copy)
<code>${escapeHtml(shortUrl)}</code>
${title}
🎯 <b>Destination:</b>
${escapeHtml(originalUrl)}${accountBadge}${guestNotice}`;
};

/**
 * Formats user's links for /mylinks
 */
export const formatMyLinksList = (links, pagination, user) => {
  if (!links || links.length === 0) {
    return `📂 <b>My Links — Axly Studio</b>

You don't have any links yet.
Send me any URL or use <code>/shorten &lt;url&gt;</code> to create your first trackable link!`;
  }

  const { page, pages, total } = pagination;
  let text = `📂 <b>My Links — Page ${page} of ${pages}</b> (Total: ${total})\n`;
  text += `👤 <i>Account: ${escapeHtml(user?.name || user?.email || 'Axly User')}</i>\n\n`;

  links.forEach((link, idx) => {
    const num = (page - 1) * pagination.limit + (idx + 1);
    const title = link.title ? escapeHtml(link.title) : 'Untitled Link';
    const shortUrl = link.short_url || `https://s.axly.in/${link.short_code}`;
    const clicks = link.click_count || 0;
    const dest = link.original_url.length > 45 ? `${link.original_url.substring(0, 42)}...` : link.original_url;

    text += `<b>${num}. ${title}</b>\n`;
    text += `🔗 <code>${escapeHtml(shortUrl)}</code>\n`;
    text += `🎯 ${escapeHtml(dest)}\n`;
    text += `📊 <b>${clicks}</b> clicks | <code>/stats ${escapeHtml(link.short_code)}</code>\n\n`;
  });

  return text.trim();
};

/**
 * Formats dashboard overall stats
 */
export const formatDashboardStats = (stats, user) => {
  const totalUrls = stats.totalUrls || 0;
  const totalClicks = stats.totalClicks || 0;
  const activeUrls = stats.activeUrls || 0;
  const newThisMonth = stats.newThisMonth || 0;

  return `📊 <b>Axly Studio Analytics Overview</b>

👤 <b>Account:</b> ${escapeHtml(user?.name || user?.email || 'User')}
⭐ <b>Plan:</b> ${escapeHtml(user?.plan || 'Free').toUpperCase()}

📈 <b>Key Metrics:</b>
• Total Links: <b>${totalUrls}</b>
• Total Clicks: <b>${totalClicks}</b>
• Active Links: <b>${activeUrls}</b>
• Created this Month: <b>${newThisMonth}</b>

💡 <i>Tip: Send <code>/stats &lt;short_code&gt;</code> to inspect detailed metrics for a specific link.</i>`;
};

/**
 * Formats link-specific detailed analytics
 */
export const formatLinkAnalytics = (urlData, analytics) => {
  const shortUrl = urlData.short_url || `https://s.axly.in/${urlData.short_code}`;
  const totalClicks = analytics.totalClicks || urlData.click_count || 0;
  const uniqueClicks = analytics.uniqueClicks || urlData.unique_clicks || 0;

  let text = `📊 <b>Analytics for ${escapeHtml(urlData.short_code)}</b>

🔗 <code>${escapeHtml(shortUrl)}</code>
🎯 <b>Destination:</b> ${escapeHtml(urlData.original_url)}
📅 <b>Created:</b> ${new Date(urlData.created_at).toLocaleDateString()}

📈 <b>Performance:</b>
• Total Clicks: <b>${totalClicks}</b>
• Unique Visitors: <b>${uniqueClicks}</b>\n`;

  // Top Countries
  if (analytics.byCountry && analytics.byCountry.length > 0) {
    text += `\n🌍 <b>Top Countries:</b>\n`;
    analytics.byCountry.slice(0, 5).forEach(c => {
      text += `• ${escapeHtml(c.country)}: ${c.clicks} clicks\n`;
    });
  }

  // Top Devices
  if (analytics.byDevice && analytics.byDevice.length > 0) {
    text += `\n📱 <b>Devices:</b>\n`;
    analytics.byDevice.slice(0, 4).forEach(d => {
      text += `• ${escapeHtml(d.device)}: ${d.clicks}\n`;
    });
  }

  // Top Referrers
  if (analytics.byReferer && analytics.byReferer.length > 0) {
    text += `\n🌐 <b>Top Referrers:</b>\n`;
    analytics.byReferer.slice(0, 4).forEach(r => {
      text += `• ${escapeHtml(r.referer)}: ${r.clicks}\n`;
    });
  }

  return text.trim();
};

/**
 * Formats Account info message
 */
export const formatAccountMessage = (user, isLinked = false) => {
  if (isLinked && user) {
    return `👤 <b>Axly Studio Account Status</b>

✅ <b>Status:</b> Connected
👤 <b>Name:</b> ${escapeHtml(user.name)}
📧 <b>Email:</b> ${escapeHtml(user.email)}
⭐ <b>Plan:</b> ${escapeHtml(user.plan || 'Free').toUpperCase()}

Your Telegram account is verified. All links you create will be automatically synced with your web dashboard and analytics.`;
  }

  return `👤 <b>Axly Studio Account Status</b>

⚠️ <b>Status:</b> Not Connected (Guest Mode)

You can shorten links and generate QR codes freely, but connecting your Axly account gives you:
• Detailed clickstream analytics & country breakdown
• Full link management from Telegram
• Permanent link history across devices
• Custom vanity aliases and QR downloads

<b>How to connect:</b>
1. Log in to your Axly dashboard at <a href="https://studio.axly.in">studio.axly.in</a>
2. Go to <b>Settings > Telegram Bot</b> and click <b>Connect Telegram Bot</b>
3. Tap the <b>Connect in Telegram</b> button or send:
   <code>/link AX-XXXXXX</code> here!`;
};

/**
 * Formats Help command message
 */
export const formatHelpMessage = () => {
  return `<b>Axly Studio Bot — Help & Commands</b>

<b>Available Commands:</b>
• <code>/start</code> — Open the welcome screen and main menu
• <code>/shorten &lt;url&gt;</code> — Shorten one web link
• <code>/alias &lt;url&gt; &lt;alias&gt;</code> — Create a custom alias (linked Axly account required)
• <code>/qr &lt;url&gt;</code> — Generate a high-resolution QR code
• <code>/mylinks</code> — View and paginate your saved links (linked account)
• <code>/stats</code> — View overall click analytics (linked account)
• <code>/stats &lt;code&gt;</code> — View analytics for one short link
• <code>/account</code> — Check account status or get linking instructions
• <code>/link &lt;code&gt;</code> — Link your Axly account with a 10-minute code
• <code>/settings</code> — Open bot preferences (Auto QR toggle)
• <code>/cancel</code> — Cancel the current prompt/action
• <code>/help</code> — Show this command guide

<b>Other features:</b>
• Send a URL directly to shorten it.
• Forward a message with multiple URLs to shorten each URL while preserving its text.
• Use the main-menu buttons for Shorten Link, Custom Alias, Generate QR, My Links, Analytics, Account, Settings, Website, and Help.

💡 <b>Custom alias example:</b> <code>/alias https://example.com my-brand</code>`;
};
