import dns from 'dns/promises';
import { isPrivateOrBlockedIp } from './ssrf.js';

const BLOCKED_DOMAINS = new Set([
  'localhost',
  'axly.in',
  's.axly.in',
  'api.axly.in',
  'app.axly.in',
  'admin.axly.in',
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

  if (BLOCKED_DOMAINS.has(clean)) {
    return { valid: false, reason: 'This domain is reserved by the platform and cannot be registered.' };
  }

  return { valid: true, domain: clean, normalized: clean };
};

/**
 * Perform DNS resolution check to verify custom domain ownership
 */
export const verifyDomainDns = async (domain, expectedToken) => {
  try {
    // 1. Check TXT record on _axly-verify.<domain>
    try {
      const txtRecords = await dns.resolveTxt(`_axly-verify.${domain}`);
      const flattened = txtRecords.flat();
      if (flattened.some(r => r.includes(expectedToken))) {
        return { verified: true, method: 'TXT', message: 'TXT ownership token verified.' };
      }
    } catch {
      // Continue to check CNAME
    }

    // 2. Check CNAME record on domain pointing to cname.axly.in
    try {
      const cnameRecords = await dns.resolveCname(domain);
      if (cnameRecords.some(c => c.toLowerCase().includes('axly.in') || c.toLowerCase().includes('cname.axly.in'))) {
        return { verified: true, method: 'CNAME', message: 'CNAME target successfully routed to Axly.' };
      }
    } catch {
      // Continue
    }

    return {
      verified: false,
      reason: `DNS records not detected. Configure a CNAME record pointing to 'cname.axly.in' or a TXT record at '_axly-verify.${domain}' with value '${expectedToken}'.`,
    };
  } catch (err) {
    return {
      verified: false,
      reason: `DNS verification probe encountered an error: ${err.message}`,
    };
  }
};
