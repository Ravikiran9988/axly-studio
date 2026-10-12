import UAParser from 'ua-parser-js';
import { query } from '../db/pool.js';

// GET /:shortCode - Redirect to original URL
export const redirect = async (req, res) => {
  try {
    const { shortCode } = req.params;

    const result = await query(
      `SELECT id, original_url, status, expires_at FROM urls WHERE short_code = $1`,
      [shortCode]
    );

    if (result.rows.length === 0) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Not Found - Axly</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:#fff;">
            <h1 style="color:#7c3aed">Axly</h1>
            <h2>Link Not Found</h2>
            <p>This short link does not exist or has been removed.</p>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="color:#7c3aed">Create your own short links →</a>
          </body>
        </html>
      `);
    }

    const url = result.rows[0];

    if (url.status !== 'active') {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Disabled - Axly</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:#fff;">
            <h1 style="color:#7c3aed">Axly</h1>
            <h2>Link Disabled</h2>
            <p>This short link has been disabled by its owner.</p>
          </body>
        </html>
      `);
    }

    if (url.expires_at && new Date(url.expires_at) < new Date()) {
      return res.status(410).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Link Expired - Axly</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:60px;background:#0f0f1a;color:#fff;">
            <h1 style="color:#7c3aed">Axly</h1>
            <h2>Link Expired</h2>
            <p>This short link has expired.</p>
          </body>
        </html>
      `);
    }

    // Track the click asynchronously
    trackClick(url.id, req).catch(console.error);

    // Increment click count
    query('UPDATE urls SET click_count = click_count + 1, updated_at = NOW() WHERE id = $1', [url.id])
      .catch(console.error);

    res.redirect(302, url.original_url);
  } catch (err) {
    console.error('Redirect error:', err);
    res.status(500).send('Server error');
  }
};

const trackClick = async (urlId, req) => {
  try {
    const ua = new UAParser(req.headers['user-agent'] || '');
    const browserName = ua.getBrowser().name || 'Unknown';
    const osName = ua.getOS().name || 'Unknown';
    const deviceType = ua.getDevice().type || 'desktop';
    const referer = req.headers.referer || req.headers.referrer || null;
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null;

    await query(
      `INSERT INTO click_events (url_id, ip_address, user_agent, referer, device_type, browser, os)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [urlId, ip, req.headers['user-agent'] || null, referer, deviceType, browserName, osName]
    );
  } catch (err) {
    console.error('Track click error:', err);
  }
};
