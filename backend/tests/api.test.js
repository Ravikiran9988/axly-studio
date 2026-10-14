import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index.js';
import pool, { closePool } from '../src/db/pool.js';
import { config, validateEnv } from '../src/config/env.js';
import { validateSafeDestinationUrl } from '../src/utils/ssrf.js';
import { generateApiKey, hashApiKey } from '../src/utils/apiKey.js';
import { signWebhookPayload } from '../src/utils/webhookDispatcher.js';
import { validateDomainSyntax } from '../src/utils/dnsVerifier.js';
import { normalizePageSlug, sanitizePageBlocks } from '../src/controllers/pageController.js';

describe('Custom Page Builder validation', () => {
  test('accepts valid public page slugs and normalizes case', () => {
    assert.deepEqual(normalizePageSlug('Ravi-Kiran'), { valid: true, slug: 'ravi-kiran' });
  });

  test('rejects reserved or malformed public page slugs', () => {
    assert.equal(normalizePageSlug('api').valid, false);
    assert.equal(normalizePageSlug('ab').valid, false);
    assert.equal(normalizePageSlug('-bad-slug').valid, false);
    assert.equal(normalizePageSlug('has spaces').valid, false);
  });

  test('accepts safe link blocks and preserves explicit ordering', () => {
    const result = sanitizePageBlocks([
      { id: 'portfolio', type: 'link', label: 'Portfolio', url: 'https://example.org', visible: true },
      { id: 'about', type: 'text', text: 'Developer and builder', visible: true },
    ]);
    assert.equal(result.valid, true);
    assert.equal(result.blocks.length, 2);
    assert.equal(result.blocks[0].url, 'https://example.org/');
    assert.equal(result.blocks[1].text, 'Developer and builder');
  });

  test('rejects unsafe URLs and unsupported public block types', () => {
    assert.equal(sanitizePageBlocks([
      { id: 'bad-link', type: 'link', label: 'Unsafe', url: 'javascript:alert(1)' },
    ]).valid, false);
    assert.equal(sanitizePageBlocks([
      { id: 'bad-block', type: 'raw-html', html: '<script>alert(1)</script>' },
    ]).valid, false);
  });

  test('rejects duplicate block IDs and oversized block collections', () => {
    assert.equal(sanitizePageBlocks([
      { id: 'same', type: 'text', text: 'First' },
      { id: 'same', type: 'text', text: 'Second' },
    ]).valid, false);
    assert.equal(sanitizePageBlocks(Array.from({ length: 41 }, (_, i) => ({
      id: 'text-' + i, type: 'text', text: 'Content',
    }))).valid, false);
  });
});


describe('Production environment validation', () => {
  test('requires a strong VISITOR_SALT in production', () => {
    const keys = ['NODE_ENV', 'JWT_SECRET', 'DATABASE_URL', 'DB_PASSWORD', 'VISITOR_SALT'];
    const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

    try {
      process.env.NODE_ENV = 'production';
      process.env.JWT_SECRET = 'ci_test_jwt_secret_that_is_long_enough_123';
      process.env.DB_PASSWORD = 'test-db-password';
      delete process.env.DATABASE_URL;
      delete process.env.VISITOR_SALT;

      assert.throws(() => validateEnv(), /VISITOR_SALT/);

      process.env.VISITOR_SALT = 'a-unique-random-visitor-salt-for-tests-2026';
      assert.doesNotThrow(() => validateEnv());

      process.env.VISITOR_SALT = 'short';
      assert.throws(() => validateEnv(), /VISITOR_SALT/);
    } finally {
      for (const key of keys) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  });
});

describe('Axly URL Shortener API Tests', () => {
  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testToken = jwt.sign(
    { id: testUserId, email: 'test@axly.in', name: 'Tester' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  // Mock pool.connect to return a mock client backed by pool.query for transaction safety
  const originalConnect = pool.connect;
  pool.connect = async () => ({
    query: async (text, params) => pool.query(text, params),
    release: () => {},
  });

  test('GET /api/health returns health status', async () => {
    const originalQuery = pool.query;
    pool.query = async () => ({ rows: [{ '?column?': 1 }] });
    try {
      const res = await request(app).get('/api/health');
      assert.ok(res.body.timestamp);
      assert.equal(res.body.version, '1.0.0');
      assert.equal(res.status, 200);
    } finally {
      pool.query = originalQuery;
    }
  });

  describe('Authentication & Validation', () => {
    test('POST /api/auth/register rejects invalid emails', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User', email: 'invalid-email', password: 'password123' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /valid email/i);
    });

    test('POST /api/auth/register rejects short passwords (< 8 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User', email: 'valid@example.com', password: '123' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /at least 8 characters/i);
    });

    test('POST /api/auth/register rejects excessively long passwords (> 128 chars)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: 'User', email: 'valid@example.com', password: 'a'.repeat(129) });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /cannot exceed 128/i);
    });

    test('POST /api/auth/login rejects empty email or password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: '', password: '' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
    });

    test('GET /api/auth/me rejects requests without token', async () => {
      const res = await request(app).get('/api/auth/me');
      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });

    test('GET /api/auth/me rejects requests with invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      assert.equal(res.status, 401);
      assert.equal(res.body.success, false);
    });
  });

  describe('URL Creation & Custom Aliases', () => {
    test('POST /api/urls rejects missing URL', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({});

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /URL is required/i);
    });

    test('POST /api/urls rejects non-http protocols (e.g. javascript:)', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'javascript:alert(1)' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /Invalid URL/i);
    });

    test('POST /api/urls allows guests to shorten ordinary URLs', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('INSERT INTO urls')) {
          return {
            rows: [{
              id: 'guest-1',
              short_code: 'gst123',
              original_url: 'https://example.com',
              user_id: null,
              click_count: 0,
              created_at: new Date(),
            }]
          };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls')
          .send({ url: 'https://example.com' });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.is_guest, true);
        assert.ok(res.body.data.short_url.includes('gst123'));
      } finally {
        pool.query = originalQuery;
      }
    });

    test('POST /api/urls rejects guest attempts to use customAlias with unlock prompt', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com', customAlias: 'my-brand' });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.unlock_prompt, true);
      assert.match(res.body.message, /Axly Studio account/i);
    });

    test('POST /api/urls rejects guest attempts to use expiresAt with unlock prompt', async () => {
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com', expiresAt: futureDate });

      assert.equal(res.status, 403);
      assert.equal(res.body.success, false);
      assert.equal(res.body.unlock_prompt, true);
      assert.match(res.body.message, /Axly Studio account/i);
    });

    test('POST /api/urls rejects reserved custom aliases for authenticated users', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ url: 'https://example.com', customAlias: 'login' });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /reserved by the system/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('POST /api/urls rejects invalid custom alias format for authenticated users', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ url: 'https://example.com', customAlias: 'hi' }); // < 3 chars

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /3-30 characters/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('POST /api/urls rejects past expiration date for authenticated users', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      const pastDate = new Date(Date.now() - 3600000).toISOString();
      try {
        const res = await request(app)
          .post('/api/urls')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ url: 'https://example.com', expiresAt: pastDate });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /must be in the future/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Partial Updates & Expiration Bug Regression', () => {
    test('PATCH /api/urls/:id rejects invalid status values', async () => {
      // Mock pool.query to simulate existing link
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id, expires_at')) {
          return { rows: [{ id: 'url-1', expires_at: new Date('2030-01-01'), status: 'active', title: 'Old' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch('/api/urls/url-1')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ status: 'unsupported_status' });

        assert.equal(res.status, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Status must be active or inactive/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('PATCH /api/urls/:id preserves expires_at when expiresAt is omitted', async () => {
      const originalQuery = pool.query;
      let executedQuery = '';
      let executedParams = [];

      const initialExpiry = new Date('2030-01-01T00:00:00.000Z');

      pool.query = async (text, params) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id, expires_at, status, title FROM urls')) {
          return { rows: [{ id: 'url-1', expires_at: initialExpiry, status: 'active', title: 'Original' }] };
        }
        if (text.includes('UPDATE urls')) {
          executedQuery = text;
          executedParams = params;
          return {
            rows: [{
              id: 'url-1',
              short_code: 'abc',
              title: 'Updated Title',
              status: 'active',
              expires_at: initialExpiry,
              click_count: 0,
            }]
          };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch('/api/urls/url-1')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ title: 'Updated Title' }); // Note: expiresAt is omitted!

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.title, 'Updated Title');
        // Critical: Verify that UPDATE statement did NOT set expires_at = NULL
        assert.ok(!executedQuery.includes('expires_at = $'), 'Omitted expiresAt must NOT be in the UPDATE query');
        assert.ok(!executedQuery.includes('expires_at = NULL'), 'Omitted expiresAt must NOT set NULL');
        assert.equal(res.body.data.expires_at, initialExpiry.toISOString());
      } finally {
        pool.query = originalQuery;
      }
    });

    test('PATCH /api/urls/:id clears expires_at when expiresAt is explicitly null', async () => {
      const originalQuery = pool.query;
      let executedQuery = '';

      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id, expires_at, status, title FROM urls')) {
          return { rows: [{ id: 'url-1', expires_at: new Date(), status: 'active', title: 'Original' }] };
        }
        if (text.includes('UPDATE urls')) {
          executedQuery = text;
          return {
            rows: [{
              id: 'url-1',
              short_code: 'abc',
              title: 'Original',
              status: 'active',
              expires_at: null,
              click_count: 0,
            }]
          };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch('/api/urls/url-1')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ expiresAt: null });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(executedQuery.includes('expires_at = NULL'), 'Explicit null must set expires_at = NULL');
        assert.equal(res.body.data.expires_at, null);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Redirection Security', () => {
    test('GET /:shortCode returns 404 for nonexistent link', async () => {
      const originalQuery = pool.query;
      pool.query = async () => ({ rows: [] });

      try {
        const res = await request(app).get('/nonexistent_code_123');
        assert.equal(res.status, 404);
        assert.match(res.text, /Link Not Found/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('GET /:shortCode returns 410 for disabled link', async () => {
      const originalQuery = pool.query;
      pool.query = async () => ({
        rows: [{ id: 'url-1', original_url: 'https://example.com', status: 'inactive', expires_at: null }]
      });

      try {
        const res = await request(app).get('/disabled_link');
        assert.equal(res.status, 410);
        assert.match(res.text, /Link Disabled/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('GET /:shortCode redirects with 302 to destination when active', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('SELECT id, original_url')) {
          return {
            rows: [{
              id: 'url-1',
              original_url: 'https://target-destination.com/page',
              status: 'active',
              expires_at: null
            }]
          };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app).get('/valid_code');
        assert.equal(res.status, 302);
        assert.equal(res.header.location, 'https://target-destination.com/page');
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    const normalUserToken = jwt.sign(
      { id: '22222222-2222-2222-2222-222222222222', email: 'member@axly.in', role: 'user' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const adminToken = jwt.sign(
      { id: '33333333-3333-3333-3333-333333333333', email: 'admin@axly.in', role: 'admin' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    test('GET /api/admin/stats rejects non-admin users with 403 Forbidden', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: '22222222-2222-2222-2222-222222222222', is_active: true, role: 'user', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${normalUserToken}`);

        assert.equal(res.status, 403);
        assert.match(res.body.message, /Forbidden/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('GET /api/admin/stats grants access to admin users', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: '33333333-3333-3333-3333-333333333333', is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('total_users')) {
          return { rows: [{ total_users: 12, active_users: 10, suspended_users: 2, admin_users: 2 }] };
        }
        if (text.includes('total_urls')) {
          return { rows: [{ total_urls: 48, active_urls: 40, disabled_urls: 8, expired_urls: 0, guest_urls: 5 }] };
        }
        if (text.includes('COALESCE(SUM(click_count)')) {
          return { rows: [{ total_clicks: 1200, unique_clicks: 800 }] };
        }
        if (text.includes('click_events')) {
          return { rows: [{ count: 150 }] };
        }
        if (text.includes('link_reports')) {
          return { rows: [{ pending_reports: 1, reviewing_reports: 0, resolved_reports: 4 }] };
        }
        if (text.includes('health_status')) {
          return { rows: [{ healthy_links: 45, degraded_links: 2, unreachable_links: 1 }] };
        }
        if (text.includes('FROM urls u')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .get('/api/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.totalUsers, 12);
        assert.equal(res.body.data.totalUrls, 48);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('PATCH /api/admin/users/:id/role rejects invalid role names', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: '33333333-3333-3333-3333-333333333333', is_active: true, role: 'admin', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch('/api/admin/users/user-123/role')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'super_owner' });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /Invalid role/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 2: SSRF & Destination Safety Protection', () => {
    test('rejects localhost and loopback addresses', () => {
      assert.equal(validateSafeDestinationUrl('http://localhost:3000').valid, false);
      assert.equal(validateSafeDestinationUrl('http://127.0.0.1:8080').valid, false);
      assert.equal(validateSafeDestinationUrl('http://127.0.0.2/test').valid, false);
    });

    test('rejects AWS/GCP/Azure link-local cloud metadata address (169.254.169.254)', () => {
      const res = validateSafeDestinationUrl('http://169.254.169.254/latest/meta-data/');
      assert.equal(res.valid, false);
      assert.match(res.error, /restricted/i);
    });

    test('rejects RFC1918 private IPv4 networks (10.x, 172.16-31.x, 192.168.x)', () => {
      assert.equal(validateSafeDestinationUrl('http://10.0.0.5/api').valid, false);
      assert.equal(validateSafeDestinationUrl('https://172.20.10.2/admin').valid, false);
      assert.equal(validateSafeDestinationUrl('http://192.168.1.1/setup').valid, false);
    });

    test('accepts safe external public destinations', () => {
      assert.equal(validateSafeDestinationUrl('https://github.com/Ravikiran9988/axly-url-shortener').valid, true);
      assert.equal(validateSafeDestinationUrl('https://example.com/blog?article=123').valid, true);
    });
  });

  describe('Phase 2: Campaign and UTM Management', () => {
    test('POST /api/campaigns rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .send({ name: 'Q4 Product Launch' });
      assert.equal(res.status, 401);
    });

    test('POST /api/campaigns creates a campaign for authenticated user', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('INSERT INTO campaigns')) {
          return {
            rows: [{
              id: 'camp-123',
              user_id: testUserId,
              name: 'Spring Marketing 2026',
              utm_source: 'newsletter',
              utm_medium: 'email',
              created_at: new Date(),
            }]
          };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/campaigns')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            name: 'Spring Marketing 2026',
            utmSource: 'newsletter',
            utmMedium: 'email',
          });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.equal(res.body.data.name, 'Spring Marketing 2026');
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 2: Smart Redirect Rules Management', () => {
    test('POST /api/urls/:urlId/rules validates device rule matchValue', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id FROM urls WHERE id = $1 AND user_id = $2')) {
          return { rows: [{ id: 'url-1' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/url-1/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            ruleType: 'device',
            matchValue: 'fridge', // Invalid device
            destinationUrl: 'https://example.com/mobile',
          });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /must be "mobile", "desktop", or "tablet"/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('POST /api/urls/:urlId/rules rejects SSRF attempts in rule destination', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id FROM urls WHERE id = $1 AND user_id = $2')) {
          return { rows: [{ id: 'url-1' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/url-1/rules')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            ruleType: 'device',
            matchValue: 'mobile',
            destinationUrl: 'http://169.254.169.254/secret',
          });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /restricted/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 2: A/B Experiments & Conversion Tracking', () => {
    test('POST /api/experiments requires at least 2 variants', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/experiments')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            urlId: 'url-1',
            name: 'Hero CTA Test',
            variants: [{ name: 'A', destinationUrl: 'https://example.com/a' }],
          });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /at least 2 destination variants/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 2: Bulk Link Actions & CSV Processing', () => {
    test('POST /api/urls/bulk requires non-empty array of URL IDs', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/bulk')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ action: 'delete', urlIds: [] });

        assert.equal(res.status, 400);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('POST /api/urls/bulk-import validates row-level destinations', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: testUserId, is_active: true, role: 'user' }] };
        }
        if (text.includes('INSERT INTO urls')) {
          return { rows: [{ id: 'url-mock', short_code: 'abc', original_url: 'https://example.com/valid', title: 'Test', status: 'active', created_at: new Date() }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/bulk-import')
          .set('Authorization', `Bearer ${testToken}`)
          .send({
            rows: [
              { originalUrl: 'https://example.com/valid' },
              { originalUrl: 'http://127.0.0.1/malicious' },
            ]
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.total, 2);
        assert.equal(res.body.failedCount, 1);
        assert.equal(res.body.errors[0].row, 2);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 3: Admin Control Center, Moderation & Operations', () => {
    const adminUserId = '33333333-3333-3333-3333-333333333333';
    const normalUserId = '22222222-2222-2222-2222-222222222222';
    const targetUserId = '44444444-4444-4444-4444-444444444444';

    const adminToken = jwt.sign(
      { id: adminUserId, email: 'admin@axly.in', role: 'admin', token_version: 1 },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    const normalUserToken = jwt.sign(
      { id: normalUserId, email: 'user@axly.in', role: 'user', token_version: 1 },
      config.jwt.secret,
      { expiresIn: '1h' }
    );

    test('Non-admin users are blocked with 403 from all admin endpoints', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: normalUserId, is_active: true, role: 'user', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const endpoints = [
          '/api/admin/users',
          '/api/admin/urls',
          '/api/admin/moderation/reports',
          '/api/admin/health',
          '/api/admin/settings',
          '/api/admin/audit',
        ];

        for (const ep of endpoints) {
          const res = await request(app)
            .get(ep)
            .set('Authorization', `Bearer ${normalUserToken}`);
          assert.equal(res.status, 403, `Expected 403 on ${ep}`);
          assert.match(res.body.message, /Forbidden/i);
        }
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Session revocation rejects requests with older token_version', async () => {
      const originalQuery = pool.query;
      // Database has token_version = 2, but client JWT has token_version = 1
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: normalUserId, is_active: true, role: 'user', token_version: 2 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .get('/api/urls')
          .set('Authorization', `Bearer ${normalUserToken}`);

        assert.equal(res.status, 401);
        assert.match(res.body.message, /Session invalidated/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Suspended user account is rejected by authentication middleware', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: normalUserId, is_active: false, role: 'user', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .get('/api/urls')
          .set('Authorization', `Bearer ${normalUserToken}`);

        assert.equal(res.status, 403);
        assert.match(res.body.message, /Account is disabled/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Self-demotion is strictly prevented for administrators', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch(`/api/admin/users/${adminUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'user' });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /revoke your own administrator|demote/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Demoting the last active administrator is strictly blocked', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        // Count active admins is 1
        if (text.includes('COUNT(*)::int as count FROM users WHERE role')) {
          return { rows: [{ count: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch(`/api/admin/users/${targetUserId}/role`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ role: 'user' });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /last active administrator/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Suspending the last active administrator is strictly blocked', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('SELECT role, is_active FROM users WHERE id = $1')) {
          return { rows: [{ role: 'admin', is_active: true }] };
        }
        if (text.includes('COUNT(*)::int as count FROM users WHERE role')) {
          return { rows: [{ count: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .patch(`/api/admin/users/${targetUserId}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ isActive: false, reason: 'Test lock' });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /suspend the last active administrator/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can revoke user sessions and audit the action', async () => {
      let auditLogged = false;
      let tokenVersionIncremented = false;
      const originalQuery = pool.query;
      pool.query = async (text, params) => {
        if (text.includes('token_version FROM users WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('UPDATE users SET token_version = token_version + 1')) {
          tokenVersionIncremented = true;
          return { rows: [{ id: targetUserId, email: 'target@axly.in', token_version: 2 }] };
        }
        if (text.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          return { rows: [{ id: 'audit-1' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post(`/api/admin/users/${targetUserId}/revoke-sessions`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ reason: 'Security check' });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(tokenVersionIncremented, true);
        assert.equal(auditLogged, true);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Public visitor can submit abuse report for a valid short code', async () => {
      const originalQuery = pool.query;
      let insertedReport = false;
      pool.query = async (text, params) => {
        if (text.includes('FROM urls WHERE short_code = $1')) {
          return { rows: [{ id: 'url-rep-1', short_code: 'rep123', original_url: 'https://example.com/bad' }] };
        }
        if (text.includes('INSERT INTO link_reports')) {
          insertedReport = true;
          return { rows: [{ id: 'rep-id-1', short_code: 'rep123', status: 'pending', created_at: new Date() }] };
        }
        if (text.includes('COUNT(*)::int as count FROM link_reports')) {
          return { rows: [{ count: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/reports')
          .send({
            shortCode: 'rep123',
            reason: 'phishing',
            details: 'This link impersonates a banking login page.',
          });

        assert.equal(res.status, 201);
        assert.equal(res.body.success, true);
        assert.equal(insertedReport, true);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Public report rejects non-existent short codes', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('SELECT id, short_code, original_url FROM urls') || text.includes('FROM urls WHERE short_code = $1')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/reports')
          .send({
            shortCode: 'ghost-code',
            reason: 'malware',
            details: 'Dangerous download.',
          });

        assert.equal(res.status, 404);
        assert.equal(res.body.success, false);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Platform settings endpoint validates limits and audits configuration updates', async () => {
      let auditLogged = false;
      const originalQuery = pool.query;
      pool.query = async (text, params) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('INSERT INTO platform_settings')) {
          return { rows: [] };
        }
        if (text.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          return { rows: [{ id: 'audit-settings' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .put('/api/admin/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            settings: {
              guest_creation_limit_daily: 25,
              authenticated_max_links_total: 1000,
              max_url_length: 4096,
            }
          });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(auditLogged, true);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Platform settings endpoint rejects invalid setting values', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .put('/api/admin/settings')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            settings: {
              max_url_length: -50,
            }
          });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /numeric value|positive integer/i);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can retrieve system diagnostics, connection stats and table counts', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('current_database()')) {
          return { rows: [{ db_time: new Date(), db_version: 'PostgreSQL 16.1', db_name: 'test_db', active_connections: 3 }] };
        }
        if (text.includes('COUNT(*)::int FROM users')) {
          return { rows: [{ users_count: 42, urls_count: 100, clicks_count: 500 }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .get('/api/admin/system/diagnostics')
          .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.database);
        assert.ok(res.body.data.runtime);
        assert.equal(res.body.data.database.status, 'healthy');
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can perform instant database ping test', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        return { rows: [{ '?column?': 1 }] };
      };

      try {
        const res = await request(app)
          .post('/api/admin/system/ping')
          .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.status, 'operational');
        assert.ok(typeof res.body.latencyMs === 'number');
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can trigger expired guest links maintenance cleanup', async () => {
      const originalQuery = pool.query;
      let auditLogged = false;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('DELETE FROM urls WHERE user_id IS NULL AND expires_at < NOW()')) {
          return { rows: [{ id: 'url-1' }, { id: 'url-2' }] };
        }
        if (text.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          return { rows: [{ id: 'audit-cleanup' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/admin/system/cleanup')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ target: 'expired_guest_links' });

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.deletedCount, 2);
        assert.equal(auditLogged, true);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can manage firewall blocklist and test URLs against firewall', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('token_version') || text.includes('WHERE id = $1')) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes("FROM platform_settings WHERE key = 'banned_domains'")) {
          return { rows: [{ value: [{ domain: 'phish-threat.com', reason: 'Phishing' }] }] };
        }
        if (text.includes('INSERT INTO platform_settings') || text.includes('INSERT INTO audit_logs')) {
          return { rows: [] };
        }
        if (text.includes('FROM custom_domains cd')) {
          return { rows: [] };
        }
        return { rows: [] };
      };

      try {
        // Test URL evaluation
        const testRes = await request(app)
          .post('/api/admin/firewall/test')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ targetUrl: 'https://phish-threat.com/steal-creds' });

        assert.equal(testRes.status, 200);
        assert.equal(testRes.body.data.isBlocked, true);
        assert.equal(testRes.body.data.status, 'BLOCKED_BY_FIREWALL');

        // Test safe URL
        const safeRes = await request(app)
          .post('/api/admin/firewall/test')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ targetUrl: 'https://trusted-site.org/docs' });

        assert.equal(safeRes.status, 200);
        assert.equal(safeRes.body.data.isBlocked, false);
        assert.equal(safeRes.body.data.status, 'ALLOWED');
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Admin can generate user support recovery token', async () => {
      const originalQuery = pool.query;
      let auditLogged = false;
      pool.query = async (text) => {
        if (text.includes('token_version') || (text.includes('WHERE id = $1') && !text.includes('target@axly.in'))) {
          return { rows: [{ id: adminUserId, is_active: true, role: 'admin', token_version: 1 }] };
        }
        if (text.includes('SELECT id, name, email, is_active FROM users WHERE id = $1')) {
          return { rows: [{ id: targetUserId, name: 'Target User', email: 'target@axly.in', is_active: true }] };
        }
        if (text.includes('INSERT INTO audit_logs')) {
          auditLogged = true;
          return { rows: [{ id: 'audit-token' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post(`/api/admin/users/${targetUserId}/reset-token`)
          .set('Authorization', `Bearer ${adminToken}`);

        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.data.token);
        assert.ok(res.body.data.recoveryUrl);
        assert.equal(auditLogged, true);
      } finally {
        pool.query = originalQuery;
      }
    });

    test('Public broadcast announcement endpoint returns null when disabled', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes("FROM platform_settings WHERE key = 'system_announcement_banner'")) {
          return { rows: [{ value: { enabled: false, message: 'Maintenance' } }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app).get('/api/announcement');
        assert.equal(res.status, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.announcement, null);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Phase 4: Developer Platform, Teams, Custom Domains & Production Readiness', () => {
    describe('Production Probes & Liveness', () => {
      test('GET /healthz returns 200 OK with liveness indicator', async () => {
        const res = await request(app).get('/healthz');
        assert.equal(res.status, 200);
        assert.equal(res.body.status, 'ok');
        assert.equal(res.body.liveness, true);
        assert.ok(res.body.timestamp);
      });

      test('GET /readyz returns 200 OK when database is connected', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
          return { rows: [] };
        };

        try {
          const res = await request(app).get('/readyz');
          assert.equal(res.status, 200);
          assert.equal(res.body.status, 'ready');
          assert.equal(res.body.database, 'connected');
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Developer Platform & API Keys', () => {
      test('generateApiKey generates correct prefix and high entropy string', () => {
        const { key, prefix, hash } = generateApiKey();
        assert.ok(key.startsWith('axly_live_'));
        assert.equal(key.length, 58);
        assert.equal(prefix, key.substring(0, 14));
        assert.equal(hash, hashApiKey(key));
      });

      test('POST /api/keys creates a key and returns plaintext key only once', async () => {
        const originalQuery = pool.query;
        let insertedScopes = null;
        pool.query = async (text, params) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('INSERT INTO api_keys')) {
            insertedScopes = params[5];
            return {
              rows: [{
                id: 'key-test-1',
                name: 'CI/CD Pipeline',
                key_prefix: 'axly_live_abc1',
                scopes: insertedScopes,
                rate_limit_per_minute: 120,
                expires_at: null,
                created_at: new Date(),
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post('/api/keys')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
              name: 'CI/CD Pipeline',
              scopes: ['links:read', 'links:write'],
              rateLimitPerMinute: 120,
            });

          assert.equal(res.status, 201);
          assert.equal(res.body.success, true);
          assert.ok(res.body.apiKey.key.startsWith('axly_live_'));
          assert.deepEqual(res.body.apiKey.scopes, ['links:read', 'links:write']);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('GET /api/keys lists keys without exposing secrets or hashes', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('FROM api_keys')) {
            return {
              rows: [{
                id: 'key-1',
                name: 'Production Key',
                key_prefix: 'axly_live_1234',
                scopes: ['links:read'],
                rate_limit_per_minute: 60,
                is_revoked: false,
                last_used_at: null,
                created_at: new Date(),
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .get('/api/keys')
            .set('Authorization', `Bearer ${testToken}`);

          assert.equal(res.status, 200);
          assert.equal(res.body.success, true);
          assert.equal(res.body.apiKeys.length, 1);
          assert.equal(res.body.apiKeys[0].key_prefix, 'axly_live_1234');
          assert.equal(res.body.apiKeys[0].key_hash, undefined);
          assert.equal(res.body.apiKeys[0].key, undefined);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('API Key authentication allows programmatic access with valid scope', async () => {
        const { key, hash } = generateApiKey();
        const originalQuery = pool.query;
        pool.query = async (text, params) => {
          if (text.includes('FROM api_keys k') && text.includes('JOIN users u')) {
            return {
              rows: [{
                id: 'key-abc',
                name: 'Service Key',
                key_hash: hash,
                scopes: ['links:read'],
                rate_limit_per_minute: 60,
                is_revoked: false,
                expires_at: null,
                user_id: testUserId,
                workspace_id: null,
                user_email: 'test@axly.in',
                user_name: 'Tester',
                user_role: 'user',
                user_active: true,
                is_active: true,
              }]
            };
          }
          if (text.includes('UPDATE api_keys SET last_used_at')) {
            return { rows: [] };
          }
          if (text.includes('FROM urls')) {
            return { rows: [{ id: 'url-1', short_code: 'abc', original_url: 'https://example.com' }] };
          }
          return { rows: [{ count: 1 }] };
        };

        try {
          const res = await request(app)
            .get('/api/urls')
            .set('x-api-key', key);

          assert.equal(res.status, 200);
          assert.equal(res.body.success, true);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('API Key rejects request when required scope is missing', async () => {
        const { key, hash } = generateApiKey();
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('FROM api_keys k') && text.includes('JOIN users u')) {
            return {
              rows: [{
                id: 'key-abc',
                name: 'Readonly Key',
                key_hash: hash,
                scopes: ['links:read'],
                is_revoked: false,
                expires_at: null,
                user_id: testUserId,
                workspace_id: null,
                user_email: 'test@axly.in',
                user_role: 'user',
                is_active: true,
              }]
            };
          }
          if (text.includes('UPDATE api_keys SET last_used_at')) {
            return { rows: [] };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post('/api/urls')
            .set('x-api-key', key)
            .send({ url: 'https://example.com/target' });

          assert.equal(res.status, 403);
          assert.match(res.body.message, /required 'links:write' scope/i);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('Revoked API Key is rejected with 401 Unauthorized', async () => {
        const { key, hash } = generateApiKey();
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('FROM api_keys k') && text.includes('JOIN users u')) {
            return {
              rows: [{
                id: 'key-revoked',
                key_hash: hash,
                scopes: ['links:read'],
                is_revoked: true,
                is_active: true,
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .get('/api/urls')
            .set('x-api-key', key);

          assert.equal(res.status, 401);
          assert.match(res.body.message, /API key has been revoked/i);
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Webhooks & SSRF Safety Protection', () => {
      test('signWebhookPayload generates valid HMAC-SHA256 signature and timestamp header', () => {
        const payload = { event: 'link.created', data: { id: 'link-1' } };
        const secret = 'whsec_sample_secret_key_12345';
        const timestamp = 1776000000;
        const header = signWebhookPayload(payload, secret, timestamp);

        assert.ok(header.startsWith(`t=${timestamp},v1=`));
      });

      test('POST /api/webhooks strictly rejects internal and link-local destinations (SSRF)', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          return { rows: [] };
        };

        try {
          const resMetadata = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
              url: 'http://169.254.169.254/latest/meta-data',
              events: ['link.created'],
            });

          assert.equal(resMetadata.status, 400);
          assert.match(resMetadata.body.message, /SSRF policy/i);

          const resLocalhost = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
              url: 'http://127.0.0.1:8080/hook',
              events: ['link.created'],
            });

          assert.equal(resLocalhost.status, 400);
          assert.match(resLocalhost.body.message, /SSRF policy/i);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('POST /api/webhooks registers a valid public webhook endpoint with secret', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('INSERT INTO webhooks')) {
            return {
              rows: [{
                id: 'wh-123',
                url: 'https://example.com/api/webhooks',
                secret: 'whsec_random123',
                events: ['link.created', 'link.expired'],
                is_active: true,
                created_at: new Date(),
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post('/api/webhooks')
            .set('Authorization', `Bearer ${testToken}`)
            .send({
              url: 'https://example.com/api/webhooks',
              events: ['link.created', 'link.expired'],
            });

          assert.equal(res.status, 201);
          assert.equal(res.body.success, true);
          assert.equal(res.body.webhook.url, 'https://example.com/api/webhooks');
          assert.ok(res.body.webhook.secret);
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Teams and Workspace RBAC', () => {
      const workspaceId = 'ws-team-alpha';

      test('POST /api/workspaces creates a workspace and assigns owner role', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('INSERT INTO workspaces')) {
            return {
              rows: [{
                id: workspaceId,
                name: 'Acme Growth Team',
                slug: 'acme-growth-team',
                owner_id: testUserId,
                is_personal: false,
                created_at: new Date(),
              }]
            };
          }
          if (text.includes('INSERT INTO workspace_members')) {
            return { rows: [] };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post('/api/workspaces')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ name: 'Acme Growth Team' });

          assert.equal(res.status, 201);
          assert.equal(res.body.success, true);
          assert.equal(res.body.workspace.name, 'Acme Growth Team');
        } finally {
          pool.query = originalQuery;
        }
      });

      test('Workspace RBAC: Viewer cannot update workspace settings (requires admin)', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('FROM workspace_members')) {
            return { rows: [{ role: 'viewer', user_id: testUserId, workspace_id: workspaceId }] };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .patch(`/api/workspaces/${workspaceId}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ name: 'Renamed Unauthorized' });

          assert.equal(res.status, 403);
          assert.match(res.body.message, /Requires at least 'admin' role/i);
        } finally {
          pool.query = originalQuery;
        }
      });

      test('Workspace Invitations: Admin can invite member with single-use token', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('JOIN users u')) {
            return { rows: [] };
          }
          if (text.includes('FROM workspace_members')) {
            return { rows: [{ role: 'admin', user_id: testUserId, workspace_id: workspaceId }] };
          }
          if (text.includes('FROM users WHERE email = $1')) {
            return { rows: [] };
          }
          if (text.includes('INSERT INTO workspace_invitations')) {
            return {
              rows: [{
                id: 'inv-123',
                workspace_id: workspaceId,
                email: 'colleague@example.com',
                role: 'editor',
                expires_at: new Date(Date.now() + 86400000),
                created_at: new Date(),
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post(`/api/workspaces/${workspaceId}/invites`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ email: 'colleague@example.com', role: 'editor' });

          assert.equal(res.status, 201);
          assert.equal(res.body.success, true);
          assert.ok(res.body.invitation.inviteToken);
          assert.ok(res.body.invitation.inviteLink);
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Custom Domains Management', () => {
      test('validateDomainSyntax validates hostname rules and blocks reserved domains', () => {
        assert.equal(validateDomainSyntax('go.mybrand.com').valid, true);
        assert.equal(validateDomainSyntax('GO.MYBRAND.COM').normalized, 'go.mybrand.com');
        assert.equal(validateDomainSyntax('192.168.1.1').valid, false);
        assert.equal(validateDomainSyntax('localhost').valid, false);
        assert.equal(validateDomainSyntax('domain..com').valid, false);
      });

      test('POST /api/domains creates a domain with DNS TXT verification token', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('FROM custom_domains WHERE domain = $1')) {
            return { rows: [] };
          }
          if (text.includes('INSERT INTO custom_domains')) {
            return {
              rows: [{
                id: 'dom-1',
                domain: 'links.acmecorp.com',
                verification_token: 'axly-verify-abcdef123456',
                status: 'pending_verification',
                dns_record_type: 'TXT',
                dns_expected_value: 'axly-verify=axly-verify-abcdef123456',
                created_at: new Date(),
              }]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .post('/api/domains')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ domain: 'links.acmecorp.com' });

          assert.equal(res.status, 201);
          assert.equal(res.body.success, true);
          assert.equal(res.body.domain.status, 'pending_verification');
          assert.ok(res.body.domain.verification_token);
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Privacy, Data Governance & Export', () => {
      test('GET /api/user/export returns machine-readable JSON data archive', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, email: 'test@axly.in', name: 'Tester', is_active: true, role: 'user', token_version: 1, created_at: new Date() }] };
          }
          if (text.includes('FROM urls')) {
            return { rows: [{ id: 'url-1', short_code: 'abc', original_url: 'https://example.com' }] };
          }
          if (text.includes('FROM campaigns')) {
            return { rows: [] };
          }
          if (text.includes('FROM experiments')) {
            return { rows: [] };
          }
          if (text.includes('FROM custom_domains')) {
            return { rows: [] };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .get('/api/user/export')
            .set('Authorization', `Bearer ${testToken}`);

          assert.equal(res.status, 200);
          assert.equal(res.body.success, true);
          assert.ok(res.body.export.account);
          assert.ok(Array.isArray(res.body.export.links));
          assert.equal(res.body.export.data_policy_notice.retention_period, 'Active account duration');
        } finally {
          pool.query = originalQuery;
        }
      });

      test('DELETE /api/user/account strictly requires explicit confirmation phrase', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .delete('/api/user/account')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ confirmation: 'wrong phrase' });

          assert.equal(res.status, 400);
          assert.match(res.body.message, /DELETE MY ACCOUNT/i);
        } finally {
          pool.query = originalQuery;
        }
      });
    });

    describe('Notifications Layer', () => {
      test('GET /api/notifications returns user in-app notifications and unread count', async () => {
        const originalQuery = pool.query;
        pool.query = async (text) => {
          if (text.includes('token_version') || text.includes('WHERE id = $1')) {
            return { rows: [{ id: testUserId, is_active: true, role: 'user', token_version: 1 }] };
          }
          if (text.includes('COUNT(*)')) {
            return { rows: [{ unread_count: 2, unread: 2 }] };
          }
          if (text.includes('FROM notifications')) {
            return {
              rows: [
                { id: 'notif-1', title: 'Webhook Failure', message: 'Endpoint returned 500', is_read: false, created_at: new Date() },
                { id: 'notif-2', title: 'Team Invite', message: 'You were invited to Acme', is_read: false, created_at: new Date() }
              ]
            };
          }
          return { rows: [] };
        };

        try {
          const res = await request(app)
            .get('/api/notifications')
            .set('Authorization', `Bearer ${testToken}`);

          assert.equal(res.status, 200);
          assert.equal(res.body.success, true);
          assert.equal(res.body.unreadCount, 2);
          assert.equal(res.body.notifications.length, 2);
        } finally {
          pool.query = originalQuery;
        }
      });
    });
  });

  after(async () => {
    pool.connect = originalConnect;
    await closePool();
    setTimeout(() => process.exit(0), 100);
  });
});
