import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';

// Generate user-friendly, high-entropy 6-character code (avoiding ambiguous chars)
const SAFE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const generateFriendlyCode = () => {
  let result = 'AX-';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    result += SAFE_CHARS[bytes[i] % SAFE_CHARS.length];
  }
  return result;
};

/**
 * POST /api/telegram/link-code
 * Authenticated endpoint for Axly users on the web dashboard to generate a single-use linking code.
 */
export const generateLinkCode = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user account is active
    const userCheck = await query('SELECT id, is_active FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }

    const token = 'axly_tlink_' + crypto.randomBytes(24).toString('hex');
    const code = generateFriendlyCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate any existing unused tokens for this user to prevent clutter
    await query(
      "UPDATE telegram_link_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL",
      [userId]
    );

    await query(
      `INSERT INTO telegram_link_tokens (user_id, token, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, token, code, expiresAt]
    );

    const botUsername = config.telegram.botUsername || 'AxlyStudioBot';
    const deepLink = `https://t.me/${botUsername}?start=link_${code}`;

    res.status(201).json({
      success: true,
      code,
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 600,
      deepLink,
      message: 'Linking code generated successfully. It will expire in 10 minutes.',
    });
  } catch (err) {
    console.error('generateLinkCode error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate linking code.' });
  }
};

/**
 * POST /api/telegram/verify
 * Called by the Telegram Bot (or direct user submission) to verify code and link account.
 */
export const verifyLink = async (req, res) => {
  try {
    const { code, token: rawToken, telegramUserId, telegramUsername, telegramFirstName } = req.body;

    if (!code && !rawToken) {
      return res.status(400).json({ success: false, message: 'Linking code or token is required.' });
    }

    if (!telegramUserId) {
      return res.status(400).json({ success: false, message: 'Telegram user ID is required.' });
    }

    const lookupCode = (code || '').trim().toUpperCase();
    const lookupToken = (rawToken || '').trim();

    // Query token record
    const result = await query(
      `SELECT t.id, t.user_id, t.expires_at, t.used_at,
              u.id as user_id, u.name, u.email, u.role, u.plan, u.token_version, u.is_active
       FROM telegram_link_tokens t
       JOIN users u ON t.user_id = u.id
       WHERE (UPPER(t.code) = $1 OR t.token = $2)
       LIMIT 1`,
      [lookupCode, lookupToken || lookupCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        code: 'INVALID_LINK_CODE',
        message: 'Invalid linking code. Please generate a fresh code in your Axly dashboard (Settings > Telegram).',
      });
    }

    const tokenRecord = result.rows[0];

    if (tokenRecord.used_at) {
      return res.status(400).json({
        success: false,
        code: 'CODE_ALREADY_USED',
        message: 'This linking code has already been used. Please generate a new code in your Axly dashboard.',
      });
    }

    if (new Date(tokenRecord.expires_at) <= new Date()) {
      return res.status(400).json({
        success: false,
        code: 'CODE_EXPIRED',
        message: 'This linking code has expired (valid for 10 minutes). Please generate a fresh code.',
      });
    }

    if (!tokenRecord.is_active) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'The Axly account associated with this code is disabled.',
      });
    }

    const parsedTgId = String(telegramUserId).trim();
    const cleanUsername = telegramUsername ? String(telegramUsername).replace(/^@/, '').slice(0, 255) : null;
    const cleanFirstName = telegramFirstName ? String(telegramFirstName).slice(0, 255) : null;

    // Atomic update of token and upsert into telegram_links
    await query('BEGIN');
    try {
      await query('UPDATE telegram_link_tokens SET used_at = NOW() WHERE id = $1', [tokenRecord.id]);

      // Remove any previous link for this Axly user to keep 1:1 mapping
      await query('DELETE FROM telegram_links WHERE user_id = $1', [tokenRecord.user_id]);

      // Upsert by telegram_user_id
      await query(
        `INSERT INTO telegram_links (user_id, telegram_user_id, telegram_username, telegram_first_name, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (telegram_user_id) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           telegram_username = EXCLUDED.telegram_username,
           telegram_first_name = EXCLUDED.telegram_first_name,
           updated_at = NOW()`,
        [tokenRecord.user_id, parsedTgId, cleanUsername, cleanFirstName]
      );

      await query('COMMIT');
    } catch (txnErr) {
      await query('ROLLBACK');
      throw txnErr;
    }

    // Issue standard scoped JWT token for the bot session
    const sessionToken = jwt.sign(
      {
        id: tokenRecord.user_id,
        email: tokenRecord.email,
        name: tokenRecord.name,
        role: tokenRecord.role || 'user',
        token_version: tokenRecord.token_version || 1,
        source: 'telegram_bot',
      },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Account linked successfully!',
      user: {
        id: tokenRecord.user_id,
        name: tokenRecord.name,
        email: tokenRecord.email,
        plan: tokenRecord.plan || 'free',
        role: tokenRecord.role || 'user',
      },
      token: sessionToken,
    });
  } catch (err) {
    console.error('verifyLink error:', err);
    res.status(500).json({ success: false, message: 'Failed to verify linking code.' });
  }
};

/**
 * POST /api/telegram/session
 * Service-to-service endpoint for Telegram Bot to retrieve or restore an active session for a Telegram User ID.
 * Requires internal bot secret header.
 */
export const getTelegramSession = async (req, res) => {
  try {
    const botSecret = req.headers['x-telegram-bot-secret'];
    if (config.telegram.botSecret && botSecret !== config.telegram.botSecret) {
      return res.status(403).json({ success: false, message: 'Invalid bot secret.' });
    }

    const { telegramUserId } = req.body;
    if (!telegramUserId) {
      return res.status(400).json({ success: false, message: 'telegramUserId is required.' });
    }

    const parsedTgId = String(telegramUserId).trim();
    const result = await query(
      `SELECT tl.id, tl.user_id, tl.telegram_username, tl.telegram_first_name, tl.created_at,
              u.id as user_id, u.name, u.email, u.role, u.plan, u.token_version, u.is_active
       FROM telegram_links tl
       JOIN users u ON tl.user_id = u.id
       WHERE tl.telegram_user_id = $1
       LIMIT 1`,
      [parsedTgId]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return res.json({ success: true, linked: false });
    }

    const user = result.rows[0];
    const sessionToken = jwt.sign(
      {
        id: user.user_id,
        email: user.email,
        name: user.name,
        role: user.role || 'user',
        token_version: user.token_version || 1,
        source: 'telegram_bot',
      },
      config.jwt.secret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      linked: true,
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        plan: user.plan || 'free',
        role: user.role || 'user',
      },
      telegram: {
        username: user.telegram_username,
        firstName: user.telegram_first_name,
        linkedAt: user.created_at,
      },
      token: sessionToken,
    });
  } catch (err) {
    console.error('getTelegramSession error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve session.' });
  }
};

/**
 * GET /api/telegram/status
 * Check Telegram connection status for the logged-in web user.
 */
export const getStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT telegram_user_id, telegram_username, telegram_first_name, created_at
       FROM telegram_links
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, linked: false });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      linked: true,
      telegram: {
        telegramUserId: row.telegram_user_id,
        username: row.telegram_username,
        firstName: row.telegram_first_name,
        linkedAt: row.created_at,
      },
    });
  } catch (err) {
    console.error('getStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve status.' });
  }
};

/**
 * POST /api/telegram/unlink
 * Unlink Telegram identity from Axly account.
 * Supports:
 *  1. Authenticated Axly user on Web (via Bearer token)
 *  2. Telegram Bot service (via x-telegram-bot-secret header + telegramUserId)
 */
export const unlinkTelegram = async (req, res) => {
  try {
    const botSecret = req.headers['x-telegram-bot-secret'];
    const { telegramUserId } = req.body;

    if (req.user && req.user.id) {
      // User requested unlink from web
      await query('DELETE FROM telegram_links WHERE user_id = $1', [req.user.id]);
      return res.json({ success: true, message: 'Telegram account unlinked successfully.' });
    }

    if (config.telegram.botSecret && botSecret === config.telegram.botSecret && telegramUserId) {
      // Bot requested unlink
      await query('DELETE FROM telegram_links WHERE telegram_user_id = $1', [String(telegramUserId).trim()]);
      return res.json({ success: true, message: 'Telegram account unlinked successfully.' });
    }

    return res.status(401).json({ success: false, message: 'Unauthorized unlink request.' });
  } catch (err) {
    console.error('unlinkTelegram error:', err);
    res.status(500).json({ success: false, message: 'Failed to unlink account.' });
  }
};
