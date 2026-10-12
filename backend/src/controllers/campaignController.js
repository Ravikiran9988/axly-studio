import { query } from '../db/pool.js';
import { config } from '../config/env.js';

// GET /api/campaigns - List campaigns for user with aggregate metrics
export const getCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        c.id, c.name, c.description, c.utm_source, c.utm_medium, c.utm_campaign, c.utm_term, c.utm_content,
        c.created_at, c.updated_at,
        COUNT(u.id)::int as link_count,
        COALESCE(SUM(u.click_count), 0)::bigint as total_clicks,
        COALESCE(SUM(u.unique_clicks), 0)::bigint as unique_clicks
      FROM campaigns c
      LEFT JOIN urls u ON c.id = u.campaign_id
      WHERE c.user_id = $1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [userId]);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getCampaigns error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve campaigns.' });
  }
};

// POST /api/campaigns - Create new campaign
export const createCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Campaign name is required.' });
    }

    const result = await query(`
      INSERT INTO campaigns (user_id, name, description, utm_source, utm_medium, utm_campaign, utm_term, utm_content)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      userId,
      name.trim().slice(0, 255),
      description ? String(description).trim().slice(0, 1000) : null,
      utmSource ? String(utmSource).trim().slice(0, 255) : null,
      utmMedium ? String(utmMedium).trim().slice(0, 255) : null,
      utmCampaign ? String(utmCampaign).trim().slice(0, 255) : null,
      utmTerm ? String(utmTerm).trim().slice(0, 255) : null,
      utmContent ? String(utmContent).trim().slice(0, 255) : null,
    ]);

    res.status(201).json({
      success: true,
      message: 'Campaign created successfully.',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('createCampaign error:', err);
    res.status(500).json({ success: false, message: 'Failed to create campaign.' });
  }
};

// GET /api/campaigns/:id - Get campaign details & associated URLs
export const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const campRes = await query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (campRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const campaign = campRes.rows[0];

    // Fetch associated links
    const urlsRes = await query(`
      SELECT id, short_code, original_url, title, click_count, unique_clicks, status, created_at
      FROM urls 
      WHERE campaign_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `, [id, userId]);

    const urls = urlsRes.rows.map(u => ({
      ...u,
      short_url: `${config.SHORT_DOMAIN}/${u.short_code}`,
    }));

    // Aggregate click stats
    const totalClicks = urls.reduce((acc, u) => acc + Number(u.click_count || 0), 0);
    const uniqueClicks = urls.reduce((acc, u) => acc + Number(u.unique_clicks || 0), 0);

    res.json({
      success: true,
      data: {
        ...campaign,
        total_clicks: totalClicks,
        unique_clicks: uniqueClicks,
        links: urls,
      }
    });
  } catch (err) {
    console.error('getCampaignById error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve campaign details.' });
  }
};

// PATCH /api/campaigns/:id - Update campaign
export const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, description, utmSource, utmMedium, utmCampaign, utmTerm, utmContent } = req.body;

    const check = await query('SELECT id FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId]);
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) {
      params.push(String(name).trim().slice(0, 255));
      updates.push(`name = $${params.length}`);
    }

    if (description !== undefined) {
      params.push(description ? String(description).trim().slice(0, 1000) : null);
      updates.push(`description = $${params.length}`);
    }

    if (utmSource !== undefined) {
      params.push(utmSource ? String(utmSource).trim().slice(0, 255) : null);
      updates.push(`utm_source = $${params.length}`);
    }

    if (utmMedium !== undefined) {
      params.push(utmMedium ? String(utmMedium).trim().slice(0, 255) : null);
      updates.push(`utm_medium = $${params.length}`);
    }

    if (utmCampaign !== undefined) {
      params.push(utmCampaign ? String(utmCampaign).trim().slice(0, 255) : null);
      updates.push(`utm_campaign = $${params.length}`);
    }

    if (utmTerm !== undefined) {
      params.push(utmTerm ? String(utmTerm).trim().slice(0, 255) : null);
      updates.push(`utm_term = $${params.length}`);
    }

    if (utmContent !== undefined) {
      params.push(utmContent ? String(utmContent).trim().slice(0, 255) : null);
      updates.push(`utm_content = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: 'No changes provided.' });
    }

    updates.push('updated_at = NOW()');
    params.push(id, userId);

    const result = await query(`
      UPDATE campaigns 
      SET ${updates.join(', ')} 
      WHERE id = $${params.length - 1} AND user_id = $${params.length} 
      RETURNING *
    `, params);

    res.json({ success: true, message: 'Campaign updated successfully.', data: result.rows[0] });
  } catch (err) {
    console.error('updateCampaign error:', err);
    res.status(500).json({ success: false, message: 'Failed to update campaign.' });
  }
};

// DELETE /api/campaigns/:id - Delete campaign
export const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await query(
      'DELETE FROM campaigns WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    res.json({ success: true, message: 'Campaign deleted successfully.' });
  } catch (err) {
    console.error('deleteCampaign error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete campaign.' });
  }
};

// GET /api/campaigns/:id/export/csv - Export campaign performance report
export const exportCampaignCsv = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const campRes = await query('SELECT * FROM campaigns WHERE id = $1 AND user_id = $2', [id, userId]);
    if (campRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Campaign not found.' });
    }

    const campaign = campRes.rows[0];

    const urlsRes = await query(`
      SELECT short_code, original_url, title, click_count, unique_clicks, status, created_at
      FROM urls 
      WHERE campaign_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `, [id, userId]);

    const rows = [
      ['Short Code', 'Short URL', 'Destination URL', 'Title', 'Status', 'Total Clicks', 'Unique Clicks', 'Created At']
    ];

    for (const u of urlsRes.rows) {
      rows.push([
        u.short_code,
        `${config.SHORT_DOMAIN}/${u.short_code}`,
        `"${u.original_url.replace(/"/g, '""')}"`,
        `"${(u.title || '').replace(/"/g, '""')}"`,
        u.status,
        u.click_count,
        u.unique_clicks,
        new Date(u.created_at).toISOString(),
      ]);
    }

    const csvContent = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${campaign.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.csv"`);
    res.send(csvContent);
  } catch (err) {
    console.error('exportCampaignCsv error:', err);
    res.status(500).json({ success: false, message: 'Failed to export campaign report.' });
  }
};
