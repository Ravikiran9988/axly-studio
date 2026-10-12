import { query } from '../db/pool.js';
import { generateApiKey, ALLOWED_SCOPES } from '../utils/apiKey.js';
import { logAuditEvent } from '../utils/audit.js';

/**
 * GET /api/keys - List API keys for the authenticated user or workspace
 */
export const listApiKeys = async (req, res) => {
  try {
    const workspaceId = req.query.workspaceId || null;

    let result;
    if (workspaceId) {
      result = await query(`
        SELECT id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, last_used_at, is_revoked, created_at
        FROM api_keys
        WHERE workspace_id = $1 AND (user_id = $2 OR is_revoked = false)
        ORDER BY created_at DESC
      `, [workspaceId, req.user.id]);
    } else {
      result = await query(`
        SELECT id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, last_used_at, is_revoked, created_at
        FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC
      `, [req.user.id]);
    }

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('listApiKeys error:', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve API keys.' });
  }
};

/**
 * POST /api/keys - Generate a high-entropy, cryptographically secure API key
 * Full secret is returned exactly ONCE on creation.
 */
export const createApiKey = async (req, res) => {
  try {
    const { name, scopes = ['links:read', 'links:write'], expiresInDays = null, workspaceId = null } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'A descriptive key name (minimum 2 characters) is required.',
      });
    }

    // Validate requested scopes
    const validScopes = scopes.filter(s => ALLOWED_SCOPES.includes(s));
    if (validScopes.length === 0) {
      return res.status(400).json({
        success: false,
        message: `At least one valid scope is required. Allowed scopes: ${ALLOWED_SCOPES.join(', ')}`,
      });
    }

    // Optional expiration
    let expiresAt = null;
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 3600 * 1000);
    }

    const { fullKey, keyPrefix, keyHash } = generateApiKey();

    const result = await query(`
      INSERT INTO api_keys (
        user_id, workspace_id, name, key_prefix, key_hash, scopes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at
    `, [
      req.user.id,
      workspaceId || null,
      name.trim(),
      keyPrefix,
      keyHash,
      validScopes,
      expiresAt,
    ]);

    const createdKey = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'apikey.create',
      targetType: 'api_key',
      targetId: createdKey.id,
      details: { name: createdKey.name, keyPrefix, scopes: validScopes },
      ip: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'API key created successfully. Store this secret immediately; it will never be displayed again.',
      data: {
        ...createdKey,
        key: fullKey, // Return secret ONCE
      },
    });
  } catch (err) {
    console.error('createApiKey error:', err);
    res.status(500).json({ success: false, message: 'Failed to create API key.' });
  }
};

/**
 * DELETE /api/keys/:id - Revoke an API key
 */
export const revokeApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      UPDATE api_keys
      SET is_revoked = true, revoked_at = NOW()
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
      RETURNING id, name, key_prefix
    `, [id, req.user.id, req.user.role]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'API key not found or unauthorized.' });
    }

    const revoked = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'apikey.revoke',
      targetType: 'api_key',
      targetId: revoked.id,
      details: { name: revoked.name, keyPrefix: revoked.key_prefix },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: `API key '${revoked.name}' (${revoked.key_prefix}...) has been permanently revoked.`,
    });
  } catch (err) {
    console.error('revokeApiKey error:', err);
    res.status(500).json({ success: false, message: 'Failed to revoke API key.' });
  }
};

/**
 * POST /api/keys/:id/rotate - Rotate an API key
 */
export const rotateApiKey = async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch existing key metadata
    const existing = await query(`
      SELECT id, name, scopes, workspace_id, expires_at
      FROM api_keys
      WHERE id = $1 AND (user_id = $2 OR $3 = 'admin')
    `, [id, req.user.id, req.user.role]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'API key not found or unauthorized.' });
    }

    const oldKey = existing.rows[0];

    // Revoke old key
    await query(`
      UPDATE api_keys SET is_revoked = true, revoked_at = NOW() WHERE id = $1
    `, [oldKey.id]);

    // Generate replacement
    const { fullKey, keyPrefix, keyHash } = generateApiKey();

    const result = await query(`
      INSERT INTO api_keys (
        user_id, workspace_id, name, key_prefix, key_hash, scopes, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, key_prefix, scopes, rate_limit_per_minute, expires_at, created_at
    `, [
      req.user.id,
      oldKey.workspace_id,
      oldKey.name,
      keyPrefix,
      keyHash,
      oldKey.scopes,
      oldKey.expires_at,
    ]);

    const newKey = result.rows[0];

    await logAuditEvent({
      actorId: req.user.id,
      actorEmail: req.user.email,
      action: 'apikey.rotate',
      targetType: 'api_key',
      targetId: newKey.id,
      details: { oldKeyId: oldKey.id, newKeyPrefix: keyPrefix },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'API key rotated successfully. Previous key revoked immediately.',
      data: {
        ...newKey,
        key: fullKey,
      },
    });
  } catch (err) {
    console.error('rotateApiKey error:', err);
    res.status(500).json({ success: false, message: 'Failed to rotate API key.' });
  }
};
