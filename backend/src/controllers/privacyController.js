import { query } from '../db/pool.js';
import { logAuditEvent } from '../utils/audit.js';

/**
 * GET /api/user/export - Export comprehensive machine-readable archive of user data
 */
export const exportUserData = async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      userRes,
      urlsRes,
      campaignsRes,
      experimentsRes,
      workspacesRes,
      domainsRes,
      webhooksRes,
      pagesRes,
      pageEventsRes,
      pageLeadsRes,
      pageRevisionsRes,
    ] = await Promise.all([
      query('SELECT id, name, email, plan, role, is_active, created_at, updated_at FROM users WHERE id = $1', [userId]),
      query(`
        SELECT id, short_code, original_url, custom_alias, title, tags, notes, click_count, unique_clicks, status, expires_at, created_at
        FROM urls WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]),
      query('SELECT id, name, description, utm_source, utm_medium, utm_campaign, created_at FROM campaigns WHERE user_id = $1', [userId]),
      query('SELECT id, name, status, conversion_goal, created_at FROM experiments WHERE user_id = $1', [userId]),
      query(`
        SELECT w.id, w.name, w.slug, wm.role, w.created_at
        FROM workspaces w
        JOIN workspace_members wm ON w.id = wm.workspace_id
        WHERE wm.user_id = $1
      `, [userId]),
      query('SELECT id, domain, status, verified_at, created_at FROM custom_domains WHERE user_id = $1', [userId]),
      query('SELECT id, url, events, is_active, created_at FROM webhooks WHERE user_id = $1', [userId]),
      query(`
        SELECT id, slug, title, bio, profile_image_url, page_type, template_key, theme, blocks,
               status, seo_title, seo_description, og_image_url, publish_at, unpublish_at,
               custom_domain_id, contact_email, contact_phone, contact_company, contact_job_title,
               created_at, updated_at, published_at
        FROM public_pages WHERE user_id = $1 ORDER BY created_at DESC
      `, [userId]),
      query(`
        SELECT e.id, e.event_type, e.block_id, e.visitor_hash, e.referrer_host, e.device_type, e.created_at
        FROM page_events e JOIN public_pages p ON p.id = e.page_id
        WHERE p.user_id = $1 ORDER BY e.created_at DESC LIMIT 10000
      `, [userId]),
      query(`
        SELECT l.id, l.name, l.email, l.message, l.consent, l.visitor_hash, l.created_at
        FROM page_leads l JOIN public_pages p ON p.id = l.page_id
        WHERE p.user_id = $1 ORDER BY l.created_at DESC
      `, [userId]),
      query(`
        SELECT r.id, r.page_id, r.revision_label, r.snapshot, r.created_at
        FROM page_revisions r JOIN public_pages p ON p.id = r.page_id
        WHERE p.user_id = $1 ORDER BY r.created_at DESC LIMIT 1000
      `, [userId]),
    ]);

    const archive = {
      exportedAt: new Date().toISOString(),
      formatVersion: '1.0',
      data_policy_notice: {
        retention_period: 'Active account duration',
        backup_retention: 'Encrypted rolling 30-day backups',
      },
      account: userRes.rows[0],
      links: urlsRes.rows,
      campaigns: campaignsRes.rows,
      experiments: experimentsRes.rows,
      workspaces: workspacesRes.rows,
      customDomains: domainsRes.rows,
      webhooks: webhooksRes.rows,
      publicPages: pagesRes.rows,
      pageAnalyticsEvents: pageEventsRes.rows,
      pageLeads: pageLeadsRes.rows,
      pageRevisions: pageRevisionsRes.rows,
    };

    await logAuditEvent({
      actorId: userId,
      actorEmail: req.user.email,
      action: 'privacy.data_export',
      targetType: 'user',
      targetId: userId,
      details: { urlCount: urlsRes.rows.length, pageCount: pagesRes.rows.length },
      ip: req.ip,
    });

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="axly-data-export-${userId.slice(0, 8)}.json"`);
    res.json({
      success: true,
      data: archive,
      export: archive,
    });
  } catch (err) {
    console.error('exportUserData error:', err);
    res.status(500).json({ success: false, message: 'Failed to generate data export.' });
  }
};

/**
 * DELETE /api/user/account - Request complete account data deletion
 */
export const deleteUserAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { confirmationEmail, confirmation } = req.body;

    const isConfirmed =
      (confirmationEmail && confirmationEmail.toLowerCase().trim() === req.user.email.toLowerCase().trim()) ||
      (confirmation && confirmation.trim().toUpperCase() === 'DELETE MY ACCOUNT');

    if (!isConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Must provide exact account email or confirmation phrase "DELETE MY ACCOUNT" to confirm permanent deletion.',
      });
    }

    // Check if user is sole owner of multi-member workspaces
    const soleOwnerWorkspaces = await query(`
      SELECT w.id, w.name FROM workspaces w
      WHERE w.owner_id = $1 AND w.is_personal = false AND (
        SELECT COUNT(*) FROM workspace_members WHERE workspace_id = w.id
      ) > 1
    `, [userId]);

    if (soleOwnerWorkspaces.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Please transfer ownership of team workspace '${soleOwnerWorkspaces.rows[0].name}' before deleting your account.`,
      });
    }

    await logAuditEvent({
      actorId: userId,
      actorEmail: req.user.email,
      action: 'privacy.account_deleted',
      targetType: 'user',
      targetId: userId,
      details: { email: req.user.email },
      ip: req.ip,
    });

    // Delete user (cascades to owned personal resources)
    await query('DELETE FROM users WHERE id = $1', [userId]);

    res.json({
      success: true,
      message: 'Account and associated personal resources permanently deleted.',
    });
  } catch (err) {
    console.error('deleteUserAccount error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete account.' });
  }
};
