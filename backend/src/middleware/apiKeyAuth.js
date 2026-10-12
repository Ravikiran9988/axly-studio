import { query } from '../db/pool.js';
import { hashApiKey, hasScope } from '../utils/apiKey.js';
import { authenticate } from './auth.js';

/**
 * Middleware: Authenticate programmatic requests using high-entropy API keys
 */
export const authenticateApiKey = async (req, res, next) => {
  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;
  let rawKey = null;

  if (headerKey) {
    rawKey = headerKey.trim();
  } else if (authHeader && authHeader.startsWith('Bearer axly_')) {
    rawKey = authHeader.substring(7).trim();
  }

  if (!rawKey) {
    return res.status(401).json({
      success: false,
      message: 'API key required. Provide via x-api-key header or Authorization: Bearer <key>',
    });
  }

  try {
    const keyHash = hashApiKey(rawKey);

    const result = await query(`
      SELECT 
        k.id, k.name, k.scopes, k.rate_limit_per_minute, k.expires_at, k.is_revoked,
        k.workspace_id,
        u.id as user_id, u.name as user_name, u.email as user_email, u.role as user_role, u.is_active as user_active
      FROM api_keys k
      JOIN users u ON k.user_id = u.id
      WHERE k.key_hash = $1
    `, [keyHash]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key.',
      });
    }

    const keyData = result.rows[0];

    if (keyData.is_revoked) {
      return res.status(401).json({
        success: false,
        message: 'This API key has been revoked.',
      });
    }

    if (keyData.expires_at && new Date(keyData.expires_at) < new Date()) {
      return res.status(401).json({
        success: false,
        message: 'This API key has expired.',
      });
    }

    if (!keyData.user_active) {
      return res.status(403).json({
        success: false,
        message: 'Account associated with this API key is disabled.',
      });
    }

    // Non-blocking update of last_used_at
    query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [keyData.id]).catch(() => {});

    req.user = {
      id: keyData.user_id,
      name: keyData.user_name,
      email: keyData.user_email,
      role: keyData.user_role,
    };

    req.apiKey = {
      id: keyData.id,
      name: keyData.name,
      scopes: keyData.scopes || [],
      workspaceId: keyData.workspace_id,
      rateLimit: keyData.rate_limit_per_minute,
    };

    req.workspaceId = keyData.workspace_id;
    req.authMethod = 'api_key';

    next();
  } catch (err) {
    console.error('authenticateApiKey error:', err);
    res.status(500).json({ success: false, message: 'Authentication service failure.' });
  }
};

/**
 * Middleware: Flexible authenticator accepting EITHER user JWT token OR programmatic API Key
 */
export const authenticateOrApiKey = (req, res, next) => {
  const headerKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  if (headerKey || (authHeader && authHeader.startsWith('Bearer axly_'))) {
    return authenticateApiKey(req, res, next);
  }

  // Fallback to standard JWT session authentication
  return authenticate(req, res, next);
};

/**
 * Middleware: Enforce required scope for API key callers
 */
export const requireScope = (requiredScope) => {
  return (req, res, next) => {
    // If request is authenticated via standard session JWT, scopes do not restrict the user
    if (req.authMethod !== 'api_key') {
      return next();
    }

    const keyScopes = req.apiKey?.scopes || [];
    if (!hasScope(keyScopes, requiredScope)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: API key does not have required '${requiredScope}' scope.`,
        requiredScope,
        providedScopes: keyScopes,
      });
    }

    next();
  };
};
