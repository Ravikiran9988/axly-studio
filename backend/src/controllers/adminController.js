import { query } from '../db/pool.js';
import { logAuditEvent } from '../utils/audit.js';
import { checkUrlHealth, recordLinkHealthCheck } from '../utils/healthChecker.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

/**
 * GET /api/admin/stats
 * Real, database-backed operational and platform metrics
 */
export const getAdminStats = async (req, res) => {
  try {
    const now = new Date();
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

    const [
      usersStatsRes,
      urlsStatsRes,
      clicksSumRes,
      clicks24hRes,
      clicks7dRes,
      reportsStatsRes,
      healthStatsRes,
      topUrlsRes,
    ] = await Promise.all([
      // Users Breakdown
      query(`
        SELECT 
          COUNT(*)::int as total_users,
          COUNT(CASE WHEN is_active = true THEN 1 END)::int as active_users,
          COUNT(CASE WHEN is_active = false THEN 1 END)::int as suspended_users,
          COUNT(CASE WHEN role = 'admin' AND is_active = true THEN 1 END)::int as admin_users
        FROM users
      `),
      // URLs Breakdown (including guest links where user_id IS NULL)
      query(`
        SELECT 
          COUNT(*)::int as total_urls,
          COUNT(CASE WHEN status = 'active' THEN 1 END)::int as active_urls,
          COUNT(CASE WHEN status = 'inactive' THEN 1 END)::int as disabled_urls,
          COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END)::int as expired_urls,
          COUNT(CASE WHEN user_id IS NULL THEN 1 END)::int as guest_urls
        FROM urls
      `),
      // Lifetime Clicks & Unique Visitors
      query(`
        SELECT 
          COALESCE(SUM(click_count), 0)::bigint as total_clicks, 
          COALESCE(SUM(unique_clicks), 0)::bigint as unique_clicks 
        FROM urls
      `),
      // Clicks in last 24h
      query(`
        SELECT COUNT(id)::bigint as count 
        FROM click_events 
        WHERE clicked_at >= $1
      `, [oneDayAgo]),
      // Clicks in last 7d
      query(`
        SELECT COUNT(id)::bigint as count 
        FROM click_events 
        WHERE clicked_at >= $1
      `, [sevenDaysAgo]),
      // Link Reports & Moderation Queue
      query(`
        SELECT 
          COUNT(CASE WHEN status = 'pending' THEN 1 END)::int as pending_reports,
          COUNT(CASE WHEN status = 'reviewing' THEN 1 END)::int as reviewing_reports,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END)::int as resolved_reports
        FROM link_reports
      `),
      // Link Health Status
      query(`
        SELECT 
          COUNT(CASE WHEN health_status = 'healthy' THEN 1 END)::int as healthy_links,
          COUNT(CASE WHEN health_status = 'degraded' THEN 1 END)::int as degraded_links,
          COUNT(CASE WHEN health_status = 'unreachable' THEN 1 END)::int as unreachable_links
        FROM urls
      `),
      // Top 5 performing links across the platform
      query(`
        SELECT u.id, u.short_code, u.original_url, u.title, u.click_count, u.unique_clicks,
               COALESCE(usr.name, 'Guest') as owner_name, 
               COALESCE(usr.email, 'Public Guest') as owner_email
        FROM urls u
        LEFT JOIN users usr ON u.user_id = usr.id
        ORDER BY u.click_count DESC
        LIMIT 5
      `),
    ]);

    const usersStats = usersStatsRes.rows[0];
    const urlsStats = urlsStatsRes.rows[0];
    const clicksSum = clicksSumRes.rows[0];
    const reportsStats = reportsStatsRes.rows[0];
    const healthStats = healthStatsRes.rows[0];

    // Node & Service Telemetry
    const memory = process.memoryUsage();
    const telemetry = {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      rssMemoryMb: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      databaseStatus: 'operational',
      environment: process.env.NODE_ENV || 'development',
    };

    res.json({
      success: true,
      data: {
        totalUsers: usersStats.total_users,
        activeUsers: usersStats.active_users,
        suspendedUsers: usersStats.suspended_users,
        adminUsers: usersStats.admin_users,

        totalUrls: urlsStats.total_urls,
        activeUrls: urlsStats.active_urls,
        disabledUrls: urlsStats.disabled_urls,
        expiredUrls: urlsStats.expired_urls,
        guestUrls: urlsStats.guest_urls,

        totalClicks: Number(clicksSum.total_clicks),
        uniqueClicks: Number(clicksSum.unique_clicks),
        clicks24h: Number(clicks24hRes.rows[0].count),
        clicks7d: Number(clicks7dRes.rows[0].count),

        pendingReports: reportsStats.pending_reports,
        reviewingReports: reportsStats.reviewing_reports,
        resolvedReports: reportsStats.resolved_reports,

        healthyLinks: healthStats.healthy_links,
        degradedLinks: healthStats.degraded_links,
        unreachableLinks: healthStats.unreachable_links,

        topUrls: topUrlsRes.rows,
        telemetry,
      }
    });
  } catch (err) {
    console.error('getAdminStats error:', err);
    res.status(500).json({ success: false, message: 'Failed to load system metrics.' });
  }
};

/**
 * GET /api/admin/users
 * Paginated user directory with search, filtering, and usage metrics
 */
export const getAdminUsers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;
    const roleFilter = req.query.role && ['user', 'admin'].includes(req.query.role) ? req.query.role : null;
    const statusFilter = req.query.status === 'active' ? true : req.query.status === 'suspended' ? false : null;

    let whereConditions = [];
    let params = [];

    if (search) {
      params.push(search);
      whereConditions.push(`(LOWER(u.name) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
    }

    if (roleFilter) {
      params.push(roleFilter);
      whereConditions.push(`u.role = $${params.length}`);
    }

    if (statusFilter !== null) {
      params.push(statusFilter);
      whereConditions.push(`u.is_active = $${params.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count total matching users
    const countQuery = `SELECT COUNT(*)::int as total FROM users u ${whereClause}`;
    const countRes = await query(countQuery, params);
    const total = countRes.rows[0].total;

    // Fetch paginated records with link and click metrics
    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        u.id, u.name, u.email, u.role, u.plan, u.is_active, 
        u.suspended_at, u.suspended_reason, u.last_login_at, u.created_at,
        COUNT(DISTINCT urls.id)::int as links_count,
        COALESCE(SUM(urls.click_count), 0)::bigint as total_clicks
      FROM users u
      LEFT JOIN urls ON u.id = urls.user_id
      ${whereClause}
      GROUP BY u.id 
      ORDER BY u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows.map(user => ({
        ...user,
        total_clicks: Number(user.total_clicks),
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    });
  } catch (err) {
    console.error('getAdminUsers error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve users.' });
  }
};

/**
 * PATCH /api/admin/users/:id/role
 * Promote or demote user role with last-admin lockout prevention
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

    // Safety 1: Prevent self-demotion
    if (req.user.id === id && role !== 'admin') {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot revoke your own administrator privileges.' 
      });
    }

    // Safety 2: Prevent demoting the last active administrator
    if (role !== 'admin') {
      const activeAdminsCountRes = await query(
        "SELECT COUNT(*)::int as count FROM users WHERE role = 'admin' AND is_active = true"
      );
      const targetUserRes = await query('SELECT role, is_active, email FROM users WHERE id = $1', [id]);
      
      if (targetUserRes.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (targetUserRes.rows[0].role === 'admin' && activeAdminsCountRes.rows[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Operation rejected: Cannot demote the last active administrator on the platform.',
        });
      }
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

    const updatedUser = result.rows[0];

    // Log to audit trail
    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'user.role_change',
      targetType: 'user',
      targetId: id,
      details: { targetEmail: updatedUser.email, newRole: role },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `User role updated to ${role}.`,
      data: updatedUser,
    });
  } catch (err) {
    console.error('updateUserRole error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user role.' });
  }
};

/**
 * PATCH /api/admin/users/:id/status
 * Suspend or reactivate user account with last-admin lockout prevention and session invalidation
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive, reason } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ 
        success: false, 
        message: 'isActive must be a boolean (true or false).' 
      });
    }

    // Safety 1: Prevent disabling self
    if (req.user.id === id && !isActive) {
      return res.status(400).json({ 
        success: false, 
        message: 'You cannot disable your own administrator account.' 
      });
    }

    // Safety 2: Prevent suspending the last active administrator
    if (!isActive) {
      const activeAdminsRes = await query(
        "SELECT COUNT(*)::int as count FROM users WHERE role = 'admin' AND is_active = true"
      );
      const targetUser = await query('SELECT role, email FROM users WHERE id = $1', [id]);
      
      if (targetUser.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      if (targetUser.rows[0].role === 'admin' && activeAdminsRes.rows[0].count <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Operation rejected: Cannot suspend the last active administrator on the platform.',
        });
      }
    }

    // When suspending: set suspended_at, reason, and increment token_version to immediately revoke all JWT sessions
    const result = await query(
      `UPDATE users 
       SET 
         is_active = $1, 
         suspended_at = CASE WHEN $1 = false THEN NOW() ELSE NULL END,
         suspended_reason = CASE WHEN $1 = false THEN $3 ELSE NULL END,
         token_version = token_version + 1,
         updated_at = NOW() 
       WHERE id = $2 
       RETURNING id, name, email, role, plan, is_active, suspended_at, suspended_reason`,
      [isActive, id, reason ? String(reason).trim().slice(0, 500) : 'Administrative suspension']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedUser = result.rows[0];

    // Log to audit trail
    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: isActive ? 'user.reactivate' : 'user.suspend',
      targetType: 'user',
      targetId: id,
      details: { targetEmail: updatedUser.email, reason: updatedUser.suspended_reason },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `User account ${isActive ? 'reactivated' : 'suspended and sessions revoked'}.`,
      data: updatedUser,
    });
  } catch (err) {
    console.error('updateUserStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
};

/**
 * POST /api/admin/users/:id/revoke-sessions
 * Invalidate all existing tokens for a user
 */
export const revokeUserSessions = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE users SET token_version = token_version + 1, updated_at = NOW() WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'user.sessions_revoked',
      targetType: 'user',
      targetId: id,
      details: { targetEmail: result.rows[0].email },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'All active sessions for this user have been invalidated.',
    });
  } catch (err) {
    console.error('revokeUserSessions error:', err);
    res.status(500).json({ success: false, message: 'Failed to revoke sessions.' });
  }
};

/**
 * GET /api/admin/users/:id/activity
 * View user account detail, owned links, and any associated abuse reports
 */
export const getUserActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await query(
      'SELECT id, name, email, role, plan, is_active, suspended_at, suspended_reason, last_login_at, created_at FROM users WHERE id = $1',
      [id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const [linksRes, reportsRes] = await Promise.all([
      query('SELECT id, short_code, original_url, title, click_count, status, created_at FROM urls WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20', [id]),
      query('SELECT r.id, r.short_code, r.reason, r.status, r.created_at FROM link_reports r JOIN urls u ON r.url_id = u.id WHERE u.user_id = $1 ORDER BY r.created_at DESC LIMIT 10', [id]),
    ]);

    res.json({
      success: true,
      data: {
        user: userRes.rows[0],
        recentLinks: linksRes.rows,
        abuseReports: reportsRes.rows,
      }
    });
  } catch (err) {
    console.error('getUserActivity error:', err);
    res.status(500).json({ success: false, message: 'Failed to load user activity.' });
  }
};

/**
 * GET /api/admin/urls
 * View all URLs system-wide (paginated)
 */
export const getAdminUrls = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;
    const status = req.query.status && ['active', 'inactive'].includes(req.query.status) ? req.query.status : null;

    let whereConditions = [];
    let params = [];

    if (search) {
      params.push(search);
      whereConditions.push(`(
        LOWER(u.short_code) LIKE $${params.length} 
        OR LOWER(u.original_url) LIKE $${params.length} 
        OR LOWER(COALESCE(usr.email, '')) LIKE $${params.length} 
        OR LOWER(COALESCE(u.title, '')) LIKE $${params.length}
      )`);
    }

    if (status) {
      params.push(status);
      whereConditions.push(`u.status = $${params.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT COUNT(*)::int as total 
      FROM urls u 
      LEFT JOIN users usr ON u.user_id = usr.id 
      ${whereClause}
    `, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        u.id, u.short_code, u.original_url, u.custom_alias, u.title,
        u.click_count, u.unique_clicks, u.status, u.expires_at, 
        u.moderation_status, u.health_status, u.health_status_code, u.created_at,
        usr.id as user_id, usr.name as owner_name, usr.email as owner_email
      FROM urls u
      LEFT JOIN users usr ON u.user_id = usr.id
      ${whereClause}
      ORDER BY u.created_at DESC 
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows.map(item => ({
        ...item,
        click_count: Number(item.click_count),
        unique_clicks: Number(item.unique_clicks),
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    });
  } catch (err) {
    console.error('getAdminUrls error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve system URLs.' });
  }
};

/**
 * DELETE /api/admin/urls/:id
 * Delete any URL system-wide with audit trail
 */
export const deleteAdminUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM urls WHERE id = $1 RETURNING id, short_code, original_url',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'URL not found.' });
    }

    const deleted = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'link.delete',
      targetType: 'url',
      targetId: id,
      details: { shortCode: deleted.short_code, destination: deleted.original_url },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Short URL /${deleted.short_code} permanently removed.`
    });
  } catch (err) {
    console.error('deleteAdminUrl error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete URL.' });
  }
};

/**
 * GET /api/admin/moderation/reports
 * Paginated moderation reports queue
 */
export const getModerationReports = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const status = req.query.status && ['pending', 'reviewing', 'resolved', 'dismissed'].includes(req.query.status)
      ? req.query.status : null;
    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;

    let whereConditions = [];
    let params = [];

    if (status) {
      params.push(status);
      whereConditions.push(`r.status = $${params.length}`);
    }

    if (search) {
      params.push(search);
      whereConditions.push(`(LOWER(r.short_code) LIKE $${params.length} OR LOWER(u.original_url) LIKE $${params.length})`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT COUNT(*)::int as total 
      FROM link_reports r 
      JOIN urls u ON r.url_id = u.id 
      ${whereClause}
    `, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        r.id, r.url_id, r.short_code, r.reason, r.details, r.status,
        r.reviewer_notes, r.resolved_at, r.created_at,
        u.original_url, u.status as link_status, u.moderation_status,
        rev.email as reviewer_email
      FROM link_reports r
      JOIN urls u ON r.url_id = u.id
      LEFT JOIN users rev ON r.reviewer_id = rev.id
      ${whereClause}
      ORDER BY 
        CASE WHEN r.status = 'pending' THEN 1 WHEN r.status = 'reviewing' THEN 2 ELSE 3 END,
        r.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    });
  } catch (err) {
    console.error('getModerationReports error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve moderation queue.' });
  }
};

/**
 * PATCH /api/admin/moderation/reports/:id
 * Review, resolve or dismiss a report
 */
export const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['reviewing', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Status must be reviewing, resolved, or dismissed.' 
      });
    }

    const result = await query(`
      UPDATE link_reports 
      SET 
        status = $1, 
        reviewer_id = $2, 
        reviewer_notes = COALESCE($3, reviewer_notes),
        resolved_at = CASE WHEN $1 IN ('resolved', 'dismissed') THEN NOW() ELSE resolved_at END,
        updated_at = NOW()
      WHERE id = $4 
      RETURNING id, short_code, status, reviewer_notes, resolved_at
    `, [status, req.user.id, notes ? String(notes).trim() : null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const updated = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `report.${status}`,
      targetType: 'report',
      targetId: id,
      details: { shortCode: updated.short_code, notes },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Report status updated to ${status}.`,
      data: updated,
    });
  } catch (err) {
    console.error('updateReportStatus error:', err);
    res.status(500).json({ success: false, message: 'Failed to update report.' });
  }
};

/**
 * PATCH /api/admin/urls/:id/moderation
 * Moderate URL status (approve, suspend, or disable link)
 */
export const moderateUrl = async (req, res) => {
  try {
    const { id } = req.params;
    const { moderationStatus, linkStatus, reason } = req.body;

    if (moderationStatus && !['approved', 'flagged', 'suspended', 'under_review'].includes(moderationStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid moderation status.' });
    }

    if (linkStatus && !['active', 'inactive'].includes(linkStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid link status.' });
    }

    const result = await query(`
      UPDATE urls 
      SET 
        moderation_status = COALESCE($1, moderation_status),
        status = COALESCE($2, status),
        moderation_reason = COALESCE($3, moderation_reason),
        moderated_at = NOW(),
        moderator_id = $4,
        updated_at = NOW()
      WHERE id = $5 
      RETURNING id, short_code, original_url, status, moderation_status, moderation_reason
    `, [
      moderationStatus || null,
      linkStatus || null,
      reason ? String(reason).trim() : null,
      req.user.id,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found.' });
    }

    const updated = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'link.moderation_action',
      targetType: 'url',
      targetId: id,
      details: {
        shortCode: updated.short_code,
        moderationStatus: updated.moderation_status,
        linkStatus: updated.status,
        reason,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Link moderation state updated.`,
      data: updated,
    });
  } catch (err) {
    console.error('moderateUrl error:', err);
    res.status(500).json({ success: false, message: 'Failed to moderate link.' });
  }
};

/**
 * GET /api/admin/health
 * Operational overview of link health status & recent checks
 */
export const getHealthOverview = async (req, res) => {
  try {
    const [countsRes, recentChecksRes, failingLinksRes] = await Promise.all([
      query(`
        SELECT 
          COUNT(*)::int as total_monitored,
          COUNT(CASE WHEN health_status = 'healthy' THEN 1 END)::int as healthy,
          COUNT(CASE WHEN health_status = 'degraded' THEN 1 END)::int as degraded,
          COUNT(CASE WHEN health_status = 'unreachable' THEN 1 END)::int as unreachable,
          COUNT(CASE WHEN health_status = 'unknown' THEN 1 END)::int as unknown
        FROM urls
      `),
      query(`
        SELECT hc.id, hc.url_id, hc.target_url, hc.status_code, 
               hc.response_time_ms, hc.is_healthy, hc.error_reason, hc.checked_at,
               u.short_code
        FROM link_health_checks hc
        JOIN urls u ON hc.url_id = u.id
        ORDER BY hc.checked_at DESC
        LIMIT 20
      `),
      query(`
        SELECT id, short_code, original_url, title, health_status, 
               health_status_code, health_error, last_health_check_at
        FROM urls
        WHERE health_status IN ('degraded', 'unreachable')
        ORDER BY last_health_check_at DESC
        LIMIT 20
      `),
    ]);

    res.json({
      success: true,
      data: {
        counts: countsRes.rows[0],
        recentChecks: recentChecksRes.rows,
        failingLinks: failingLinksRes.rows,
      }
    });
  } catch (err) {
    console.error('getHealthOverview error:', err);
    res.status(500).json({ success: false, message: 'Failed to load link health overview.' });
  }
};

/**
 * POST /api/admin/health/check/:id
 * Trigger an on-demand, SSRF-hardened destination health check for a link
 */
export const triggerLinkHealthCheck = async (req, res) => {
  try {
    const { id } = req.params;

    const urlRes = await query('SELECT id, original_url, short_code FROM urls WHERE id = $1', [id]);
    if (urlRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Link not found.' });
    }

    const link = urlRes.rows[0];

    // Execute SSRF-hardened probe
    const checkResult = await checkUrlHealth(link.original_url);

    // Save history and update URL record
    await recordLinkHealthCheck(link.id, link.original_url, checkResult);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'health.manual_check',
      targetType: 'url',
      targetId: id,
      details: {
        shortCode: link.short_code,
        destination: link.original_url,
        isHealthy: checkResult.isHealthy,
        statusCode: checkResult.statusCode,
      },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Health probe completed: ${checkResult.isHealthy ? 'Healthy' : 'Incident detected'}.`,
      data: checkResult,
    });
  } catch (err) {
    console.error('triggerLinkHealthCheck error:', err);
    res.status(500).json({ success: false, message: 'Failed to perform health check.' });
  }
};

/**
 * GET /api/admin/settings
 * Read platform operational configuration and feature flags
 */
export const getPlatformSettings = async (req, res) => {
  try {
    const result = await query(`
      SELECT key, value, description, updated_at 
      FROM platform_settings 
      ORDER BY key ASC
    `);

    const settingsObj = {};
    for (const r of result.rows) {
      settingsObj[r.key] = {
        value: r.value,
        description: r.description,
        updatedAt: r.updated_at,
      };
    }

    res.json({
      success: true,
      data: settingsObj,
    });
  } catch (err) {
    console.error('getPlatformSettings error:', err);
    res.status(500).json({ success: false, message: 'Failed to load platform settings.' });
  }
};

/**
 * PUT /api/admin/settings
 * Update schema-validated platform settings with audit trail
 */
export const updatePlatformSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, message: 'Settings object is required.' });
    }

    const allowedKeys = [
      'guest_hourly_limit',
      'authenticated_daily_limit',
      'max_url_length',
      'default_expiration_days',
      'enable_guest_shortening',
      'enable_preview_pages',
      'enable_ab_testing',
      'enable_smart_rules',
      'require_captcha_for_guests',
      'system_announcement_banner',
      'banned_domains',
    ];

    const updatedKeys = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowedKeys.includes(key)) continue;

      // Validate types
      if (key === 'system_announcement_banner') {
        if (typeof value !== 'object' || value === null) {
          return res.status(400).json({ success: false, message: 'system_announcement_banner must be an object.' });
        }
      } else if (key === 'banned_domains') {
        if (!Array.isArray(value)) {
          return res.status(400).json({ success: false, message: 'banned_domains must be an array.' });
        }
      } else if (key.includes('limit') || key.includes('length') || key.includes('days')) {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 100000) {
          return res.status(400).json({ success: false, message: `Invalid numeric value for ${key}.` });
        }
      } else if (key.startsWith('enable_') || key.startsWith('require_')) {
        if (typeof value !== 'boolean') {
          return res.status(400).json({ success: false, message: `Value for ${key} must be a boolean.` });
        }
      }

      await query(`
        UPDATE platform_settings 
        SET value = $1, updated_by = $2, updated_at = NOW() 
        WHERE key = $3
      `, [JSON.stringify(value), req.user.id, key]);

      updatedKeys.push(key);
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'settings.update',
      targetType: 'platform_settings',
      targetId: 'global',
      details: { updatedKeys },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Platform configuration updated successfully.',
      updatedKeys,
    });
  } catch (err) {
    console.error('updatePlatformSettings error:', err);
    res.status(500).json({ success: false, message: 'Failed to update platform settings.' });
  }
};

/**
 * GET /api/admin/audit
 * Paginated audit trail records
 */
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const action = req.query.action ? `%${req.query.action.trim().toLowerCase()}%` : null;
    const targetType = req.query.targetType ? req.query.targetType.trim() : null;

    let whereConditions = [];
    let params = [];

    if (action) {
      params.push(action);
      whereConditions.push(`LOWER(action) LIKE $${params.length}`);
    }

    if (targetType) {
      params.push(targetType);
      whereConditions.push(`target_type = $${params.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int as total FROM audit_logs ${whereClause}`, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const result = await query(`
      SELECT id, actor_id, actor_email, action, target_type, target_id, details, ip_hash, created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve audit trail.' });
  }
};

/**
 * GET /api/admin/system/diagnostics
 * Deep platform telemetry, PostgreSQL storage & connection metrics
 */
export const getSystemDiagnostics = async (req, res) => {
  try {
    const start = process.hrtime.bigint();
    const [dbRes, countsRes, connRes] = await Promise.all([
      query('SELECT NOW() as db_time, version() as db_version, current_database() as db_name'),
      query(`
        SELECT 
          (SELECT COUNT(*)::int FROM users) as users_count,
          (SELECT COUNT(*)::int FROM urls) as urls_count,
          (SELECT COUNT(*)::int FROM click_events) as clicks_count,
          (SELECT COUNT(*)::int FROM public_pages) as pages_count,
          (SELECT COUNT(*)::int FROM custom_domains) as custom_domains_count,
          (SELECT COUNT(*)::int FROM api_keys WHERE is_revoked = false) as active_api_keys_count,
          (SELECT COUNT(*)::int FROM webhooks WHERE is_active = true) as active_webhooks_count,
          (SELECT COUNT(*)::int FROM link_reports WHERE status = 'pending') as pending_reports_count,
          (SELECT COUNT(*)::int FROM audit_logs) as audit_logs_count
      `),
      query(`
        SELECT COUNT(*)::int as active_connections 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `).catch(() => ({ rows: [{ active_connections: 1 }] })),
    ]);
    const end = process.hrtime.bigint();
    const dbPingLatencyMs = Number(end - start) / 1000000;

    const memory = process.memoryUsage();
    const nodeTelemetry = {
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      environment: process.env.NODE_ENV || 'development',
      rssMemoryMb: Math.round(memory.rss / (1024 * 1024)),
      heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
      heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      externalMemoryMb: Math.round(memory.external / (1024 * 1024)),
    };

    res.json({
      success: true,
      data: {
        database: {
          status: 'healthy',
          pingLatencyMs: Math.round(dbPingLatencyMs * 100) / 100,
          version: dbRes.rows[0]?.db_version || 'PostgreSQL',
          name: dbRes.rows[0]?.db_name || 'postgres',
          serverTime: dbRes.rows[0]?.db_time,
          activeConnections: connRes.rows[0]?.active_connections || 1,
        },
        tableCounts: countsRes.rows[0] || {},
        runtime: nodeTelemetry,
      }
    });
  } catch (err) {
    console.error('getSystemDiagnostics error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve system diagnostics.' });
  }
};

/**
 * POST /api/admin/system/ping
 * Instant database roundtrip ping latency test
 */
export const pingDatabase = async (req, res) => {
  try {
    const start = process.hrtime.bigint();
    await query('SELECT 1');
    const end = process.hrtime.bigint();
    const latencyMs = Math.round((Number(end - start) / 1000000) * 100) / 100;

    res.json({
      success: true,
      latencyMs,
      timestamp: new Date().toISOString(),
      status: 'operational',
    });
  } catch (err) {
    console.error('pingDatabase error:', err);
    res.status(500).json({ success: false, message: 'Database ping failed.', error: err.message });
  }
};

/**
 * POST /api/admin/system/cleanup
 * Perform platform maintenance (prune expired guest links, old webhook deliveries, etc.)
 */
export const cleanupMaintenance = async (req, res) => {
  try {
    const { target } = req.body;
    let deletedCount = 0;
    let description = '';

    if (target === 'expired_guest_links') {
      const result = await query(
        'DELETE FROM urls WHERE user_id IS NULL AND expires_at < NOW() RETURNING id'
      );
      deletedCount = result.rows.length;
      description = `Removed ${deletedCount} expired guest links.`;
    } else if (target === 'stale_webhook_logs') {
      const result = await query(
        "DELETE FROM webhook_deliveries WHERE created_at < NOW() - INTERVAL '30 days' RETURNING id"
      );
      deletedCount = result.rows.length;
      description = `Pruned ${deletedCount} webhook delivery logs older than 30 days.`;
    } else if (target === 'prune_health_history') {
      const result = await query(`
        DELETE FROM link_health_checks 
        WHERE id NOT IN (
          SELECT id FROM link_health_checks ORDER BY checked_at DESC LIMIT 500
        ) RETURNING id
      `);
      deletedCount = result.rows.length;
      description = `Pruned ${deletedCount} historical link health checks (kept latest 500).`;
    } else {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid maintenance target. Allowed: 'expired_guest_links', 'stale_webhook_logs', 'prune_health_history'." 
      });
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `system.cleanup_${target}`,
      targetType: 'system',
      targetId: target,
      details: { deletedCount, description },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: description,
      deletedCount,
    });
  } catch (err) {
    console.error('cleanupMaintenance error:', err);
    res.status(500).json({ success: false, message: 'Maintenance cleanup operation failed.' });
  }
};

const DEFAULT_BANNED_DOMAINS = [
  { domain: 'phish-axly.xyz', reason: 'Known phishing threat', addedAt: new Date().toISOString() },
  { domain: 'free-crypto-airdrop.net', reason: 'Cryptocurrency scam', addedAt: new Date().toISOString() },
  { domain: 'malware-distribution.cc', reason: 'Malicious payload dropper', addedAt: new Date().toISOString() },
  { domain: 'telegram-gift-bot.tk', reason: 'Credential harvester', addedAt: new Date().toISOString() },
];

const getBannedDomainsList = async () => {
  const settingsRes = await query("SELECT value FROM platform_settings WHERE key = 'banned_domains'");
  if (settingsRes.rows.length > 0 && Array.isArray(settingsRes.rows[0].value)) {
    return settingsRes.rows[0].value;
  }
  return DEFAULT_BANNED_DOMAINS;
};

/**
 * GET /api/admin/firewall
 * Domain firewall rules, banned domains list, and tenant custom domains oversight
 */
export const getFirewallOverview = async (req, res) => {
  try {
    const [bannedDomains, domainsRes] = await Promise.all([
      getBannedDomainsList(),
      query(`
        SELECT 
          cd.id, cd.domain, cd.domain_type, cd.status, cd.dns_record_type, 
          cd.dns_expected_value, cd.verified_at, cd.ssl_status, cd.created_at,
          u.id as user_id, u.name as owner_name, u.email as owner_email,
          w.id as workspace_id, w.name as workspace_name
        FROM custom_domains cd
        LEFT JOIN users u ON cd.user_id = u.id
        LEFT JOIN workspaces w ON cd.workspace_id = w.id
        ORDER BY cd.created_at DESC
      `),
    ]);

    const customDomains = domainsRes.rows;
    const stats = {
      totalDomains: customDomains.length,
      verifiedDomains: customDomains.filter(d => d.status === 'verified').length,
      pendingDnsDomains: customDomains.filter(d => d.status === 'pending_dns').length,
      sslActiveDomains: customDomains.filter(d => d.ssl_status === 'active').length,
    };

    res.json({
      success: true,
      data: {
        bannedDomains,
        customDomains,
        stats,
      }
    });
  } catch (err) {
    console.error('getFirewallOverview error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve firewall overview.' });
  }
};

/**
 * POST /api/admin/firewall/ban
 * Add a domain to the global malicious domain blocklist
 */
export const addBannedDomain = async (req, res) => {
  try {
    let { domain, reason } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ success: false, message: 'Domain name is required.' });
    }

    domain = domain.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
    if (!domain || domain.length < 3 || !domain.includes('.')) {
      return res.status(400).json({ success: false, message: 'Invalid domain format.' });
    }

    const currentList = await getBannedDomainsList();

    // Check if already in list
    if (currentList.some(item => (typeof item === 'string' ? item : item.domain) === domain)) {
      return res.status(400).json({ success: false, message: `Domain '${domain}' is already banned.` });
    }

    const newEntry = {
      domain,
      reason: reason ? String(reason).trim() : 'Malicious or suspicious destination',
      addedBy: req.user.email,
      addedAt: new Date().toISOString(),
    };

    const updatedList = [newEntry, ...currentList];

    await query(`
      INSERT INTO platform_settings (key, value, description, updated_by, updated_at)
      VALUES ('banned_domains', $1, 'Global list of prohibited malicious domains', $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()
    `, [JSON.stringify(updatedList), req.user.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'firewall.domain_banned',
      targetType: 'domain',
      targetId: domain,
      details: newEntry,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Domain '${domain}' successfully added to the global blocklist.`,
      bannedDomains: updatedList,
    });
  } catch (err) {
    console.error('addBannedDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to ban domain.' });
  }
};

/**
 * DELETE /api/admin/firewall/ban/:domain
 * Remove a domain from the global blocklist
 */
export const removeBannedDomain = async (req, res) => {
  try {
    const targetDomain = req.params.domain.trim().toLowerCase();

    const currentList = await getBannedDomainsList();

    const updatedList = currentList.filter(item => {
      const d = typeof item === 'string' ? item : item.domain;
      return d !== targetDomain;
    });

    await query(`
      INSERT INTO platform_settings (key, value, description, updated_by, updated_at)
      VALUES ('banned_domains', $1, 'Global list of prohibited malicious domains', $2, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()
    `, [JSON.stringify(updatedList), req.user.id]);

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'firewall.domain_unbanned',
      targetType: 'domain',
      targetId: targetDomain,
      details: { domain: targetDomain },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Domain '${targetDomain}' removed from global blocklist.`,
      bannedDomains: updatedList,
    });
  } catch (err) {
    console.error('removeBannedDomain error:', err);
    res.status(500).json({ success: false, message: 'Failed to unban domain.' });
  }
};

/**
 * POST /api/admin/firewall/test
 * Test if a destination URL matches any firewall blocklist rules
 */
export const testFirewallUrl = async (req, res) => {
  try {
    const { targetUrl } = req.body;
    if (!targetUrl) {
      return res.status(400).json({ success: false, message: 'Target URL is required.' });
    }

    let hostname = '';
    try {
      const parsed = new URL(targetUrl.includes('://') ? targetUrl : `https://${targetUrl}`);
      hostname = parsed.hostname.toLowerCase();
    } catch {
      return res.status(400).json({ success: false, message: 'Malformed target URL.' });
    }

    const currentList = await getBannedDomainsList();

    const matched = currentList.find(item => {
      const d = (typeof item === 'string' ? item : item.domain).toLowerCase();
      return hostname === d || hostname.endsWith(`.${d}`);
    });

    res.json({
      success: true,
      data: {
        targetUrl,
        hostname,
        isBlocked: Boolean(matched),
        matchedRule: matched || null,
        status: matched ? 'BLOCKED_BY_FIREWALL' : 'ALLOWED',
      }
    });
  } catch (err) {
    console.error('testFirewallUrl error:', err);
    res.status(500).json({ success: false, message: 'Failed to evaluate URL against firewall.' });
  }
};

/**
 * PATCH /api/admin/firewall/domains/:id
 * Force-verify, revoke or update custom domain status
 */
export const updateCustomDomainAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sslStatus, reason } = req.body;

    if (status && !['verified', 'pending_dns', 'revoked'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid domain status.' });
    }

    const result = await query(`
      UPDATE custom_domains 
      SET 
        status = COALESCE($1, status),
        ssl_status = COALESCE($2, ssl_status),
        verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE verified_at END,
        updated_at = NOW()
      WHERE id = $3 
      RETURNING id, domain, domain_type, status, ssl_status, verified_at
    `, [status || null, sslStatus || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Custom domain not found.' });
    }

    const updated = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `domain.${status || 'updated'}_by_admin`,
      targetType: 'custom_domain',
      targetId: id,
      details: { domain: updated.domain, status, sslStatus, reason },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Custom domain ${updated.domain} updated to ${updated.status}.`,
      data: updated,
    });
  } catch (err) {
    console.error('updateCustomDomainAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to update custom domain.' });
  }
};

/**
 * GET /api/admin/public-pages
 * Paginated registry of link-in-bio and public profile pages
 */
export const getAdminPublicPages = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    const search = req.query.search ? `%${req.query.search.trim().toLowerCase()}%` : null;
    const status = req.query.status && ['draft', 'published', 'archived'].includes(req.query.status) ? req.query.status : null;
    const pageType = req.query.pageType ? req.query.pageType.trim() : null;

    let whereConditions = [];
    let params = [];

    if (search) {
      params.push(search);
      whereConditions.push(`(
        LOWER(p.slug) LIKE $${params.length} 
        OR LOWER(p.title) LIKE $${params.length} 
        OR LOWER(COALESCE(u.email, '')) LIKE $${params.length}
      )`);
    }

    if (status) {
      params.push(status);
      whereConditions.push(`p.status = $${params.length}`);
    }

    if (pageType) {
      params.push(pageType);
      whereConditions.push(`p.page_type = $${params.length}`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countRes = await query(`
      SELECT COUNT(*)::int as total 
      FROM public_pages p 
      LEFT JOIN users u ON p.user_id = u.id 
      ${whereClause}
    `, params);
    const total = countRes.rows[0].total;

    params.push(limit, offset);
    const dataQuery = `
      SELECT 
        p.id, p.slug, p.title, p.bio, p.page_type, p.template_key, p.status,
        p.seo_title, p.publish_at, p.unpublish_at, p.published_at, p.created_at, p.updated_at,
        CASE WHEN jsonb_typeof(p.blocks) = 'array' THEN jsonb_array_length(p.blocks) ELSE 0 END as blocks_count,
        u.id as user_id, u.name as owner_name, u.email as owner_email
      FROM public_pages p
      LEFT JOIN users u ON p.user_id = u.id
      ${whereClause}
      ORDER BY p.updated_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const result = await query(dataQuery, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      }
    });
  } catch (err) {
    console.error('getAdminPublicPages error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve public pages.' });
  }
};

/**
 * PATCH /api/admin/public-pages/:id/status
 * Suspend/archive or publish a public bio page
 */
export const updatePublicPageStatusAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid page status.' });
    }

    const result = await query(`
      UPDATE public_pages 
      SET 
        status = $1,
        published_at = CASE WHEN $1 = 'published' THEN NOW() ELSE published_at END,
        updated_at = NOW()
      WHERE id = $2 
      RETURNING id, slug, title, status, page_type
    `, [status, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Public page not found.' });
    }

    const updated = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: `public_page.${status}_by_admin`,
      targetType: 'public_page',
      targetId: id,
      details: { slug: updated.slug, status, reason },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Public page /p/${updated.slug} status set to ${updated.status}.`,
      data: updated,
    });
  } catch (err) {
    console.error('updatePublicPageStatusAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to update public page status.' });
  }
};

/**
 * DELETE /api/admin/public-pages/:id
 * Permanently delete a public bio page
 */
export const deletePublicPageAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM public_pages WHERE id = $1 RETURNING id, slug, title', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Public page not found.' });
    }

    const deleted = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'public_page.deleted_by_admin',
      targetType: 'public_page',
      targetId: id,
      details: { slug: deleted.slug, title: deleted.title },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Public page /p/${deleted.slug} permanently deleted.`
    });
  } catch (err) {
    console.error('deletePublicPageAdmin error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete public page.' });
  }
};

/**
 * POST /api/admin/users/:id/reset-token
 * Generate a secure administrative password recovery / support token for a user
 */
export const generateUserSupportToken = async (req, res) => {
  try {
    const { id } = req.params;

    const userRes = await query('SELECT id, name, email, is_active FROM users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const targetUser = userRes.rows[0];

    // Generate signed recovery token (valid for 24h)
    const token = jwt.sign(
      { id: targetUser.id, email: targetUser.email, role: 'support_recovery' },
      config.jwt.secret,
      { expiresIn: '24h' }
    );

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'user.support_token_generated',
      targetType: 'user',
      targetId: targetUser.id,
      details: { targetEmail: targetUser.email },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `Support password reset token generated for ${targetUser.email}.`,
      data: {
        token,
        targetEmail: targetUser.email,
        expiresIn: '24 hours',
        recoveryUrl: `${config.FRONTEND_URL}/reset-password?token=${token}`,
      }
    });
  } catch (err) {
    console.error('generateUserSupportToken error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate support token.' });
  }
};
