import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';

const RESERVED_ALIASES = new Set([
  'api', 'auth', 'login', 'register', 'dashboard', 'links', 'analytics',
  'settings', 'health', 'docs', 'admin', 's', 'url', 'favicon', 'robots',
  'static', 'assets', 'help', 'status', 'terms', 'privacy', 'pricing', 'about',
]);

const generateShortCode = () => nanoid(6);

const isValidUrl = (urlStr) => {
  if (typeof urlStr !== 'string' || urlStr.length > 2048) {
    return false;
  }
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return false;
    }
    // Must have a valid host
    if (!parsed.hostname || parsed.hostname.length < 3) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

// POST /api/urls - Create short URL
export const createUrl = async (req, res) => {
  try {
    const { url, customAlias, title, expiresAt } = req.body;
    const userId = req.user?.id || null;

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required.' });
    }

    if (!isValidUrl(url.trim())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid URL. Must be a valid web address starting with http:// or https://' 
      });
    }

    // Guest restrictions: custom aliases and expiration require an Axly Studio account
    if (!userId) {
      if (customAlias) {
        return res.status(403).json({
          success: false,
          code: 'AUTH_REQUIRED_FOR_CUSTOM_ALIAS',
          message: 'Custom vanity aliases require an Axly Studio account. Please register or sign in to create branded links.'
        });
      }

      if (expiresAt) {
        return res.status(403).json({
          success: false,
          code: 'AUTH_REQUIRED_FOR_EXPIRATION',
          message: 'Link expiration schedules require an Axly Studio account. Please register or sign in to set link timers.'
        });
      }
    }

    // Expiration date validation
    let expiresAtValue = null;
    if (expiresAt) {
      const parsedDate = new Date(expiresAt);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid expiration date format.' });
      }
      if (parsedDate <= new Date()) {
        return res.status(400).json({ success: false, message: 'Expiration date must be in the future.' });
      }
      expiresAtValue = parsedDate;
    }

    let shortCode;
    let cleanAlias = null;

    // Validate custom alias if provided
    if (customAlias && typeof customAlias === 'string') {
      const alias = customAlias.trim().toLowerCase();
      
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(alias)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Custom alias must be 3-30 characters, letters, numbers, hyphens and underscores only.' 
        });
      }

      if (RESERVED_ALIASES.has(alias)) {
        return res.status(400).json({ 
          success: false, 
          message: 'This custom alias is reserved by the system.' 
        });
      }

      // Check for collision
      const existing = await query('SELECT id FROM urls WHERE short_code = $1', [alias]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'This custom alias is already taken.' });
      }

      shortCode = alias;
      cleanAlias = alias;
    } else {
      // Generate a collision-free code
      let attempts = 0;
      let foundUnique = false;

      while (attempts < 5) {
        const candidate = generateShortCode();
        if (RESERVED_ALIASES.has(candidate.toLowerCase())) {
          attempts++;
          continue;
        }

        const existing = await query('SELECT id FROM urls WHERE short_code = $1', [candidate]);
        if (existing.rows.length === 0) {
          shortCode = candidate;
          foundUnique = true;
          break;
        }
        attempts++;
      }

      if (!foundUnique) {
        shortCode = nanoid(8);
      }
    }

    const cleanTitle = title && typeof title === 'string' ? title.trim().slice(0, 500) : null;

    try {
      const result = await query(
        `INSERT INTO urls (short_code, original_url, title, user_id, expires_at, custom_alias)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at`,
        [shortCode, url.trim(), cleanTitle, userId, expiresAtValue, cleanAlias]
      );

      const savedUrl = result.rows[0];
      const shortUrl = `${config.SHORT_DOMAIN}/${savedUrl.short_code}`;
      const isGuest = !userId;

      res.status(201).json({
        success: true,
        message: isGuest ? 'Short URL created successfully!' : 'Short URL created and saved to your account!',
        data: {
          ...savedUrl,
          short_url: shortUrl,
          is_guest: isGuest,
          unlock_prompt: isGuest 
            ? 'Create an Axly Studio account to view real-time click analytics, manage links, and create branded vanity URLs.' 
            : null,
        }
      });
    } catch (insertErr) {
      if (insertErr.code === '23505') {
        if (cleanAlias) {
          return res.status(409).json({ success: false, message: 'This custom alias is already taken.' });
        }
        // Rare concurrent collision on generated code — retry once
        const retryCode = nanoid(8);
        const retryResult = await query(
          `INSERT INTO urls (short_code, original_url, title, user_id, expires_at, custom_alias)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at`,
          [retryCode, url.trim(), cleanTitle, userId, expiresAtValue, null]
        );
        const savedUrl = retryResult.rows[0];
        return res.status(201).json({
          success: true,
          data: {
            ...savedUrl,
            short_url: `${config.SHORT_DOMAIN}/${savedUrl.short_code}`,
          }
        });
      }
      throw insertErr;
    }
  } catch (err) {
    console.error('Create URL error:', err);
    res.status(500).json({ success: false, message: 'Server error creating short URL.' });
  }
};

// GET /api/urls - Get user's URLs
export const getUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search ? String(req.query.search).trim() : '';

    let queryText = `
      SELECT id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at, custom_alias
      FROM urls
      WHERE user_id = $1
    `;
    const params = [userId];

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (original_url ILIKE $${params.length} OR title ILIKE $${params.length} OR short_code ILIKE $${params.length})`;
    }

    // Get total count matching search
    const countQuery = search
      ? `SELECT COUNT(*) FROM urls WHERE user_id = $1 AND (original_url ILIKE $2 OR title ILIKE $2 OR short_code ILIKE $2)`
      : `SELECT COUNT(*) FROM urls WHERE user_id = $1`;
    const countResult = await query(countQuery, search ? [userId, `%${search}%`] : [userId]);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const urls = result.rows.map(url => ({
      ...url,
      short_url: `${config.SHORT_DOMAIN}/${url.short_code}`
    }));

    res.json({
      success: true,
      data: urls,
      pagination: {
        total: totalCount,
        page,
        limit,
        pages: Math.max(1, Math.ceil(totalCount / limit))
      }
    });
  } catch (err) {
    console.error('Get URLs error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching URLs.' });
  }
};

// GET /api/urls/:id - Get single URL details
export const getUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      `SELECT id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at, custom_alias
       FROM urls WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    const url = {
      ...result.rows[0],
      short_url: `${config.SHORT_DOMAIN}/${result.rows[0].short_code}`
    };

    res.json({ success: true, data: url });
  } catch (err) {
    console.error('Get URL error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/urls/:id - Partial Update URL (Fixing Expiration Update Bug)
export const updateUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, expiresAt, status } = req.body;

    // Check link exists and belongs to user
    const check = await query('SELECT id, expires_at, status, title FROM urls WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    const existing = check.rows[0];
    const updateClauses = [];
    const params = [];

    // Title
    if (title !== undefined) {
      const cleanTitle = title === null || title === '' ? null : String(title).trim().slice(0, 500);
      params.push(cleanTitle);
      updateClauses.push(`title = $${params.length}`);
    }

    // Status
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Status must be active or inactive.' 
        });
      }
      params.push(status);
      updateClauses.push(`status = $${params.length}`);
    }

    // Expiration date partial update logic
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
        // Explicit null clears expiration
        updateClauses.push(`expires_at = NULL`);
      } else {
        const parsedDate = new Date(expiresAt);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({ success: false, message: 'Invalid expiration date format.' });
        }
        if (parsedDate <= new Date()) {
          return res.status(400).json({ success: false, message: 'Expiration date must be in the future.' });
        }
        params.push(parsedDate);
        updateClauses.push(`expires_at = $${params.length}`);
      }
    }

    // If no fields to update
    if (updateClauses.length === 0) {
      return res.json({
        success: true,
        data: {
          ...existing,
          short_url: `${config.SHORT_DOMAIN}/${existing.short_code}`,
        }
      });
    }

    updateClauses.push('updated_at = NOW()');
    params.push(id, userId);

    const queryText = `
      UPDATE urls 
      SET ${updateClauses.join(', ')}
      WHERE id = $${params.length - 1} AND user_id = $${params.length}
      RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, updated_at
    `;

    const result = await query(queryText, params);

    res.json({ 
      success: true, 
      data: { ...result.rows[0], short_url: `${config.SHORT_DOMAIN}/${result.rows[0].short_code}` }
    });
  } catch (err) {
    console.error('Update URL error:', err);
    res.status(500).json({ success: false, message: 'Server error updating URL.' });
  }
};

// DELETE /api/urls/:id - Delete URL
export const deleteUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'DELETE FROM urls WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    res.json({ success: true, message: 'URL deleted successfully.' });
  } catch (err) {
    console.error('Delete URL error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting URL.' });
  }
};

// GET /api/urls/:id/qr - Generate QR code
export const getQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT short_code FROM urls WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    const shortUrl = `${config.SHORT_DOMAIN}/${result.rows[0].short_code}`;
    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    });

    res.json({ success: true, qrCode: qrDataUrl, shortUrl });
  } catch (err) {
    console.error('QR code error:', err);
    res.status(500).json({ success: false, message: 'Error generating QR code.' });
  }
};

// GET /api/urls/:id/analytics - Get click analytics
export const getAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    // Verify ownership
    const urlResult = await query(
      'SELECT id, short_code, original_url, title, click_count, unique_clicks, created_at FROM urls WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (urlResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    const url = urlResult.rows[0];
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Daily clicks
    const dailyClicks = await query(`
      SELECT DATE(clicked_at) as date, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `, [id, since]);

    // By country (honestly reporting actual recorded data or Unknown)
    const byCountry = await query(`
      SELECT COALESCE(NULLIF(country, ''), 'Unknown') as country, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY country
      ORDER BY clicks DESC
      LIMIT 10
    `, [id, since]);

    // By device
    const byDevice = await query(`
      SELECT COALESCE(NULLIF(device_type, ''), 'desktop') as device, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY device_type
      ORDER BY clicks DESC
    `, [id, since]);

    // By browser
    const byBrowser = await query(`
      SELECT COALESCE(NULLIF(browser, ''), 'Unknown') as browser, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY browser
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // By OS
    const byOs = await query(`
      SELECT COALESCE(NULLIF(os, ''), 'Unknown') as os, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY os
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // By referer
    const byReferer = await query(`
      SELECT COALESCE(NULLIF(referer, ''), 'Direct') as referer, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY referer
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    res.json({
      success: true,
      data: {
        url: { ...url, short_url: `${config.SHORT_DOMAIN}/${url.short_code}` },
        analytics: {
          totalClicks: parseInt(url.click_count, 10) || 0,
          uniqueClicks: parseInt(url.unique_clicks, 10) || 0,
          dailyClicks: dailyClicks.rows,
          byCountry: byCountry.rows,
          byDevice: byDevice.rows,
          byBrowser: byBrowser.rows,
          byOs: byOs.rows,
          byReferer: byReferer.rows,
        }
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching analytics.' });
  }
};

// GET /api/urls/stats - Overall stats for dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_urls,
        COALESCE(SUM(click_count), 0) as total_clicks,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_urls,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_this_month
      FROM urls
      WHERE user_id = $1
    `, [userId]);

    const recentClicks = await query(`
      SELECT DATE(ce.clicked_at) as date, COUNT(*) as clicks
      FROM click_events ce
      JOIN urls u ON ce.url_id = u.id
      WHERE u.user_id = $1 AND ce.clicked_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(ce.clicked_at)
      ORDER BY date ASC
    `, [userId]);

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        totalUrls: parseInt(stats.total_urls, 10) || 0,
        totalClicks: parseInt(stats.total_clicks, 10) || 0,
        activeUrls: parseInt(stats.active_urls, 10) || 0,
        newThisMonth: parseInt(stats.new_this_month, 10) || 0,
        recentClicks: recentClicks.rows
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
};
