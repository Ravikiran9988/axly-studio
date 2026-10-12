import { nanoid } from 'nanoid';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';
import { validateSafeDestinationUrl } from '../utils/ssrf.js';
import { dispatchWebhookEvent } from '../utils/webhookDispatcher.js';

const RESERVED_ALIASES = new Set([
  'api', 'auth', 'login', 'register', 'dashboard', 'links', 'analytics',
  'settings', 'health', 'docs', 'admin', 's', 'url', 'favicon', 'robots',
  'static', 'assets', 'help', 'status', 'terms', 'privacy', 'pricing', 'about',
  'campaigns', 'experiments', 'bulk', 'preview', 'unlock',
]);

const generateShortCode = () => nanoid(6);

// POST /api/urls - Create short URL (Guest or Authenticated)
export const createUrl = async (req, res) => {
  try {
    const { 
      url, customAlias, title, expiresAt, tags, notes, 
      password, isPreviewEnabled, campaignId,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent 
    } = req.body;
    const userId = req.user?.id || null;

    if (!url) {
      return res.status(400).json({ success: false, message: 'URL is required.' });
    }

    // SSRF and protocol check
    const ssrfCheck = validateSafeDestinationUrl(url);
    if (!ssrfCheck.valid) {
      return res.status(400).json({ 
        success: false, 
        message: ssrfCheck.error 
      });
    }

    // Guest restrictions: custom aliases, expiration, tags, notes, password require account
    if (!userId) {
      if (customAlias) {
        return res.status(403).json({
          success: false,
          unlock_prompt: true,
          code: 'AUTH_REQUIRED_FOR_CUSTOM_ALIAS',
          message: 'Custom vanity aliases require an Axly Studio account. Please register or sign in to create branded links.'
        });
      }

      if (expiresAt) {
        return res.status(403).json({
          success: false,
          unlock_prompt: true,
          code: 'AUTH_REQUIRED_FOR_EXPIRATION',
          message: 'Link expiration schedules require an Axly Studio account. Please register or sign in to set link timers.'
        });
      }

      if (password || (tags && tags.length > 0) || notes) {
        return res.status(403).json({
          success: false,
          unlock_prompt: true,
          code: 'AUTH_REQUIRED_FOR_ADVANCED_FEATURES',
          message: 'Advanced link features require an Axly Studio account.'
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
    const cleanNotes = notes && typeof notes === 'string' ? notes.trim().slice(0, 2000) : null;
    const cleanTags = Array.isArray(tags) ? tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10) : [];
    const passwordHash = password ? await bcrypt.hash(String(password), 10) : null;
    const previewFlag = Boolean(isPreviewEnabled);

    // Validate campaign relation if passed
    let cleanCampaignId = null;
    if (campaignId && userId) {
      const campCheck = await query('SELECT id FROM campaigns WHERE id = $1 AND user_id = $2', [campaignId, userId]);
      if (campCheck.rows.length > 0) {
        cleanCampaignId = campaignId;
      }
    }

    try {
      const result = await query(
        `INSERT INTO urls (
          short_code, original_url, title, user_id, expires_at, custom_alias,
          tags, notes, password_hash, is_preview_enabled, campaign_id,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at, tags, notes, is_preview_enabled, campaign_id`,
        [
          shortCode,
          ssrfCheck.url,
          cleanTitle,
          userId,
          expiresAtValue,
          cleanAlias,
          cleanTags,
          cleanNotes,
          passwordHash,
          previewFlag,
          cleanCampaignId,
          utmSource || null,
          utmMedium || null,
          utmCampaign || null,
          utmTerm || null,
          utmContent || null
        ]
      );

      const savedUrl = result.rows[0];
      const shortUrl = `${config.SHORT_DOMAIN}/${savedUrl.short_code}`;
      const isGuest = !userId;

      // Asynchronously dispatch link.created webhook (never blocks response)
      if (!isGuest) {
        dispatchWebhookEvent({
          event: 'link.created',
          payload: {
            id: savedUrl.id,
            shortCode: savedUrl.short_code,
            originalUrl: savedUrl.original_url,
            title: savedUrl.title,
            shortUrl,
            createdAt: savedUrl.created_at,
          },
          userId,
          workspaceId: req.workspaceId || null,
        });
      }

      res.status(201).json({
        success: true,
        message: isGuest ? 'Short URL created successfully!' : 'Short URL created and saved to your account!',
        data: {
          ...savedUrl,
          short_url: shortUrl,
          is_guest: isGuest,
          has_password: Boolean(passwordHash),
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
          `INSERT INTO urls (short_code, original_url, title, user_id, expires_at, custom_alias, tags, notes, password_hash, is_preview_enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, created_at, tags, notes, is_preview_enabled`,
          [retryCode, ssrfCheck.url, cleanTitle, userId, expiresAtValue, null, cleanTags, cleanNotes, passwordHash, previewFlag]
        );
        const savedUrl = retryResult.rows[0];
        return res.status(201).json({
          success: true,
          data: {
            ...savedUrl,
            short_url: `${config.SHORT_DOMAIN}/${savedUrl.short_code}`,
            has_password: Boolean(passwordHash),
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

// GET /api/urls - Get user's URLs with search, filtering, sorting and pagination
export const getUserUrls = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const search = req.query.search ? String(req.query.search).trim() : '';
    const statusFilter = req.query.status ? String(req.query.status).trim() : '';
    const tagFilter = req.query.tag ? String(req.query.tag).trim().toLowerCase() : '';
    const campaignFilter = req.query.campaignId ? String(req.query.campaignId).trim() : '';
    const sortBy = ['click_count', 'title', 'created_at'].includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions = ['user_id = $1'];
    const params = [userId];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(original_url ILIKE $${params.length} OR title ILIKE $${params.length} OR short_code ILIKE $${params.length} OR notes ILIKE $${params.length})`);
    }

    if (statusFilter === 'active') {
      conditions.push(`status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`);
    } else if (statusFilter === 'inactive') {
      conditions.push(`status = 'inactive'`);
    } else if (statusFilter === 'expired') {
      conditions.push(`expires_at IS NOT NULL AND expires_at <= NOW()`);
    }

    if (tagFilter) {
      params.push(tagFilter);
      conditions.push(`$${params.length} = ANY(tags)`);
    }

    if (campaignFilter) {
      params.push(campaignFilter);
      conditions.push(`campaign_id = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    // Total count query
    const countResult = await query(`SELECT COUNT(*) FROM urls WHERE ${whereClause}`, params);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    // Data query with smart rule count and experiment status
    const dataParams = [...params, limit, offset];
    const dataQuery = `
      SELECT 
        u.id, u.short_code, u.original_url, u.title, u.click_count, u.unique_clicks, 
        u.status, u.expires_at, u.created_at, u.custom_alias, u.tags, u.notes, 
        u.is_preview_enabled, u.campaign_id,
        (u.password_hash IS NOT NULL) as has_password,
        c.name as campaign_name,
        (SELECT COUNT(*)::int FROM smart_redirect_rules srr WHERE srr.url_id = u.id) as smart_rules_count,
        (SELECT COUNT(*)::int FROM experiments exp WHERE exp.url_id = u.id AND exp.status = 'active') as active_experiments_count
      FROM urls u
      LEFT JOIN campaigns c ON u.campaign_id = c.id
      WHERE ${whereClause}
      ORDER BY u.${sortBy} ${sortOrder}
      LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}
    `;

    const result = await query(dataQuery, dataParams);

    const urls = result.rows.map(url => ({
      ...url,
      short_url: `${config.SHORT_DOMAIN}/${url.short_code}`,
      is_expired: url.expires_at ? new Date(url.expires_at) <= new Date() : false,
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
      `SELECT 
        u.id, u.short_code, u.original_url, u.title, u.click_count, u.unique_clicks, 
        u.status, u.expires_at, u.created_at, u.updated_at, u.custom_alias, u.tags, u.notes, 
        u.is_preview_enabled, u.campaign_id,
        u.utm_source, u.utm_medium, u.utm_campaign, u.utm_term, u.utm_content,
        (u.password_hash IS NOT NULL) as has_password,
        c.name as campaign_name
       FROM urls u
       LEFT JOIN campaigns c ON u.campaign_id = c.id
       WHERE u.id = $1 AND u.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    const row = result.rows[0];
    const url = {
      ...row,
      short_url: `${config.SHORT_DOMAIN}/${row.short_code}`,
      is_expired: row.expires_at ? new Date(row.expires_at) <= new Date() : false,
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
    const { 
      title, originalUrl, expiresAt, status, tags, notes, 
      password, isPreviewEnabled, campaignId,
      utmSource, utmMedium, utmCampaign, utmTerm, utmContent 
    } = req.body;

    // Check link exists and belongs to user
    const check = await query('SELECT id, expires_at, status, title FROM urls WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    const existing = check.rows[0];
    const updateClauses = [];
    const params = [];

    // Destination URL update with SSRF check
    if (originalUrl !== undefined) {
      const ssrfCheck = validateSafeDestinationUrl(originalUrl);
      if (!ssrfCheck.valid) {
        return res.status(400).json({ success: false, message: ssrfCheck.error });
      }
      params.push(ssrfCheck.url);
      updateClauses.push(`original_url = $${params.length}`);
    }

    // Title
    if (title !== undefined) {
      const cleanTitle = title === null || title === '' ? null : String(title).trim().slice(0, 500);
      params.push(cleanTitle);
      updateClauses.push(`title = $${params.length}`);
    }

    // Status
    if (status !== undefined) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
      }
      params.push(status);
      updateClauses.push(`status = $${params.length}`);
    }

    // Expiration date
    if (expiresAt !== undefined) {
      if (expiresAt === null || expiresAt === '') {
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

    // Tags
    if (tags !== undefined) {
      const cleanTags = Array.isArray(tags) 
        ? tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10) 
        : [];
      params.push(cleanTags);
      updateClauses.push(`tags = $${params.length}`);
    }

    // Notes
    if (notes !== undefined) {
      params.push(notes ? String(notes).trim().slice(0, 2000) : null);
      updateClauses.push(`notes = $${params.length}`);
    }

    // Password
    if (password !== undefined) {
      if (password === null || password === '') {
        updateClauses.push(`password_hash = NULL`);
      } else {
        const hash = await bcrypt.hash(String(password), 10);
        params.push(hash);
        updateClauses.push(`password_hash = $${params.length}`);
      }
    }

    // Preview
    if (isPreviewEnabled !== undefined) {
      params.push(Boolean(isPreviewEnabled));
      updateClauses.push(`is_preview_enabled = $${params.length}`);
    }

    // Campaign
    if (campaignId !== undefined) {
      if (campaignId === null || campaignId === '') {
        updateClauses.push(`campaign_id = NULL`);
      } else {
        const campCheck = await query('SELECT id FROM campaigns WHERE id = $1 AND user_id = $2', [campaignId, userId]);
        if (campCheck.rows.length === 0) {
          return res.status(400).json({ success: false, message: 'Specified campaign does not exist.' });
        }
        params.push(campaignId);
        updateClauses.push(`campaign_id = $${params.length}`);
      }
    }

    // UTM params
    if (utmSource !== undefined) {
      params.push(utmSource ? String(utmSource).trim().slice(0, 255) : null);
      updateClauses.push(`utm_source = $${params.length}`);
    }
    if (utmMedium !== undefined) {
      params.push(utmMedium ? String(utmMedium).trim().slice(0, 255) : null);
      updateClauses.push(`utm_medium = $${params.length}`);
    }
    if (utmCampaign !== undefined) {
      params.push(utmCampaign ? String(utmCampaign).trim().slice(0, 255) : null);
      updateClauses.push(`utm_campaign = $${params.length}`);
    }
    if (utmTerm !== undefined) {
      params.push(utmTerm ? String(utmTerm).trim().slice(0, 255) : null);
      updateClauses.push(`utm_term = $${params.length}`);
    }
    if (utmContent !== undefined) {
      params.push(utmContent ? String(utmContent).trim().slice(0, 255) : null);
      updateClauses.push(`utm_content = $${params.length}`);
    }

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
      RETURNING id, short_code, original_url, title, click_count, unique_clicks, status, expires_at, updated_at, tags, notes, is_preview_enabled, campaign_id, (password_hash IS NOT NULL) as has_password
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
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    res.json({ success: true, message: 'URL deleted successfully.' });
  } catch (err) {
    console.error('Delete URL error:', err);
    res.status(500).json({ success: false, message: 'Server error deleting URL.' });
  }
};

// POST /api/urls/bulk - Bulk action on selected URLs
export const bulkUrlsAction = async (req, res) => {
  try {
    const userId = req.user.id;
    const { action, urlIds, status, tag } = req.body;

    if (!Array.isArray(urlIds) || urlIds.length === 0) {
      return res.status(400).json({ success: false, message: 'urlIds must be a non-empty array of URL IDs.' });
    }

    if (urlIds.length > 100) {
      return res.status(400).json({ success: false, message: 'Cannot perform bulk action on more than 100 URLs at once.' });
    }

    if (action === 'delete') {
      const delRes = await query(
        'DELETE FROM urls WHERE id = ANY($1) AND user_id = $2 RETURNING id',
        [urlIds, userId]
      );
      return res.json({ 
        success: true, 
        count: delRes.rowCount, 
        message: `Successfully deleted ${delRes.rowCount} links.` 
      });
    }

    if (action === 'status') {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
      }
      const updRes = await query(
        'UPDATE urls SET status = $1, updated_at = NOW() WHERE id = ANY($2) AND user_id = $3 RETURNING id',
        [status, urlIds, userId]
      );
      return res.json({ 
        success: true, 
        count: updRes.rowCount, 
        message: `Updated status for ${updRes.rowCount} links to ${status}.` 
      });
    }

    if (action === 'add_tag') {
      if (!tag || typeof tag !== 'string' || !tag.trim()) {
        return res.status(400).json({ success: false, message: 'Tag name is required.' });
      }
      const cleanTag = tag.trim().toLowerCase();
      const tagRes = await query(`
        UPDATE urls 
        SET tags = array_append(tags, $1), updated_at = NOW() 
        WHERE id = ANY($2) AND user_id = $3 AND NOT ($1 = ANY(tags))
        RETURNING id
      `, [cleanTag, urlIds, userId]);
      return res.json({ 
        success: true, 
        count: tagRes.rowCount, 
        message: `Added tag #${cleanTag} to ${tagRes.rowCount} links.` 
      });
    }

    res.status(400).json({ success: false, message: 'Invalid bulk action specified.' });
  } catch (err) {
    console.error('bulkUrlsAction error:', err);
    res.status(500).json({ success: false, message: 'Failed to perform bulk link action.' });
  }
};

// POST /api/urls/bulk-import - Batch create short links from parsed CSV rows
export const bulkImportCsv = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = req.body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ success: false, message: 'rows array is required.' });
    }

    if (rows.length > 500) {
      return res.status(400).json({ success: false, message: 'Bulk import limit is 500 rows per submission.' });
    }

    const createdUrls = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 1;
      const row = rows[i];
      const targetUrl = row.originalUrl || row.url;

      if (!targetUrl) {
        errors.push({ row: rowNum, error: 'Destination URL is missing.' });
        continue;
      }

      const ssrfCheck = validateSafeDestinationUrl(targetUrl);
      if (!ssrfCheck.valid) {
        errors.push({ row: rowNum, url: targetUrl, error: ssrfCheck.error });
        continue;
      }

      const title = row.title ? String(row.title).trim().slice(0, 500) : null;
      const tags = Array.isArray(row.tags) 
        ? row.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
        : (row.tags && typeof row.tags === 'string' ? row.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean) : []);

      let shortCode = null;
      let cleanAlias = null;

      if (row.customAlias && typeof row.customAlias === 'string') {
        const alias = row.customAlias.trim().toLowerCase();
        if (!/^[a-zA-Z0-9_-]{3,30}$/.test(alias) || RESERVED_ALIASES.has(alias)) {
          errors.push({ row: rowNum, error: `Invalid or reserved custom alias: ${alias}` });
          continue;
        }

        const collisionCheck = await query('SELECT id FROM urls WHERE short_code = $1', [alias]);
        if (collisionCheck.rows.length > 0) {
          errors.push({ row: rowNum, error: `Custom alias is already taken: ${alias}` });
          continue;
        }
        shortCode = alias;
        cleanAlias = alias;
      } else {
        shortCode = generateShortCode();
      }

      try {
        const ins = await query(`
          INSERT INTO urls (short_code, original_url, title, user_id, custom_alias, tags)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, short_code, original_url, title, status, created_at
        `, [shortCode, ssrfCheck.url, title, userId, cleanAlias, tags]);

        createdUrls.push({
          ...ins.rows[0],
          short_url: `${config.SHORT_DOMAIN}/${ins.rows[0].short_code}`
        });
      } catch (insErr) {
        errors.push({ row: rowNum, error: insErr.message });
      }
    }

    res.json({
      success: true,
      total: rows.length,
      createdCount: createdUrls.length,
      failedCount: errors.length,
      createdUrls,
      errors
    });
  } catch (err) {
    console.error('bulkImportCsv error:', err);
    res.status(500).json({ success: false, message: 'Server error processing bulk import.' });
  }
};

// GET /api/urls/export/csv - Export user links to CSV
export const exportUrlsCsv = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT short_code, original_url, title, click_count, unique_clicks, status, tags, created_at, expires_at
      FROM urls
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);

    const rows = [
      ['Short Code', 'Short URL', 'Destination URL', 'Title', 'Status', 'Total Clicks', 'Unique Clicks', 'Tags', 'Created At', 'Expires At']
    ];

    for (const u of result.rows) {
      rows.push([
        u.short_code,
        `${config.SHORT_DOMAIN}/${u.short_code}`,
        `"${u.original_url.replace(/"/g, '""')}"`,
        `"${(u.title || '').replace(/"/g, '""')}"`,
        u.status,
        u.click_count,
        u.unique_clicks,
        `"${(u.tags || []).join(';')}"`,
        new Date(u.created_at).toISOString(),
        u.expires_at ? new Date(u.expires_at).toISOString() : '',
      ]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="axly-links-export.csv"');
    res.send(csvContent);
  } catch (err) {
    console.error('exportUrlsCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to export URLs to CSV.' });
  }
};

// GET /api/urls/:id/qr - Generate QR code (PNG or SVG)
export const getQrCode = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const format = req.query.format === 'svg' ? 'svg' : 'png';

    const result = await query(
      'SELECT short_code FROM urls WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found or unauthorized.' });
    }

    const shortUrl = `${config.SHORT_DOMAIN}/${result.rows[0].short_code}`;

    if (format === 'svg') {
      const qrSvg = await QRCode.toString(shortUrl, { type: 'svg', margin: 2 });
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(qrSvg);
    }

    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 320,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' }
    });

    res.json({ success: true, qrCode: qrDataUrl, shortUrl });
  } catch (err) {
    console.error('QR code error:', err);
    res.status(500).json({ success: false, message: 'Error generating QR code.' });
  }
};

// GET /api/urls/:id/analytics - Get click analytics for link
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

    // Daily clicks & unique visitors
    const dailyClicks = await query(`
      SELECT 
        DATE(clicked_at) as date, 
        COUNT(*)::bigint as clicks,
        COUNT(DISTINCT visitor_hash)::bigint as unique_visitors
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY DATE(clicked_at)
      ORDER BY date ASC
    `, [id, since]);

    // Country breakdown (honestly reported)
    const byCountry = await query(`
      SELECT COALESCE(NULLIF(country, ''), 'Unknown') as country, COUNT(*)::bigint as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY country
      ORDER BY clicks DESC
      LIMIT 10
    `, [id, since]);

    // Device breakdown
    const byDevice = await query(`
      SELECT COALESCE(NULLIF(device_type, ''), 'desktop') as device, COUNT(*)::bigint as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY device_type
      ORDER BY clicks DESC
    `, [id, since]);

    // Browser breakdown
    const byBrowser = await query(`
      SELECT COALESCE(NULLIF(browser, ''), 'Unknown') as browser, COUNT(*)::bigint as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY browser
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // OS breakdown
    const byOs = await query(`
      SELECT COALESCE(NULLIF(os, ''), 'Unknown') as os, COUNT(*)::bigint as clicks
      FROM click_events
      WHERE url_id = $1 AND clicked_at >= $2
      GROUP BY os
      ORDER BY clicks DESC
      LIMIT 8
    `, [id, since]);

    // Referrer breakdown
    const byReferer = await query(`
      SELECT COALESCE(NULLIF(referer, ''), 'Direct / Unknown') as referer, COUNT(*)::bigint as clicks
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
