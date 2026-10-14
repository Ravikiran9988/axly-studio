import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';

import { validateUrl, extractUrlFromText, isValidLinkCode, isValidCustomAlias } from '../src/utils/validation.js';
import {
  formatWelcomeMessage,
  formatHelpMessage,
  formatLinkCreatedMessage,
  formatMyLinksList,
  formatDashboardStats,
  formatLinkAnalytics,
  formatAccountMessage,
  escapeHtml,
} from '../src/utils/formatters.js';
import {
  getMainMenuKeyboard,
  getLinkActionsKeyboard,
  getPaginationKeyboard,
  getAccountKeyboard,
  getSettingsKeyboard,
} from '../src/utils/keyboards.js';
import { rateLimitMiddleware, clearRateLimits } from '../src/middleware/rateLimit.js';
import {
  authSessionMiddleware,
  setUserState,
  clearUserState,
  clearAllStates,
  toggleUserPreference,
} from '../src/middleware/authSession.js';
import { handleStart } from '../src/handlers/start.js';
import { handleHelp } from '../src/handlers/help.js';
import { handleShortenCommand, handleDirectTextMessage, extractUrlFromTelegramMessage } from '../src/handlers/shorten.js';
import { handleMyLinks } from '../src/handlers/myLinks.js';
import { handleStats } from '../src/handlers/stats.js';
import { handleAccount, handleLinkCommand } from '../src/handlers/account.js';
import { handleCancel } from '../src/handlers/cancel.js';

// Helper to create mock Telegraf context
const createMockContext = (overrides = {}) => {
  const replies = [];
  const photos = [];
  const deletedMessages = [];
  const cbQueries = [];

  const ctx = {
    chat: { id: 12345 },
    from: { id: 999999, first_name: 'TestUser', username: 'testuser' },
    message: { text: '' },
    replies,
    photos,
    deletedMessages,
    reply: async (text, extra = {}) => {
      replies.push({ text, extra });
      return { message_id: replies.length };
    },
    replyWithPhoto: async (photo, extra = {}) => {
      photos.push({ photo, extra });
      return { message_id: photos.length };
    },
    telegram: {
      deleteMessage: async (chatId, messageId) => {
        deletedMessages.push({ chatId, messageId });
      },
    },
    answerCbQuery: async (text) => {
      cbQueries.push(text);
    },
    auth: { isLinked: false, user: null, token: null },
    preferences: { autoQr: false },
    ...overrides,
  };

  return ctx;
};

describe('1. Input Validation & Protocol Hardening', () => {
  test('validates standard HTTPS and HTTP URLs', () => {
    assert.equal(validateUrl('https://example.com/page?query=1').valid, true);
    assert.equal(validateUrl('http://my-blog.org').valid, true);
    assert.equal(validateUrl('url.axly.in').valid, true, 'Should prepend https to naked domains');
  });

  test('strictly rejects dangerous non-HTTP protocols', () => {
    const invalidProtocols = [
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'ftp://ftp.example.com',
    ];

    for (const proto of invalidProtocols) {
      const res = validateUrl(proto);
      assert.equal(res.valid, false, `Expected ${proto} to be rejected`);
      assert.ok(res.error.includes('Only HTTP and HTTPS') || res.error.includes('Invalid URL'));
    }
  });

  test('strictly blocks local loopback and cloud metadata (SSRF guard)', () => {
    const dangerousHosts = [
      'http://localhost:5000',
      'http://127.0.0.1:8080',
      'http://169.254.169.254/latest/meta-data',
      'http://metadata.google.internal',
      'http://internal.local',
    ];

    for (const target of dangerousHosts) {
      const res = validateUrl(target);
      assert.equal(res.valid, false, `Expected ${target} to be blocked`);
      assert.ok(res.error.includes('internal network') || res.error.includes('Localhost'));
    }
  });

  test('extracts URLs from conversational messages', () => {
    assert.equal(
      extractUrlFromText('Hey please shorten https://github.com/Ravikiran9988 for me!'),
      'https://github.com/Ravikiran9988'
    );
    assert.equal(
      extractUrlFromText('check out www.google.com/search?q=axly.'),
      'https://www.google.com/search?q=axly'
    );
    assert.equal(extractUrlFromText('just saying hello there'), null);
  });

  test('extracts URLs from forwarded Telegram text, captions and hidden links', () => {
    assert.equal(extractUrlFromTelegramMessage({ text: 'Forwarded: https://example.com/path' }), 'https://example.com/path');
    assert.equal(extractUrlFromTelegramMessage({ caption: 'Check this site: https://example.org/page' }), 'https://example.org/page');
    assert.equal(extractUrlFromTelegramMessage({
      text: 'Open site',
      entities: [{ type: 'text_link', offset: 0, length: 4, url: 'https://example.com/hidden' }],
    }), 'https://example.com/hidden');
    assert.equal(extractUrlFromTelegramMessage({
      text: 'internal',
      entities: [{ type: 'text_link', offset: 0, length: 8, url: 'http://127.0.0.1/admin' }],
    }), null);
  });

  test('validates custom alias format for linked accounts', () => {
    for (const alias of ['my-brand', 'axly_2026', 'ABC123']) {
      assert.equal(isValidCustomAlias(alias), true, `${alias} should be valid`);
    }
    for (const alias of ['ab', 'has spaces', 'bad.alias', 'this-alias-is-far-too-long-for-the-thirty-character-limit']) {
      assert.equal(isValidCustomAlias(alias), false, `${alias} should be invalid`);
    }
  });

  test('validates Axly account linking code format', () => {
    assert.equal(isValidLinkCode('AX-849201'), true);
    assert.equal(isValidLinkCode('AX-A1B2C3'), true);
    assert.equal(isValidLinkCode('axly_tlink_0123456789abcdef0123456789abcdef'), true);
    assert.equal(isValidLinkCode('12345'), false);
    assert.equal(isValidLinkCode('INVALID'), false);
    assert.equal(isValidLinkCode(''), false);
  });
});

describe('2. QR Code Generation', () => {
  test('generates valid PNG image buffers for URLs', async () => {
    const shortUrl = 'https://s.axly.in/x7Q9a';
    const buffer = await QRCode.toBuffer(shortUrl, {
      width: 320,
      margin: 2,
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 50, 'PNG buffer should contain image data');
    // Verify PNG magic bytes: 0x89, 'P', 'N', 'G'
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  });
});

describe('3. Message Formatters and Branding', () => {
  test('welcome message contains Axly Studio branding and instructions', () => {
    const msg = formatWelcomeMessage('Alice');
    assert.ok(msg.includes('Welcome to <b>Axly Studio</b>'));
    assert.ok(msg.includes('Alice'));
    assert.ok(msg.includes('Shorten links, generate QR codes'));
  });

  test('formats link creation response for guests vs authenticated users', () => {
    const data = {
      shortUrl: 'https://url.axly.in/abc123',
      originalUrl: 'https://example.com/very/long/path',
      shortCode: 'abc123',
    };

    // Guest formatting
    const guestMsg = formatLinkCreatedMessage(data, true, null);
    assert.ok(guestMsg.includes('<code>https://url.axly.in/abc123</code>'));
    assert.ok(guestMsg.includes('Guest Link'));

    // Authenticated formatting
    const user = { name: 'Bob', plan: 'pro', email: 'bob@example.com' };
    const authMsg = formatLinkCreatedMessage(data, false, user);
    assert.ok(authMsg.includes('Saved to Bob\'s account'));
    assert.ok(authMsg.includes('(pro)'));
  });

  test('formats /mylinks with pagination and empty state', () => {
    // Empty state
    const emptyMsg = formatMyLinksList([], { page: 1, pages: 1, total: 0, limit: 5 });
    assert.ok(emptyMsg.includes('You don\'t have any links yet.'));

    // Populated state
    const links = [
      { short_code: 'code1', short_url: 'https://url.axly.in/code1', original_url: 'https://site1.com', click_count: 42, title: 'Blog' },
      { short_code: 'code2', short_url: 'https://url.axly.in/code2', original_url: 'https://site2.com', click_count: 5, title: null },
    ];
    const populatedMsg = formatMyLinksList(links, { page: 1, pages: 3, total: 12, limit: 5 }, { name: 'Bob' });
    assert.ok(populatedMsg.includes('Page 1 of 3'));
    assert.ok(populatedMsg.includes('42</b> clicks'));
    assert.ok(populatedMsg.includes('Blog'));
  });

  test('formats dashboard and link-specific analytics', () => {
    const stats = { totalUrls: 15, totalClicks: 320, activeUrls: 14, newThisMonth: 6 };
    const dashboardMsg = formatDashboardStats(stats, { name: 'Alice', plan: 'pro' });
    assert.ok(dashboardMsg.includes('Total Links: <b>15</b>'));
    assert.ok(dashboardMsg.includes('Total Clicks: <b>320</b>'));

    const linkData = { short_code: 'testcode', short_url: 'https://url.axly.in/testcode', original_url: 'https://example.com', click_count: 100, unique_clicks: 75, created_at: new Date().toISOString() };
    const analytics = {
      totalClicks: 100,
      uniqueClicks: 75,
      byCountry: [{ country: 'United States', clicks: 60 }, { country: 'India', clicks: 40 }],
      byDevice: [{ device: 'mobile', clicks: 70 }],
      byReferer: [{ referer: 'twitter.com', clicks: 50 }],
    };
    const linkMsg = formatLinkAnalytics(linkData, analytics);
    assert.ok(linkMsg.includes('Unique Visitors: <b>75</b>'));
    assert.ok(linkMsg.includes('United States'));
    assert.ok(linkMsg.includes('mobile'));
  });
});

describe('4. Anti-Abuse Rate Limiting & Duplicate Update Prevention', () => {
  beforeEach(() => {
    clearRateLimits();
  });

  test('allows requests within normal rate limit threshold', async () => {
    const ctx = createMockContext({ from: { id: 111 } });
    let passed = false;

    await rateLimitMiddleware(ctx, async () => {
      passed = true;
    });

    assert.equal(passed, true);
  });

  test('blocks abusive requests exceeding 25 requests/min', async () => {
    const ctx = createMockContext({ from: { id: 222 } });

    // Send 25 allowed requests
    for (let i = 0; i < 25; i++) {
      await rateLimitMiddleware(ctx, async () => {});
    }

    // 26th request should trigger warning reply and drop next()
    let executedNext = false;
    await rateLimitMiddleware(ctx, async () => {
      executedNext = true;
    });

    assert.equal(executedNext, false, 'Should not execute next when rate limited');
    assert.ok(ctx.replies.length > 0);
    assert.ok(ctx.replies[0].text.includes('Slow down!'));
  });

  test('discards duplicate update_id redelivered by Telegram', async () => {
    const updateId = 88776655;
    const ctx1 = createMockContext({ update: { update_id: updateId } });
    const ctx2 = createMockContext({ update: { update_id: updateId } });

    let firstExecuted = false;
    await rateLimitMiddleware(ctx1, async () => {
      firstExecuted = true;
    });
    assert.equal(firstExecuted, true);

    let duplicateExecuted = false;
    await rateLimitMiddleware(ctx2, async () => {
      duplicateExecuted = true;
    });
    assert.equal(duplicateExecuted, false, 'Duplicate update_id must be discarded');
  });
});

describe('5. Handlers, Account Linking & Guarded Operations', () => {
  beforeEach(() => {
    clearAllStates();
  });

  test('/start command returns welcome message and menu keyboard', async () => {
    const ctx = createMockContext();
    await handleStart(ctx);

    assert.equal(ctx.replies.length, 1);
    assert.ok(ctx.replies[0].text.includes('Welcome to <b>Axly Studio</b>'));
    assert.ok(ctx.replies[0].extra.reply_markup.inline_keyboard.length > 0);
  });

  test('/help command returns complete guide', async () => {
    const ctx = createMockContext();
    await handleHelp(ctx);

    assert.equal(ctx.replies.length, 1);
    assert.ok(ctx.replies[0].text.includes('/shorten'));
    assert.ok(ctx.replies[0].text.includes('/qr'));
    assert.ok(ctx.replies[0].text.includes('/mylinks'));
  });

  test('/cancel command resets active conversation state', async () => {
    const ctx = createMockContext({ from: { id: 333 } });
    setUserState(333, 'awaiting_shorten_url');

    await handleCancel(ctx);

    assert.ok(ctx.replies[0].text.includes('Action cancelled'));
  });

  test('/shorten without arguments prompts user with cancel button', async () => {
    const ctx = createMockContext({ message: { text: '/shorten' } });
    await handleShortenCommand(ctx);

    assert.ok(ctx.replies[0].text.includes('Please send the long URL you want to shorten'));
    assert.ok(ctx.replies[0].extra.reply_markup.inline_keyboard.length > 0);
  });

  test('/mylinks for unauthenticated guest displays account connection prompt', async () => {
    const ctx = createMockContext({ auth: { isLinked: false } });
    await handleMyLinks(ctx);

    assert.equal(ctx.replies.length, 1);
    assert.ok(ctx.replies[0].text.includes('Account Required for My Links'));
  });

  test('/stats for unauthenticated guest displays account connection prompt', async () => {
    const ctx = createMockContext({ auth: { isLinked: false } });
    await handleStats(ctx);

    assert.equal(ctx.replies.length, 1);
    assert.ok(ctx.replies[0].text.includes('Account Required for Analytics'));
  });

  test('/account displays not connected for guest and connected for verified user', async () => {
    // Guest
    const guestCtx = createMockContext({ auth: { isLinked: false } });
    await handleAccount(guestCtx);
    assert.ok(guestCtx.replies[0].text.includes('Not Connected (Guest Mode)'));

    // Authenticated
    const userCtx = createMockContext({
      auth: {
        isLinked: true,
        user: { name: 'Charlie', email: 'charlie@axly.in', plan: 'pro' },
      },
    });
    await handleAccount(userCtx);
    assert.ok(userCtx.replies[0].text.includes('Charlie'));
    assert.ok(userCtx.replies[0].text.includes('Connected'));
  });

  test('/link with invalid or missing code returns helpful usage guide', async () => {
    const ctxMissing = createMockContext({ message: { text: '/link' } });
    await handleLinkCommand(ctxMissing);
    assert.ok(ctxMissing.replies[0].text.includes('Missing Linking Code'));

    const ctxInvalid = createMockContext({ message: { text: '/link BADCODE' } });
    await handleLinkCommand(ctxInvalid);
    assert.ok(ctxInvalid.replies[0].text.includes('Invalid Code Format'));
  });

  test('user preference toggling works for auto-QR', () => {
    const userId = 777;
    const pref1 = toggleUserPreference(userId, 'autoQr');
    assert.equal(pref1.autoQr, true);

    const pref2 = toggleUserPreference(userId, 'autoQr');
    assert.equal(pref2.autoQr, false);
  });
});
