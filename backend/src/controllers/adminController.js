import { query } from '../db/pool.js';

/**
 * GET /api/admin/stats
 * System-wide overview and metrics
 */
export const getAdminStats = async (req, res) => {
  try {
    const [usersCount, urlsCount, clicksSum, activeLinks] = await Promise.all([
      query('SELECT COUNT(*)::int as count FROM users'),
      query('SELECT COUNT(*)::int as count FROM urls'),
      query('SELECT COALESCE(SUM(click_count), 0)::bigint as total_clicks, COALESCE(SUM(unique_clicks), 0)::bigint as unique_clicks FROM urls'),
      query("SELECT COUNT(*)::int as count FROM urls WHERE status = 'active'"),
    ]);

    // Role breakdown
    const roleStats = await query(`
      SELECT role, COUNT(*)::int as count 
      FROM users 
      GROUP BY role
    `);

    // Top 5 performing links across the platform
    const topUrls = await query(`
      SELECT u.id, u.short_code, u.original_url, u.title, u.click_count, u.unique_clicks,
             usr.name as owner_name, usr.email as owner_email
      FROM urls u
      JOIN users usr ON u.user_id = usr.id
      ORDER BY u.click_count DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        totalUsers: usersCount.rows[0].count,
        totalUrls: urlsCount.rows[0].count,
        activeUrls: activeLinks.rows[0].count,
        totalClicks: Number(clicksSum.rows[0].total_clicks),
        uniqueClicks: Number(clicksSum.rows[0].unique_clicks),
        roles: roleStats.rows,
        topUrls: topUrls.rows,
      }
    });
  } catch (err) {
    console.error('getAdminStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load system metrics.' });
  }
};

/**
 * GET /api/admin/users
 * List all users with their link counts and click metrics
 */
export const getAdminUsers = async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

    let sql = `
      SELECT 
        u.id, u.name, u.email, u.role, u.plan, u.is_active, u.created_at,
        COUNT(DISTINCT urls.id)::int as links_count,
        COALESCE(SUM(urls.click_count), 0)::bigint as total_clicks
      FROM users u
      LEFT JOIN urls ON u.id = urls.user_id
    `;
    const params = [];

    if (search) {
      sql += ` WHERE LOWER(u.name) LIKE $1 OR LOWER(u.email) LIKE $1`;
      params.push(search);
    }

    sql += ` GROUP BY u.id ORDER BY u.created_at DESC`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows.map(user => ({
        ...user,
        total_clicks: Number(user.total_clicks),
      }))
    });
  } catch (err) {
    console.error('getAdminUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Promote or demote user role ('admin' <-> 'user')
 */
export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid role. Role must be 'user' or 'admin'." 
      });
    }

    // Safety: prevent self-demoting from admin
    if (req.user.id === id && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot revoke your own administrator privileges.' 
      });
    }

    const result = await query(
      `UPDATE users 
       SET role = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, name, email, role, plan, is_active`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: `User role updated to ${role}.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Enable or disable user account (is_active)
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'isActive must be a boolean (true or false).' 
      });
    }

    // Safety: prevent disabling self
    if (req.user.id === id && !isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot disable your own administrator account.' 
      });
    }

    const result = await query(
      `UPDATE users 
       SET is_active = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, name, email, role, plan, is_active`,
      [isActive, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({
      success: true,
      message: `User account ${isActive ? 'activated' : 'suspended'}.`,
      data: result.rows[0]
    });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

/**
 * GET /api/admin/urls
 * View all URLs across the entire system
 */
export const getAdminUrls = async (req, res) => {
  try {
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

    let sql = `
      SELECT 
        u.id, u.short_code, u.original_url, u.custom_alias, u.title,
        u.click_count, u.unique_clicks, u.status, u.expires_at, u.created_at,
        usr.id as user_id, usr.name as owner_name, usr.email as owner_email
      FROM urls u
      JOIN users usr ON u.user_id = usr.id
    `;
    const params = [];

    if (search) {
      sql += ` WHERE LOWER(u.short_code) LIKE $1 
               OR LOWER(u.original_url) LIKE $1 
               OR LOWER(usr.email) LIKE $1 
               OR LOWER(u.title) LIKE $1`;
      params.push(search);
    }

    sql += ` ORDER BY u.created_at DESC LIMIT 100`;

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows.map(item => ({
        ...item,
        click_count: Number(item.click_count),
        unique_clicks: Number(item.unique_clicks),
      }))
    });
  } catch (err) {
    console.error('getAdminUrls error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve system URLs.' });
  }
};

/**
 * DELETE /api/admin/urls/:id
 * Delete any URL system-wide
 */
export const deleteAdminUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM urls WHERE id = $1 RETURNING id, short_code',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    res.json({
      success: true,
      message: `Short URL /${result.rows[0].short_code} removed successfully.`
    });
  } catch (err) {
    console.error('deleteAdminUrl error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete URL.' });
  }
};
