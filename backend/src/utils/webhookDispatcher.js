import crypto from 'crypto';
import fetch from 'node-fetch';
import { query } from '../db/pool.js';
import { validateSafeDestinationUrl } from './ssrf.js';

/**
 * Generate HMAC-SHA256 signature for webhook payload
 * Format: t=<unix_seconds>,v1=<hex_signature>
 */
export const signWebhookPayload = (payload, secret, timestamp = Math.floor(Date.now() / 1000)) => {
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signaturePayload = `${timestamp}.${payloadString}`;
  const signature = crypto.createHmac('sha256', secret).update(signaturePayload).digest('hex');
  const headerValue = `t=${timestamp},v1=${signature}`;

  const result = new String(headerValue);
  result.timestamp = timestamp;
  result.signature = signature;
  result.headerValue = headerValue;
  return result;
};

/**
 * Execute a single webhook delivery with SSRF safety checks and logging
 */
export const executeWebhookDelivery = async (webhook, event, payload, attemptCount = 1) => {
  const deliveryId = crypto.randomUUID();
  const eventId = payload.eventId || crypto.randomUUID();
  const enrichedPayload = {
    ...payload,
    eventId,
    event,
    version: '1.0',
    createdAt: new Date().toISOString(),
  };

  // SSRF Destination Validation
  const ssrfCheck = validateSafeDestinationUrl(webhook.url);
  if (!ssrfCheck.valid) {
    const errorReason = `Blocked by SSRF Policy: ${ssrfCheck.reason}`;
    await query(`
      INSERT INTO webhook_deliveries (
        id, webhook_id, event, payload, status_code, is_success, attempt_count, error_reason
      ) VALUES ($1, $2, $3, $4, $5, false, $6, $7)
    `, [deliveryId, webhook.id, event, JSON.stringify(enrichedPayload), 0, attemptCount, errorReason]);

    return {
      success: false,
      deliveryId,
      error: errorReason,
    };
  }

  const { headerValue } = signWebhookPayload(enrichedPayload, webhook.secret);

  const startTime = Date.now();
  let statusCode = 0;
  let responseBody = '';
  let isSuccess = false;
  let errorReason = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s strict timeout

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Axly-Webhooks/1.0',
        'x-axly-event': event,
        'x-axly-delivery': deliveryId,
        'x-axly-signature': headerValue,
      },
      body: JSON.stringify(enrichedPayload),
      signal: controller.signal,
      redirect: 'error', // Do not automatically follow unvalidated redirects
    });

    clearTimeout(timeoutId);
    statusCode = response.status;
    isSuccess = response.ok;

    const rawText = await response.text();
    responseBody = rawText.slice(0, 1000); // Truncate response for storage safety
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      errorReason = 'Delivery timed out after 6000ms';
    } else {
      errorReason = err.message || 'Network delivery failure';
    }
  }

  const durationMs = Date.now() - startTime;

  // Persist delivery record
  await query(`
    INSERT INTO webhook_deliveries (
      id, webhook_id, event, payload, status_code, response_body, duration_ms, is_success, attempt_count, error_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [
    deliveryId,
    webhook.id,
    event,
    JSON.stringify(enrichedPayload),
    statusCode,
    responseBody || null,
    durationMs,
    isSuccess,
    attemptCount,
    errorReason,
  ]);

  return {
    success: isSuccess,
    deliveryId,
    statusCode,
    durationMs,
    error: errorReason,
  };
};

/**
 * Asynchronously dispatch an event to all subscribed webhooks.
 * NEVER blocks redirection or caller execution.
 */
export const dispatchWebhookEvent = ({ event, payload, userId = null, workspaceId = null }) => {
  setImmediate(async () => {
    try {
      let conditions = [`is_active = true`, `$1 = ANY(events)`];
      let params = [event];

      if (workspaceId) {
        params.push(workspaceId);
        conditions.push(`(workspace_id = $${params.length})`);
      } else if (userId) {
        params.push(userId);
        conditions.push(`(user_id = $${params.length})`);
      }

      const whereClause = conditions.join(' AND ');
      const res = await query(`
        SELECT id, user_id, workspace_id, url, secret, events
        FROM webhooks
        WHERE ${whereClause}
      `, params);

      for (const webhook of res.rows) {
        executeWebhookDelivery(webhook, event, payload, 1).catch(err => {
          console.error(`Webhook delivery failure [${webhook.id}]:`, err.message);
        });
      }
    } catch (err) {
      console.error('dispatchWebhookEvent error:', err);
    }
  });
};
