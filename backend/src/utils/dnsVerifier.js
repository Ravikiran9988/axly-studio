import dns from 'dns/promises';
import { isPrivateOrBlockedIp } from './ssrf.js';

const BLOCKED_DOMAINS = new Set([
  'localhost',
  'axly.in',
  's.axly.in',
  'api.axly.in',
  'app.axly.in',
  'admin.axly.in',
  'url.axly.in',
  'cname.axly.in',
  'axly-api.onrender.com',
  'example.com',
  'test.com',
  'google.com',
  'github.com',
]);

/**
 * Validate syntax and safety of a custom hostname
 */
export const validateDomainSyntax = (rawDomain) => {
  if (!rawDomain || typeof rawDomain !== 'string') {
    return { valid: false, reason: 'Domain name is required.' };
  }

  // Strip protocol and ports if user entered them
  let clean = rawDomain.trim().toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/:\d+$/, '')
    .replace(/\/.*$/, '');

  // Strip trailing dot
  clean = clean.replace(/\.$/, '');

  if (clean.length < 3 || clean.length > 253) {
    return { valid: false, reason: 'Domain length must be between 3 and 253 characters.' };
  }

  // FQDN validation regex
  const fqdnRegex = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.[a-zA-Z0-9-]{1,63}(?<!-))*\.[a-zA-Z]{2,24}$/;
  if (!fqdnRegex.test(clean)) {
    return { valid: false, reason: 'Invalid domain syntax. Must be a valid fully-qualified domain name (e.g. links.mybrand.com).' };
  }

  if (BLOCKED_DOMAINS.has(clean) || clean === 'axly.in' || clean.endsWith('.axly.in')) {
    return { valid: false, reason: 'This domain is reserved by the platform and cannot be registered.' };
  }

  return { valid: true, domain: clean, normalized: clean };
};

/**
 * Perform DNS resolution check to verify custom domain ownership
 */
export const verifyDomainDns = async (domain, expectedToken, expectedTarget = 'cname.axly.in') => {
  const cleanTarget = String(expectedTarget || '').toLowerCase().replace(/\.$/, '');
  try {
    let cnameRecords = [];
    try {
      cnameRecords = (await dns.resolveCname(domain)).map(record => record.toLowerCase().replace(/\.$/, ''));
    } catch {
      // No CNAME record or DNS not propagated.
    }

    // A TXT ownership token alone must not mark a domain as routed: traffic also needs
    // to arrive at the configured frontend/backend target.
    if (cleanTarget && cnameRecords.includes(cleanTarget)) {
      return { verified: true, method: 'CNAME', message: 'CNAME target exactly matches the configured Axly service.' };
    }

    let txtFound = false;
    try {
      const txtRecords = await dns.resolveTxt('_axly-verify.' + domain);
      txtFound = txtRecords.flat().some(record => record.trim() === expectedToken);
    } catch {
      // Continue with a useful routing-specific error.
    }

    return {
      verified: false,
      reason: txtFound
        ? "Ownership TXT record is present, but the CNAME must point exactly to '" + cleanTarget + "' before traffic can be routed."
        : "DNS record not detected. Configure a CNAME for '" + domain + "' pointing to '" + cleanTarget + "'. You may also add TXT '" + expectedToken + "' at '_axly-verify." + domain + "' for ownership evidence.",
    };
  } catch (err) {
    return { verified: false, reason: 'DNS verification probe encountered an error: ' + err.message };
  }
};
