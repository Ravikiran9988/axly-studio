import dns from 'dns';
import http from 'http';
import https from 'https';
import { promisify } from 'util';
import { validateSafeDestinationUrl, isPrivateOrBlockedIp } from './ssrf.js';
import { query } from '../db/pool.js';

const dnsLookup = promisify(dns.lookup);
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 4000;

/**
 * Validate that all resolved DNS IP addresses for a hostname are strictly public
 */
export const verifyHostDnsSafety = async (hostname) => {
  try {
    const addresses = await dnsLookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { safe: false, error: 'DNS resolution failed: no IP addresses found' };
    }

    for (const addr of addresses) {
      if (isPrivateOrBlockedIp(addr.address)) {
        return { 
          safe: false, 
          error: `Restricted destination: resolved IP ${addr.address} belongs to private/internal infrastructure` 
        };
      }
    }

    return { safe: true, addresses };
  } catch (err) {
    return { safe: false, error: `DNS resolution error: ${err.message}` };
  }
};

/**
 * Perform a single safe HTTP/HTTPS probe with strict connection timeout and SSRF validation
 */
const probeSingleUrl = (urlString) => {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(urlString);
    } catch {
      return resolve({ statusCode: null, error: 'Invalid URL format', redirectUrl: null });
    }

    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const startTime = Date.now();
    let isResolved = false;

    const req = client.request(urlString, {
      method: 'GET', // or HEAD, but some servers block HEAD
      headers: {
        'User-Agent': 'Axly-LinkHealthMonitor/1.0 (+https://axly.in)',
        'Accept': '*/*',
      },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const responseTimeMs = Date.now() - startTime;
      const statusCode = res.statusCode;
      const location = res.headers.location;

      // Immediately consume and destroy stream to avoid buffering large payloads
      res.destroy();

      if (!isResolved) {
        isResolved = true;
        resolve({
          statusCode,
          responseTimeMs,
          redirectUrl: (statusCode >= 300 && statusCode < 400 && location) ? location : null,
          error: null,
        });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (!isResolved) {
        isResolved = true;
        resolve({ statusCode: null, responseTimeMs: TIMEOUT_MS, error: 'Connection timed out', redirectUrl: null });
      }
    });

    req.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        resolve({ statusCode: null, responseTimeMs: Date.now() - startTime, error: err.message, redirectUrl: null });
      }
    });

    req.end();
  });
};

/**
 * Execute an end-to-end SSRF-hardened URL health check, safely following redirects
 */
export const checkUrlHealth = async (targetUrl) => {
  let currentUrl = targetUrl;
  let redirectsCount = 0;
  const visitedUrls = new Set([targetUrl]);
  const startTime = Date.now();

  while (redirectsCount <= MAX_REDIRECTS) {
    // 1. Initial syntax & protocol verification
    const safeCheck = validateSafeDestinationUrl(currentUrl);
    if (!safeCheck.valid) {
      return {
        isHealthy: false,
        statusCode: null,
        responseTimeMs: Date.now() - startTime,
        errorReason: safeCheck.error,
        finalUrl: currentUrl,
      };
    }

    const parsed = new URL(currentUrl);

    // 2. Resolve DNS and verify that resolved IPs are public
    const dnsSafety = await verifyHostDnsSafety(parsed.hostname);
    if (!dnsSafety.safe) {
      return {
        isHealthy: false,
        statusCode: null,
        responseTimeMs: Date.now() - startTime,
        errorReason: dnsSafety.error,
        finalUrl: currentUrl,
      };
    }

    // 3. Perform network probe
    const probe = await probeSingleUrl(currentUrl);

    if (probe.error) {
      return {
        isHealthy: false,
        statusCode: probe.statusCode,
        responseTimeMs: Date.now() - startTime,
        errorReason: probe.error,
        finalUrl: currentUrl,
      };
    }

    // 4. Handle redirects safely
    if (probe.redirectUrl) {
      redirectsCount++;
      let nextUrl;
      try {
        nextUrl = new URL(probe.redirectUrl, currentUrl).toString();
      } catch {
        return {
          isHealthy: false,
          statusCode: probe.statusCode,
          responseTimeMs: Date.now() - startTime,
          errorReason: 'Malformed redirect Location header',
          finalUrl: currentUrl,
        };
      }

      if (visitedUrls.has(nextUrl)) {
        return {
          isHealthy: false,
          statusCode: probe.statusCode,
          responseTimeMs: Date.now() - startTime,
          errorReason: 'Redirect loop detected',
          finalUrl: nextUrl,
        };
      }

      visitedUrls.add(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    // Finished without redirect
    const isHealthy = probe.statusCode >= 200 && probe.statusCode < 400;
    return {
      isHealthy,
      statusCode: probe.statusCode,
      responseTimeMs: Date.now() - startTime,
      errorReason: isHealthy ? null : `HTTP status ${probe.statusCode}`,
      finalUrl: currentUrl,
    };
  }

  return {
    isHealthy: false,
    statusCode: 310,
    responseTimeMs: Date.now() - startTime,
    errorReason: `Exceeded maximum redirect limit (${MAX_REDIRECTS} hops)`,
    finalUrl: currentUrl,
  };
};

/**
 * Record link health check result in database and update URL health status
 */
export const recordLinkHealthCheck = async (urlId, targetUrl, result) => {
  try {
    const healthStatus = result.isHealthy
      ? 'healthy'
      : (result.statusCode >= 400 && result.statusCode < 500)
        ? 'degraded'
        : 'unreachable';

    await query(`
      INSERT INTO link_health_checks (
        url_id, target_url, status_code, response_time_ms, is_healthy, error_reason
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      urlId,
      targetUrl,
      result.statusCode,
      result.responseTimeMs,
      result.isHealthy,
      result.errorReason,
    ]);

    await query(`
      UPDATE urls 
      SET 
        last_health_check_at = NOW(),
        health_status = $1,
        health_status_code = $2,
        health_response_time_ms = $3,
        health_error = $4
      WHERE id = $5
    `, [
      healthStatus,
      result.statusCode,
      result.responseTimeMs,
      result.errorReason,
      urlId,
    ]);
  } catch (err) {
    console.error('recordLinkHealthCheck error:', err.message);
  }
};
