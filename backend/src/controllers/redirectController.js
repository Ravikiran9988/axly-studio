import crypto from 'crypto';
import net from 'net';
import UAParser from 'ua-parser-js';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';

// Escape HTML utility to prevent reflection XSS in error screens
const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// GET /:shortCode - Redirect to original URL
export const redirect = async (req, res) => {
  try {
    const { shortCode } = req.params;

    if (!shortCode || typeof shortCode !== 'string') {
      return res.status(404).send(renderErrorPage('Link Not Found', 'This short link does not exist.'));
    }

    const result = await query(
      `SELECT id, original_url, status, expires_at FROM urls WHERE short_code = $1`,
      [shortCode.trim().toLowerCase()]
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

    // Safety check on destination protocol to prevent open redirect vulnerabilities
    try {
      const parsed = new URL(url.original_url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return res.status(500).send(renderErrorPage('Invalid Destination', 'Destination URL protocol is not permitted.'));
      }
    } catch {
      return res.status(500).send(renderErrorPage('Invalid Destination', 'Destination URL is malformed.'));
    }

    // Send redirect immediately (fast redirect)
    res.redirect(302, url.original_url);

    // Track the click asynchronously without blocking the user
    handleTracking(url.id, req).catch((err) => {
      console.error('Async click tracking error:', err.message);
    });
  } catch (err) {
    console.error('Redirect handler error:', err);
    res.status(500).send(renderErrorPage('Server Error', 'Unable to complete the redirection.'));
  }
};

const handleTracking = async (urlId, req) => {
  const uaHeader = req.headers['user-agent'] || '';
  const ua = new UAParser(uaHeader);
  const browserName = ua.getBrowser().name || 'Unknown';
  const osName = ua.getOS().name || 'Unknown';
  const deviceType = ua.getDevice().type || 'desktop';
  const referer = req.headers.referer || req.headers.referrer || null;

  // Privacy-conscious IP determination
  // Express req.ip is used when trust proxy is configured; never trust raw client headers
  const rawIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  // Check if valid IP for PostgreSQL INET data type
  const isValidIp = net.isIP(rawIp) !== 0;
  const ipForDb = isValidIp ? rawIp : null;

  // Privacy-conscious visitor hash (HMAC SHA-256)
  // Deduplicates unique visitors without storing sensitive browsing identities permanently
  const salt = process.env.VISITOR_SALT || 'axly_default_visitor_salt_2026';
  const visitorHash = crypto
    .createHmac('sha256', salt)
    .update(`${urlId}:${rawIp}:${uaHeader}`)
    .digest('hex');

  // Check if this visitor has already clicked this link
  const previousClick = await query(
    `SELECT 1 FROM click_events WHERE url_id = $1 AND visitor_hash = $2 LIMIT 1`,
    [urlId, visitorHash]
  );
  const isUnique = previousClick.rows.length === 0;

  // Insert click event with privacy-conscious visitor hash
  await query(
    `INSERT INTO click_events (url_id, ip_address, visitor_hash, user_agent, referer, device_type, browser, os, country)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      urlId,
      ipForDb,
      visitorHash,
      uaHeader ? uaHeader.slice(0, 500) : null,
      referer ? referer.slice(0, 500) : null,
      deviceType,
      browserName,
      osName,
      'Unknown' // Honestly recorded as Unknown unless a verified IP-geo service is configured
    ]
  );

  // Increment total clicks, and increment unique_clicks if first time visitor
  if (isUnique) {
    await query(
      `UPDATE urls SET click_count = click_count + 1, unique_clicks = unique_clicks + 1 WHERE id = $1`,
      [urlId]
    );
  } else {
    await query(
      `UPDATE urls SET click_count = click_count + 1 WHERE id = $1`,
      [urlId]
    );
  }
};

const renderErrorPage = (title, message) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} — Axly</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background: #09090f;
        color: #e2e8f0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        padding: 20px;
        box-sizing: border-box;
      }
      .card {
        background: rgba(18, 18, 30, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 40px;
        max-width: 440px;
        text-align: center;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }
      .brand {
        font-size: 24px;
        font-weight: 800;
        background: linear-gradient(135deg, #a855f7, #6366f1);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 24px;
      }
      h1 { font-size: 20px; margin: 0 0 12px; color: #f8fafc; }
      p { color: #94a3b8; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
      a {
        display: inline-block;
        background: #7c3aed;
        color: #fff;
        text-decoration: none;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        transition: opacity 0.2s;
      }
      a:hover { opacity: 0.9; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">Axly</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <a href="${escapeHtml(config.FRONTEND_URL)}">Go to Axly Home</a>
    </div>
  </body>
</html>
`;
