import net from 'net';

// Helper to determine if an IPv4 address is in a private, loopback, or cloud-metadata range
const isPrivateIPv4 = (ip) => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 0.0.0.0/8
  if (parts[0] === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private network)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private network)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local / Cloud metadata, AWS/GCP/Azure)
  if (parts[0] === 169 && parts[1] === 254) return true;

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
    hostname === 'instance-data'
  ) {
    return { valid: false, error: 'Destination addresses pointing to local or internal hosts are restricted for security.' };
  }

  // If hostname is an IP address, check for private/loopback/cloud ranges
  const ipType = net.isIP(hostname);
  if (ipType === 4) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: 'Destination addresses pointing to private or metadata IP ranges are restricted.' };
    }
  } else if (ipType === 6) {
    // Loopback ::1, unique local fc00::/7, link-local fe80::/10
    if (
      hostname === '::1' ||
      hostname.startsWith('fc') ||
      hostname.startsWith('fd') ||
      hostname.startsWith('fe80')
    ) {
      return { valid: false, error: 'Private IPv6 destination addresses are restricted.' };
    }
  }

  return { valid: true, url: parsed.toString() };
};
