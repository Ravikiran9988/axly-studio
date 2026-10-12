import crypto from 'crypto';

export const ALLOWED_SCOPES = [
  'links:read',
  'links:write',
  'analytics:read',
  'campaigns:read',
  'campaigns:write',
  'experiments:read',
  'experiments:write',
  'webhooks:read',
  'webhooks:write',
  'domains:read',
  'domains:write',
  '*',
];

/**
 * Generate a cryptographically secure API key
 * Format: axly_live_<48 hex chars>
 */
export const generateApiKey = (prefix = 'axly_live_') => {
  const entropy = crypto.randomBytes(24).toString('hex');
  const fullKey = `${prefix}${entropy}`;
  const keyPrefix = fullKey.substring(0, 14);
  const keyHash = crypto.createHash('sha256').update(fullKey).digest('hex');

  return {
    fullKey,
    keyPrefix,
    keyHash,
  };
};

/**
 * Hash an incoming key with SHA-256 for secure database lookup
 */
export const hashApiKey = (key) => {
  if (!key || typeof key !== 'string') return '';
  return crypto.createHash('sha256').update(key.trim()).digest('hex');
};

/**
 * Verify whether an array of key scopes satisfies a required scope
 */
export const hasScope = (keyScopes = [], requiredScope) => {
  if (keyScopes.includes('*')) return true;
  if (keyScopes.includes(requiredScope)) return true;

  // Hierarchical wildcard e.g., 'links:*' covers 'links:read'
  const [resource] = requiredScope.split(':');
  if (keyScopes.includes(`${resource}:*`)) return true;

  return false;
};
