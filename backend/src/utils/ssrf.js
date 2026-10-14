import net from 'node:net';
import dns from 'node:dns/promises';

// Helper to determine if an IPv4 address is in a private, loopback, or cloud-metadata range
export const isPrivateIPv4 = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (parts[0] === 10) return true;
  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 100.64.0.0/10 (Shared address space / Carrier-Grade NAT)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata, AWS/GCP/Azure/OCI)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 172.16.0.0/12 (Private network)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 0) return true;
  // 192.0.2.0/24 (Documentation TEST-NET-1)
  if (parts[0] === 192 && parts[1] === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (Private network)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (parts[0] === 198 && parts[1] === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (parts[0] === 203 && parts[1] === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (parts[0] >= 224 && parts[0] <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future use)
  if (parts[0] >= 240) return true;
  // 255.255.255.255/32 (Broadcast)
  if (ip === '255.255.255.255') return true;

  return false;
};

// Check if an IP (IPv4 or IPv6 or IPv4-mapped IPv6) is blocked / private
export const isPrivateOrBlockedIp = (ip) => {
  if (!ip || typeof ip !== 'string') return true;
  const cleanIp = ip.toLowerCase().trim().replace(/^\[|\]$/g, '');

  // Handle IPv4-mapped IPv6 in dotted form (::ffff:127.0.0.1).
  if (cleanIp.startsWith('::ffff:')) {
    const v4Part = cleanIp.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
    }

    // Also handle the hexadecimal form, e.g. ::ffff:7f00:1 (127.0.0.1).
    const mappedHex = cleanIp.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16);
      const low = Number.parseInt(mappedHex[2], 16);
      const mappedV4 = `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
      return isPrivateIPv4(mappedV4);
    }
  }

  const ipType = net.isIP(cleanIp);
  if (ipType === 4) {
    return isPrivateIPv4(cleanIp);
  }

  if (ipType === 6) {
    // ::1 (Loopback)
    if (cleanIp === '::1' || cleanIp === '::') return true;
    // fe80::/10 (Link-local)
    if (cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) return true;
    // fc00::/7 (Unique local)
    if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd')) return true;
    // ff00::/8 (Multicast)
    if (cleanIp.startsWith('ff')) return true;
    // 2001:db8::/32 (Documentation)
    if (cleanIp.startsWith('2001:db8')) return true;
  }

  return false;
};

// Validate that a user-supplied destination URL is safe from SSRF and protocol exploits
export const validateSafeDestinationUrl = (urlString) => {
  if (!urlString || typeof urlString !== 'string') {
    const msg = 'URL must be a valid non-empty string.';
    return { valid: false, error: msg, reason: msg };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    const msg = 'Malformed URL format.';
    return { valid: false, error: msg, reason: msg };
  }

  // Enforce HTTP / HTTPS protocol only
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const msg = 'Invalid URL. Destination URL must use http: or https: protocol.';
    return { valid: false, error: msg, reason: msg };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');

  // Reject local/internal domain names
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'instance-data' ||
    hostname === 'metadata'
  ) {
    const msg = 'Destination addresses pointing to local or internal hosts are restricted for security.';
    return { valid: false, error: msg, reason: msg };
  }

  // If hostname is an IP address, check for private/loopback/cloud ranges
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      const msg = 'Destination addresses pointing to private or metadata IP ranges are restricted.';
      return { valid: false, error: msg, reason: msg };
    }
  }

  return { valid: true, url: parsed.toString() };
};


/**
 * Resolve a webhook hostname and reject every non-public address before connecting.
 * The returned address list is intended to be pinned by the caller so the HTTP client
 * cannot resolve the hostname again after validation (DNS-rebinding protection).
 * A custom lookup function can be injected by tests.
 */
export const resolveSafeDestinationUrl = async (urlString, lookup = dns.lookup) => {
  const validation = validateSafeDestinationUrl(urlString);
  if (!validation.valid) return validation;

  const parsed = new URL(validation.url);
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  const literalFamily = net.isIP(hostname);

  if (literalFamily) {
    if (isPrivateOrBlockedIp(hostname)) {
      const msg = 'Destination addresses pointing to private or metadata IP ranges are restricted.';
      return { valid: false, error: msg, reason: msg };
    }
    return {
      ...validation,
      addresses: [{ address: hostname, family: literalFamily }],
    };
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    const msg = 'Webhook hostname could not be resolved safely.';
    return { valid: false, error: msg, reason: msg };
  }

  if (!Array.isArray(resolved) || resolved.length === 0) {
    const msg = 'Webhook hostname did not resolve to any IP addresses.';
    return { valid: false, error: msg, reason: msg };
  }

  const addresses = resolved.map(({ address, family }) => ({
    address,
    family: family || net.isIP(address),
  }));

  // Reject mixed answer sets as well: a hostname with any private answer is unsafe.
  if (addresses.some(({ address }) => isPrivateOrBlockedIp(address))) {
    const msg = 'Webhook hostname resolves to a private or restricted IP address.';
    return { valid: false, error: msg, reason: msg };
  }

  return { ...validation, addresses };
};
