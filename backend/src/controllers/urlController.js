import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import { query } from '../db/pool.js';

const SHORT_DOMAIN = process.env.SHORT_DOMAIN || 'http://localhost:5000';

const generateShortCode = () => nanoid(6);

const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
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

    if (!isValidUrl(url)) {
      return res.status(400).json({ success: false, message: 'Invalid URL. Must start with http:// or https://' });
    }

    let shortCode = customAlias ? customAlias.trim().toLowerCase() : generateShortCode();

    // Validate custom alias
    if (customAlias) {
      if (!/^[a-zA-Z0-9_-]{3,30}$/.test(shortCode)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Custom alias must be 3-30 characters, letters, numbers, hyphens and underscores only.' 
        });
      }

      const existing = await query('SELECT id FROM urls WHERE short_code = $1', [shortCode]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ success: false, message: 'This custom alias is already taken.' });
      }
    } else {
      // Ensure uniqueness for generated codes
      let attempts = 0;
      while (attempts < 5) {
        const existing = await query('SELECT id FROM urls WHERE short_code = $1', [shortCode]);
        if (existing.rows.length === 0) break;
        shortCode = generateShortCode();
        attempts++;
      }
    }

    const expiresAtValue = expiresAt ? new Date(expiresAt) : null;

    const result = await query(
      `INSERT INTO urls (short_code, original_url, title, user_id, expires_at, custom_alias)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, short_code, original_url, title, click_count, status, expires_at, created_at`,
      [shortCode, url, title || null, userId, expiresAtValue, customAlias ? shortCode : null]
    );

    const savedUrl = result.rows[0];
    const shortUrl = `${SHORT_DOMAIN}/${savedUrl.short_code}`;

    res.status(201).json({
      success: true,
      data: {
        ...savedUrl,
        short_url: shortUrl,
      }
    });
  } catch (err) {
    console.error('Create URL error:', err);
    res.status(500).json({ success: false, message: 'Server error creating short URL.' });
  }
};

// GET /api/urls - Get user's URLs
export const getUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let queryText = `
      SELECT id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at, custom_alias
      FROM urls
      WHERE user_id = $1
    `;
    const params = [userId];

    if (search) {
      queryText += ` AND (original_url ILIKE $${params.length + 1} OR title ILIKE $${params.length + 1} OR short_code ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) FROM urls WHERE user_id = $1',
      [userId]
    );

    const urls = result.rows.map(url => ({
      ...url,
      short_url: `${SHORT_DOMAIN}/${url.short_code}`
    }));

    res.json({
      success: true,
      data: urls,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
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
      short_url: `${SHORT_DOMAIN}/${result.rows[0].short_code}`
    };

    res.json({ success: true, data: url });
  } catch (err) {
    console.error('Get URL error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/urls/:id - Update URL
export const updateUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, expiresAt, status } = req.body;

    const result = await query(
      `UPDATE urls SET title = COALESCE($1, title), expires_at = $2, status = COALESCE($3, status), updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, short_code, original_url, title, click_count, status, expires_at, updated_at`,
      [title, expiresAt ? new Date(expiresAt) : null, status, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    res.json({ 
      success: true, 
      data: { ...result.rows[0], short_url: `${SHORT_DOMAIN}/${result.rows[0].short_code}` }
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

    const shortUrl = `${SHORT_DOMAIN}/${result.rows[0].short_code}`;
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
    const { days = 30 } = req.query;

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
    since.setDate(since.getDate() - parseInt(days));

    // Daily clicks
    const dailyClicks = await query(`
      SELECT DATE(clicked_at) as date, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `, [id, since]);

    // By country
    const byCountry = await query(`
      SELECT COALESCE(country, 'Unknown') as country, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY country
      ORDER BY clicks DESC
      LIMIT 10
    `, [id, since]);

    // By device
    const byDevice = await query(`
      SELECT COALESCE(device_type, 'Unknown') as device, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY device_type
      ORDER BY clicks DESC
    `, [id, since]);

    // By browser
    const byBrowser = await query(`
      SELECT COALESCE(browser, 'Unknown') as browser, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY browser
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // By OS
    const byOs = await query(`
      SELECT COALESCE(os, 'Unknown') as os, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY os
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // By referer
    const byReferer = await query(`
      SELECT COALESCE(referer, 'Direct') as referer, COUNT(*) as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY referer
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    res.json({
      success: true,
      data: {
        url: { ...url, short_url: `${SHORT_DOMAIN}/${url.short_code}` },
        analytics: {
          totalClicks: parseInt(url.click_count),
          uniqueClicks: parseInt(url.unique_clicks),
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
        SUM(click_count) as total_clicks,
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
        totalUrls: parseInt(stats.total_urls) || 0,
        totalClicks: parseInt(stats.total_clicks) || 0,
        activeUrls: parseInt(stats.active_urls) || 0,
        newThisMonth: parseInt(stats.new_this_month) || 0,
        recentClicks: recentClicks.rows
      }
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ success: false, message: 'Server error fetching stats.' });
  }
};
