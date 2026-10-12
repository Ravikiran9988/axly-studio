import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index.js';
import pool, { closePool } from '../src/db/pool.js';
import { config } from '../src/config/env.js';
import { validateSafeDestinationUrl } from '../src/utils/ssrf.js';

describe('Axly URL Shortener API Tests', () => {
  const testUserId = '11111111-1111-1111-1111-111111111111';
  const testToken = jwt.sign(
    { id: testUserId, email: 'test@axly.in', name: 'Tester' },
    config.jwt.secret,
    { expiresIn: '1h' }
  );

  test('GET /api/health returns health status', async () => {
    const res = await request(app).get('/api/health');
    assert.ok(res.body.timestamp);
    assert.equal(res.body.version, '1.0.0');
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

  after(async () => {
    await closePool();
    setTimeout(() => process.exit(0), 100);
  });
});
