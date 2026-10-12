import { query } from '../db/pool.js';
import crypto from 'crypto';

const AUDIT_SALT = process.env.AUDIT_SALT || 'axly_audit_salt_2026';

/**
 * Anonymize actor/client IP address for privacy-conscious audit retention
 */
export const hashIp = (ip) => {
  if (!ip) return null;
  return crypto.createHmac('sha256', AUDIT_SALT).update(ip).digest('hex').substring(0, 32);
};

/**
 * Log sensitive operational / administrative actions
 * Does not throw to avoid failing user requests if audit write fails.
 */
export const logAuditEvent = async ({
  actorId,
  actorEmail,
  action,
  targetType,
  targetId,
  details = {},
  ip,
}) => {
  try {
    const ipHash = hashIp(ip);
    await query(`
      INSERT INTO audit_logs (
        actor_id, actor_email, action, target_type, target_id, details, ip_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      actorId || null,
      actorEmail || 'system@axly.in',
      action,
      targetType,
      targetId ? String(targetId) : null,
      JSON.stringify(details),
      ipHash,
    ]);
  } catch (err) {
    console.error('Audit logging error:', err.message);
  }
};
