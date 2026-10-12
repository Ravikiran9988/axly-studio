import crypto from 'crypto';
import { query } from '../db/pool.js';
import { validateSafeDestinationUrl } from '../utils/ssrf.js';
import { executeWebhookDelivery } from '../utils/webhookDispatcher.js';
import { logAuditEvent } from '../utils/audit.js';

const ALLOWED_EVENTS = [
  'link.created',
  'link.expired',
  'link.health_changed',
  'experiment.completed',
];

/**
 * GET /api/webhooks - List registered webhooks
 */
export const listWebhooks = async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId || null;

    let result;
    if (workspaceId) {
      result = await query(`
        SELECT id, url, events, is_active, created_at, updated_at,
               CONCAT(SUBSTRING(secret, 1, 10), '...') as secret_masked
        FROM webhooks
        WHERE workspace_id = $1 AND (user_id = $2 OR $3 = 'admin')
        ORDER BY created_at DESC
      `, [workspaceId, req.user.id, req.user.role]);
    } else {
      result = await query(`
        SELECT id, url, events, is_active, created_at, updated_at,
               CONCAT(SUBSTRING(secret, 1, 10), '...') as secret_masked
        FROM webhooks
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [req.user.id]);
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('listWebhooks error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve webhooks.' });
  }
};

/**
 * POST /api/webhooks - Register a new webhook endpoint
 */
export const createWebhook = async (req, res) => {
  try {
    const { url, events = ['link.created'], workspaceId = null } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, message: 'Valid webhook endpoint URL is required.' });
    }

    // SSRF Check on Webhook Destination
    const ssrfCheck = validateSafeDestinationUrl(url);
    if (!ssrfCheck.valid) {
      return res.status(400).json({
        success: false,
        message: `Blocked by SSRF policy: ${ssrfCheck.reason || ssrfCheck.error}`,
      });
    }

    const validEvents = events.filter(e => ALLOWED_EVENTS.includes(e));
    if (validEvents.length === 0) {
      return res.status(400).json({
        success: false,
        message: `At least one valid subscription event required. Allowed: ${ALLOWED_EVENTS.join(', ')}`,
      });
    }

    const secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const result = await query(`
      INSERT INTO webhooks (
        user_id, workspace_id, url, secret, events
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id, url, events, is_active, created_at
    `, [req.user.id, workspaceId || null, url.trim(), secret, validEvents]);

    const created = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'webhook.create',
      targetType: 'webhook',
      targetId: created.id,
      details: { url: created.url, events: validEvents },
      ip: req.ip,
    });

    const webhookObj = {
      ...created,
      secret,
    };

    res.status(201).json({
      success: true,
      message: 'Webhook endpoint registered. Store your signing secret safely.',
      data: webhookObj,
      webhook: webhookObj,
    });
  } catch (err) {
    console.error('createWebhook error:', err);
    res.status(500).json({ success: false, message: 'Failed to create webhook.' });
  }
};

/**
 * GET /api/webhooks/:id/deliveries - Paginated delivery log
 */
export const getWebhookDeliveries = async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const offset = (page - 1) * limit;

    // Verify webhook ownership
    const ownerCheck = await query(`
      SELECT id FROM webhooks WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `, [id, req.user.id, req.user.role]);

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found.' });
    }

    const countRes = await query(`
      SELECT COUNT(*)::int as total FROM webhook_deliveries WHERE webhook_id = $1
    `, [id]);
    const total = countRes.rows[0].total;

    const result = await query(`
      SELECT id, event, payload, status_code, response_body, duration_ms, is_success, attempt_count, error_reason, created_at
      FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('getWebhookDeliveries error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve deliveries.' });
  }
};

/**
 * POST /api/webhooks/:id/deliveries/:deliveryId/retry - Manual redelivery
 */
export const retryWebhookDelivery = async (req, res) => {
  try {
    const { id, deliveryId } = req.params;

    // Lookup webhook & past delivery
    const webhookRes = await query(`
      SELECT id, url, secret FROM webhooks WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `, [id, req.user.id, req.user.role]);

    if (webhookRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found.' });
    }

    const deliveryRes = await query(`
      SELECT id, event, payload, attempt_count FROM webhook_deliveries WHERE id = $1 AND webhook_id = $2
    `, [deliveryId, id]);

    if (deliveryRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Past delivery record not found.' });
    }

    const delivery = deliveryRes.rows[0];
    const outcome = await executeWebhookDelivery(
      webhookRes.rows[0],
      delivery.event,
      delivery.payload,
      (delivery.attempt_count || 1) + 1
    );

    res.json({
      success: true,
      message: outcome.success ? 'Redelivery succeeded.' : 'Redelivery attempted but endpoint returned an error.',
      outcome,
    });
  } catch (err) {
    console.error('retryWebhookDelivery error:', err);
    res.status(500).json({ success: false, message: 'Failed to retry webhook delivery.' });
  }
};

/**
 * POST /api/webhooks/:id/rotate-secret - Rotate signing secret
 */
export const rotateWebhookSecret = async (req, res) => {
  try {
    const { id } = req.params;
    const newSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    const result = await query(`
      UPDATE webhooks
      SET secret = $1, updated_at = NOW()
      WHERE id = $2 AND (user_id = $3 OR $4 = 'admin')
      RETURNING id, url
    `, [newSecret, id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found.' });
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'webhook.rotate_secret',
      targetType: 'webhook',
      targetId: id,
      details: { url: result.rows[0].url },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Webhook signing secret rotated successfully.',
      secret: newSecret,
    });
  } catch (err) {
    console.error('rotateWebhookSecret error:', err);
    res.status(500).json({ success: false, message: 'Failed to rotate secret.' });
  }
};

/**
 * DELETE /api/webhooks/:id - Delete webhook
 */
export const deleteWebhook = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      DELETE FROM webhooks
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
      RETURNING id, url
    `, [id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Webhook not found.' });
    }

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'webhook.delete',
      targetType: 'webhook',
      targetId: id,
      details: { url: result.rows[0].url },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Webhook endpoint removed.',
    });
  } catch (err) {
    console.error('deleteWebhook error:', err);
    res.status(500).json({ success: false, message: 'Failed to delete webhook.' });
  }
};
