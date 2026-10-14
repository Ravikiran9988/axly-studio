import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool, { query } from '../db/pool.js';
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

// Fail closed for every service-to-service operation and compare secrets in constant time.
const isValidBotSecret = (candidate) => {
  const expected = config.telegram.botSecret;
  if (typeof candidate !== 'string' || !expected || expected.length < 32) return false;
  const actualBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

/**
 * POST /api/telegram/link-code
 * Authenticated endpoint for Axly users on the web dashboard to generate a single-use linking code.
 */
export const generateLinkCode = async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    const userId = req.user.id;
    const token = 'axly_tlink_' + crypto.randomBytes(24).toString('hex');
    const code = generateFriendlyCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Serialize code generation per user so only the latest code remains active.
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;

    const userCheck = await client.query(
      'SELECT id, is_active FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_active) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(403).json({ success: false, message: 'Account is inactive.' });
    }

    await client.query(
      'UPDATE telegram_link_tokens SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [userId]
    );
    await client.query(
      `INSERT INTO telegram_link_tokens (user_id, token, code, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, token, code, expiresAt]
    );

    await client.query('COMMIT');
    transactionOpen = false;

    const botUsername = config.telegram.botUsername || 'AxlyStudioBot';
    const deepLink = `https://t.me/${botUsername}?start=link_${code}`;

    return res.status(201).json({
      success: true,
      code,
      token,
      expiresAt: expiresAt.toISOString(),
      expiresInSeconds: 600,
      deepLink,
      message: 'Linking code generated successfully. It will expire in 10 minutes.',
    });
  } catch (err) {
    if (client && transactionOpen) {
      await client.query('ROLLBACK').catch(() => {});
      transactionOpen = false;
    }
    console.error('generateLinkCode error:', err);
    return res.status(500).json({ success: false, message: 'Failed to generate linking code.' });
  } finally {
    client?.release();
  }
};

/**
 * POST /api/telegram/verify
 * Called by the Telegram Bot (or direct user submission) to verify code and link account.
 */
export const verifyLink = async (req, res) => {
  let client;
  let transactionOpen = false;

  try {
    const { code, token: rawToken, telegramUserId, telegramUsername, telegramFirstName } = req.body || {};
    const lookupCode = typeof code === 'string' ? code.trim().toUpperCase() : '';
    const lookupToken = typeof rawToken === 'string' ? rawToken.trim() : '';

    if (!lookupCode && !lookupToken) {
      return res.status(400).json({ success: false, message: 'Linking code or token is required.' });
    }

    const parsedTgId = telegramUserId === undefined || telegramUserId === null
      ? ''
      : String(telegramUserId).trim();
    if (!/^[0-9]{1,20}$/.test(parsedTgId) || /^0+$/.test(parsedTgId)) {
      return res.status(400).json({ success: false, message: 'A valid Telegram user ID is required.' });
    }

    // A single dedicated connection is required for PostgreSQL transactions.
    client = await pool.connect();
    await client.query('BEGIN');
    transactionOpen = true;

    // Lock the selected token row. A second request cannot pass the single-use check concurrently.
    const tokenResult = lookupToken
      ? await client.query(
          `SELECT t.id AS link_token_id, t.user_id AS link_owner_id, t.expires_at, t.used_at,
                  u.id AS user_id, u.name, u.email, u.role, u.plan, u.token_version, u.is_active
           FROM telegram_link_tokens t
           JOIN users u ON t.user_id = u.id
           WHERE t.token = $1
           LIMIT 1
           FOR UPDATE OF t`,
          [lookupToken]
        )
      : await client.query(
          `SELECT t.id AS link_token_id, t.user_id AS link_owner_id, t.expires_at, t.used_at,
                  u.id AS user_id, u.name, u.email, u.role, u.plan, u.token_version, u.is_active
           FROM telegram_link_tokens t
           JOIN users u ON t.user_id = u.id
           WHERE UPPER(t.code) = $1
           LIMIT 1
           FOR UPDATE OF t`,
          [lookupCode]
        );

    if (tokenResult.rows.length === 0) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({
        success: false,
        code: 'INVALID_LINK_CODE',
        message: 'Invalid linking code. Please generate a fresh code in your Axly dashboard (Settings > Telegram).',
      });
    }

    const tokenRecord = tokenResult.rows[0];

    if (tokenRecord.used_at) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({
        success: false,
        code: 'CODE_ALREADY_USED',
        message: 'This linking code has already been used. Please generate a new code in your Axly dashboard.',
      });
    }

    if (new Date(tokenRecord.expires_at) <= new Date()) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({
        success: false,
        code: 'CODE_EXPIRED',
        message: 'This linking code has expired (valid for 10 minutes). Please generate a fresh code.',
      });
    }

    if (!tokenRecord.is_active) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_DISABLED',
        message: 'The Axly account associated with this code is disabled.',
      });
    }

    const cleanUsername = telegramUsername
      ? String(telegramUsername).replace(/^@/, '').slice(0, 255)
      : null;
    const cleanFirstName = telegramFirstName
      ? String(telegramFirstName).slice(0, 255)
      : null;

    // Claim the code conditionally as a second guard against expiry/replay races.
    const claim = await client.query(
      `UPDATE telegram_link_tokens
       SET used_at = NOW()
       WHERE id = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING id`,
      [tokenRecord.link_token_id]
    );

    if (claim.rowCount !== 1) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(400).json({
        success: false,
        code: 'CODE_ALREADY_USED_OR_EXPIRED',
        message: 'This linking code has expired or has already been used. Please generate a new code.',
      });
    }

    // Maintain one Axly account per Telegram identity within the same transaction.
    await client.query('DELETE FROM telegram_links WHERE user_id = $1', [tokenRecord.link_owner_id]);
    await client.query(
      `INSERT INTO telegram_links (user_id, telegram_user_id, telegram_username, telegram_first_name, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (telegram_user_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         telegram_username = EXCLUDED.telegram_username,
         telegram_first_name = EXCLUDED.telegram_first_name,
         updated_at = NOW()`,
      [tokenRecord.link_owner_id, parsedTgId, cleanUsername, cleanFirstName]
    );

    await client.query('COMMIT');
    transactionOpen = false;

    // Issue the session only after the link transaction has committed.
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

    return res.json({
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
    if (client && transactionOpen) {
      await client.query('ROLLBACK').catch(() => {});
      transactionOpen = false;
    }
    console.error('verifyLink error:', err);
    return res.status(500).json({ success: false, message: 'Failed to verify linking code.' });
  } finally {
    client?.release();
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
    if (!isValidBotSecret(botSecret)) {
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

    if (isValidBotSecret(botSecret) && telegramUserId) {
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
