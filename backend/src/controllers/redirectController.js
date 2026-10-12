import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import UAParser from 'ua-parser-js';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';

// Escape HTML utility to prevent reflection XSS in rendered pages
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Generate auth token for password protected links
const getPasswordAuthToken = (urlId, passwordHash) => {
  const secret = config.jwt?.secret || 'axly_pw_secret';
  return crypto.createHmac('sha256', secret).update(`${urlId}:${passwordHash}`).digest('hex');
};

// In-memory brute-force rate limiter for password unlocks
const unlockAttempts = new Map();
const checkPasswordRateLimit = (ip, shortCode) => {
  const key = `${ip}:${shortCode}`;
  const now = Date.now();
  const entry = unlockAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }

  if (entry.count >= 5) {
    return false; // Rate limit exceeded (5 attempts per 15 min)
  }

  entry.count++;
  unlockAttempts.set(key, entry);
  return true;
};

// Clean up stale rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of unlockAttempts.entries()) {
    if (now > entry.resetAt) {
      unlockAttempts.delete(key);
    }
  }
}, 60 * 1000);

// Consistent weighted allocation for A/B experiment variants
const allocateVariant = (variants, visitorHash) => {
  if (!variants || variants.length === 0) return null;
  if (variants.length === 1) return variants[0];

  const totalWeight = variants.reduce((sum, v) => sum + (Number(v.weight) || 1), 0);
  // Hash to integer between 0 and 9999
  const hashInt = parseInt(visitorHash.slice(0, 8), 16) % 10000;
  const targetThreshold = (hashInt / 10000) * totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += (Number(variant.weight) || 1);
    if (cumulative >= targetThreshold) {
      return variant;
    }
  }
  return variants[0];
};

// Merge incoming visitor query parameters safely into the destination URL
const mergeQueryParams = (destinationUrl, incomingQuery) => {
  try {
    const url = new URL(destinationUrl);
    for (const [key, value] of Object.entries(incomingQuery)) {
      if (['skip_preview', 'preview', 'password'].includes(key)) continue;
      // Do not overwrite existing destination parameters unless absent
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  } catch {
    return destinationUrl;
  }
};

// GET /:shortCode - High performance smart redirection
export const redirect = async (req, res) => {
  try {
    const { shortCode } = req.params;

    if (!shortCode || typeof shortCode !== 'string') {
      return res.status(404).send(renderErrorPage('Link Not Found', 'This short link does not exist.'));
    }

    const cleanCode = shortCode.trim().toLowerCase();

    // Fetch URL with smart routing parameters
    const result = await query(
      `SELECT id, original_url, status, expires_at, password_hash, is_preview_enabled, title 
       FROM urls WHERE short_code = $1`,
      [cleanCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(renderErrorPage('Link Not Found', 'This short link does not exist or has been removed.'));
    }

    const url = result.rows[0];

    // Check link active status
    if (url.status !== 'active') {
      return res.status(410).send(renderErrorPage('Link Disabled', 'This short link has been disabled by its owner.'));
    }

    // Check expiration
    if (url.expires_at && new Date(url.expires_at) < new Date()) {
      return res.status(410).send(renderErrorPage('Link Expired', 'This short link has expired and is no longer available.'));
    }

    // 1. Password Protection Check
    if (url.password_hash) {
      const cookieHeader = req.headers.cookie || '';
      const cookieName = `axly_pw_${url.id}`;
      const tokenMatch = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(`${cookieName}=`));
      const clientToken = tokenMatch ? tokenMatch.split('=')[1] : null;
      const expectedToken = getPasswordAuthToken(url.id, url.password_hash);

      if (clientToken !== expectedToken) {
        return res.send(renderPasswordPage(cleanCode));
      }
    }

    // 2. Safety Preview Intermediary Page Check
    const skipPreview = req.query.skip_preview === '1';
    if ((url.is_preview_enabled || req.query.preview === '1') && !skipPreview) {
      return res.send(renderPreviewPage(url, cleanCode));
    }

    // Parse user agent for device routing & analytics
    const uaHeader = req.headers['user-agent'] || '';
    const ua = new UAParser(uaHeader);
    const deviceType = ua.getDevice().type || 'desktop';

    // Privacy-conscious visitor hash for tracking and A/B allocation
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const salt = process.env.VISITOR_SALT || 'axly_default_visitor_salt_2026';
    const visitorHash = crypto
      .createHmac('sha256', salt)
      .update(`${url.id}:${rawIp}:${uaHeader}`)
      .digest('hex');

    let targetDestination = url.original_url;
    let smartRuleId = null;
    let experimentId = null;
    let variantId = null;

    // 3. A/B Experiment Allocation
    const expRes = await query(`
      SELECT id, name FROM experiments 
      WHERE url_id = $1 AND status = 'active' 
        AND (start_time IS NULL OR start_time <= NOW()) 
        AND (end_time IS NULL OR end_time >= NOW())
      LIMIT 1
    `, [url.id]);

    if (expRes.rows.length > 0) {
      const exp = expRes.rows[0];
      const variantsRes = await query(`
        SELECT id, name, destination_url, weight 
        FROM experiment_variants 
        WHERE experiment_id = $1 
        ORDER BY id ASC
      `, [exp.id]);

      if (variantsRes.rows.length > 0) {
        const allocated = allocateVariant(variantsRes.rows, visitorHash);
        if (allocated) {
          targetDestination = allocated.destination_url;
          experimentId = exp.id;
          variantId = allocated.id;
        }
      }
    } else {
      // 4. Smart Redirect Rules Evaluation (in priority order)
      const rulesRes = await query(`
        SELECT id, rule_type, match_value, destination_url, start_time, end_time, timezone 
        FROM smart_redirect_rules 
        WHERE url_id = $1 AND is_active = true 
        ORDER BY priority ASC, created_at ASC
      `, [url.id]);

      for (const rule of rulesRes.rows) {
        // Device rule match
        if (rule.rule_type === 'device') {
          if (rule.match_value && rule.match_value.toLowerCase() === deviceType.toLowerCase()) {
            targetDestination = rule.destination_url;
            smartRuleId = rule.id;
            break;
          }
        }

        // Time rule match
        if (rule.rule_type === 'time' && rule.start_time && rule.end_time) {
          try {
            const tz = rule.timezone || 'UTC';
            const nowInTz = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour12: false });
            if (nowInTz >= rule.start_time && nowInTz <= rule.end_time) {
              targetDestination = rule.destination_url;
              smartRuleId = rule.id;
              break;
            }
          } catch (tzErr) {
            console.error('Timezone evaluation error:', tzErr.message);
          }
        }
      }
    }

    // 5. Merge incoming query parameters
    const finalDestination = mergeQueryParams(targetDestination, req.query);

    // Validate protocol before final redirect
    try {
      const parsed = new URL(finalDestination);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(500).send(renderErrorPage('Invalid Destination', 'Destination URL protocol is not permitted.'));
      }
    } catch {
      return res.status(500).send(renderErrorPage('Invalid Destination', 'Destination URL is malformed.'));
    }

    // Fast 302 redirect
    res.redirect(302, finalDestination);

    // 6. Asynchronous atomic tracking (non-blocking)
    handleTracking(url.id, req, { visitorHash, smartRuleId, experimentId, variantId, ua, deviceType }).catch(err => {
      console.error('Async tracking error:', err.message);
    });
  } catch (err) {
    console.error('Redirect handler error:', err);
    res.status(500).send(renderErrorPage('Server Error', 'Unable to complete the redirection.'));
  }
};

// POST /:shortCode/unlock - Verify password for protected short URL
export const unlockPasswordProtectedLink = async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { password } = req.body;
    const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (!checkPasswordRateLimit(rawIp, shortCode)) {
      return res.send(renderPasswordPage(shortCode, 'Too many incorrect attempts. Please wait 15 minutes before trying again.'));
    }

    const result = await query(
      'SELECT id, password_hash FROM urls WHERE short_code = $1',
      [shortCode.trim().toLowerCase()]
    );

    if (result.rows.length === 0 || !result.rows[0].password_hash) {
      return res.redirect(`/${shortCode}`);
    }

    const url = result.rows[0];
    const isMatch = await bcrypt.compare(String(password || ''), url.password_hash);

    if (!isMatch) {
      return res.send(renderPasswordPage(shortCode, 'Incorrect password. Access denied.'));
    }

    // Set signed authorization cookie valid for 2 hours
    const token = getPasswordAuthToken(url.id, url.password_hash);
    res.setHeader('Set-Cookie', `axly_pw_${url.id}=${token}; Path=/; Max-Age=7200; SameSite=Lax; HttpOnly`);
    res.redirect(`/${shortCode}`);
  } catch (err) {
    console.error('unlockPasswordProtectedLink error:', err);
    res.status(500).send(renderErrorPage('Server Error', 'Failed to authenticate password.'));
  }
};

// Async tracking with race-condition-free atomic unique visitor recording
const handleTracking = async (urlId, req, { visitorHash, smartRuleId, experimentId, variantId, ua, deviceType }) => {
  const browserName = ua.getBrowser().name || 'Unknown';
  const osName = ua.getOS().name || 'Unknown';
  const referer = req.headers.referer || req.headers.referrer || null;
  const uaHeader = req.headers['user-agent'] || '';

  // Atomic database-enforced unique visitor insert
  const uniqueInsertRes = await query(`
    INSERT INTO url_unique_visitors (url_id, visitor_hash)
    VALUES ($1, $2)
    ON CONFLICT (url_id, visitor_hash) DO NOTHING
    RETURNING 1
  `, [urlId, visitorHash]);

  const isUnique = uniqueInsertRes.rows.length > 0;

  // Record click event (never store raw IP for privacy compliance)
  await query(`
    INSERT INTO click_events (url_id, visitor_hash, user_agent, referer, device_type, browser, os, country, smart_rule_id, experiment_id, variant_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    urlId,
    visitorHash,
    uaHeader ? uaHeader.slice(0, 500) : null,
    referer ? referer.slice(0, 500) : null,
    deviceType,
    browserName,
    osName,
    'Unknown',
    smartRuleId,
    experimentId,
    variantId
  ]);

  // Atomic increment on urls table
  await query(`
    UPDATE urls 
    SET click_count = click_count + 1,
        unique_clicks = unique_clicks + (CASE WHEN $2 = true THEN 1 ELSE 0 END)
    WHERE id = $1
  `, [urlId, isUnique]);

  // If part of experiment, increment variant clicks
  if (variantId) {
    await query(`
      UPDATE experiment_variants SET clicks = clicks + 1 WHERE id = $1
    `, [variantId]);
  }
};

// Render stylish password unlock challenge page
const renderPasswordPage = (shortCode, errorMessage = null) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Protected Link — Axly Studio</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fbfbfa;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e5e3dc;
        border-radius: 16px;
        padding: 40px;
        max-width: 420px;
        width: 100%;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      }
      .icon-wrap {
        width: 52px;
        height: 52px;
        background: #eff6ff;
        color: #2563eb;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        margin: 0 auto 20px;
      }
      h1 { font-size: 22px; font-weight: 800; margin: 0 0 8px; letter-spacing: -0.02em; }
      p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
      .form-input {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 16px;
        font-size: 15px;
        border: 1px solid #e5e3dc;
        border-radius: 10px;
        margin-bottom: 16px;
        outline: none;
      }
      .form-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
      .btn {
        width: 100%;
        padding: 12px;
        background: #2563eb;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn:hover { background: #1d4ed8; }
      .alert {
        background: #fef2f2;
        color: #dc2626;
        border: 1px solid #fee2e2;
        border-radius: 8px;
        padding: 10px 14px;
        font-size: 13px;
        margin-bottom: 18px;
        text-align: left;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-wrap">🔒</div>
      <h1>Password Protected</h1>
      <p>This link is encrypted by its author. Enter the password to continue.</p>
      ${errorMessage ? `<div class="alert">${escapeHtml(errorMessage)}</div>` : ''}
      <form method="POST" action="/${escapeHtml(shortCode)}/unlock">
        <input 
          type="password" 
          name="password" 
          class="form-input" 
          placeholder="Enter link password" 
          required 
          autofocus 
        />
        <button type="submit" class="btn">Unlock & Proceed →</button>
      </form>
    </div>
  </body>
</html>
`;

// Render safety destination preview page
const renderPreviewPage = (url, shortCode) => {
  let domain = 'destination';
  try { domain = new URL(url.original_url).hostname; } catch {}

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Preview — Axly Studio</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fbfbfa;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e5e3dc;
        border-radius: 16px;
        padding: 40px;
        max-width: 480px;
        width: 100%;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      }
      .shield {
        width: 52px; height: 52px;
        background: #ecfdf5; color: #059669;
        border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 24px; margin: 0 auto 16px;
      }
      h1 { font-size: 22px; font-weight: 800; margin: 0 0 8px; }
      p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
      .dest-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 24px;
        text-align: left;
      }
      .dest-label { font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: 700; margin-bottom: 6px; }
      .dest-url { font-size: 14px; color: #2563eb; font-weight: 600; word-break: break-all; }
      .btn {
        display: block; width: 100%; box-sizing: border-box;
        padding: 12px; background: #2563eb; color: #fff;
        text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600;
      }
      .btn:hover { background: #1d4ed8; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="shield">🛡️</div>
      <h1>Safety Verification</h1>
      <p>You are about to be redirected to an external website. Please review the destination hostname below.</p>
      <div class="dest-box">
        <div class="dest-label">Verified Target Destination (${escapeHtml(domain)})</div>
        <div class="dest-url">${escapeHtml(url.original_url)}</div>
      </div>
      <a href="/${escapeHtml(shortCode)}?skip_preview=1" class="btn">Continue to Destination →</a>
    </div>
  </body>
</html>
`;
};

// Render generic error page
const renderErrorPage = (title, message) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} — Axly Studio</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #fbfbfa;
        color: #111827;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 24px;
        box-sizing: border-box;
      }
      .card {
        background: #ffffff;
        border: 1px solid #e5e3dc;
        border-radius: 16px;
        padding: 40px;
        max-width: 420px;
        width: 100%;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      }
      h1 { font-size: 22px; font-weight: 800; margin: 0 0 10px; }
      p { color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
      a {
        display: inline-block;
        background: #2563eb;
        color: #fff;
        text-decoration: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div style="font-size: 32px; margin-bottom: 12px;">🔗</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a href="${escapeHtml(config.FRONTEND_URL)}">Go to Axly Studio</a>
    </div>
  </body>
</html>
`;
