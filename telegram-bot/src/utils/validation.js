/**
 * URL and Input Validation Utilities for Axly Telegram Bot
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

/**
 * Validates whether a given string is a safe HTTP/HTTPS URL
 * @param {string} input 
 * @returns {{ valid: boolean, url?: string, error?: string }}
 */
export const validateUrl = (input) => {
  if (!input || typeof input !== 'string') {
    return { valid: false, error: 'URL cannot be empty.' };
  }

  const trimmed = input.trim();

  // Basic length sanity checks
  if (trimmed.length > 2048) {
    return { valid: false, error: 'URL is too long (maximum 2048 characters).' };
  }

  let parsed;
  try {
    // If user forgot protocol, test with https://
    const toParse = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    parsed = new URL(toParse);
  } catch {
    return { valid: false, error: 'Invalid URL format. Please provide a valid web address (e.g., https://example.com).' };
  }

  // Reject unsupported protocols
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS web URLs are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check hostname presence
  if (!hostname || !hostname.includes('.')) {
    return { valid: false, error: 'Please provide a valid domain name with an extension (e.g. .com, .in, .org).' };
  }

  // SSRF guard for loopback and cloud metadata
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: 'Localhost and internal network addresses cannot be shortened.' };
  }

  return { valid: true, url: parsed.href };
};

/**
 * Extract the first valid URL from user text
 * @param {string} text 
 * @returns {string|null}
 */
export const extractUrlFromText = (text) => {
  if (!text || typeof text !== 'string') return null;

  // Split tokens or match regex
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i;
  const match = text.match(urlRegex);

  if (!match) return null;

  const candidate = match[0].replace(/[.,!?;]+$/, ''); // Strip trailing punctuation
  const validation = validateUrl(candidate);

  return validation.valid ? validation.url : null;
};

/**
 * Check if a code matches the Axly Telegram linking code pattern (AX-XXXXXX)
 * @param {string} code 
 * @returns {boolean}
 */
export const isValidLinkCode = (code) => {
  if (!code || typeof code !== 'string') return false;
  const cleaned = code.trim().toUpperCase();
  return /^AX-[A-Z0-9]{4,16}$/.test(cleaned) || /^axly_tlink_[a-f0-9]{16,64}$/i.test(cleaned);
};
