import net from 'net';

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
  const cleanIp = ip.toLowerCase().trim();

  // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (cleanIp.startsWith('::ffff:')) {
    const v4Part = cleanIp.substring(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateIPv4(v4Part);
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
    return { valid: false, error: 'URL must be a valid non-empty string.' };
  }

  let parsed;
  try {
    parsed = new URL(urlString.trim());
  } catch {
    return { valid: false, error: 'Malformed URL format.' };
  }

  // Enforce HTTP / HTTPS protocol only
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Invalid URL. Destination URL must use http: or https: protocol.' };
  }

  const hostname = parsed.hostname.toLowerCase();

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
    return { valid: false, error: 'Destination addresses pointing to local or internal hosts are restricted for security.' };
  }

  // If hostname is an IP address, check for private/loopback/cloud ranges
  if (net.isIP(hostname)) {
    if (isPrivateOrBlockedIp(hostname)) {
      return { valid: false, error: 'Destination addresses pointing to private or metadata IP ranges are restricted.' };
    }
  }

  return { valid: true, url: parsed.toString() };
};

