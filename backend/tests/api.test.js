import { test, describe, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index.js';
import pool, { closePool } from '../src/db/pool.js';
import { config } from '../src/config/env.js';

describe('Axly URL Shortener API Tests', () => {
  after(async () => {
    await closePool();
  });
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

    test('POST /api/urls rejects reserved custom aliases', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com', customAlias: 'login' });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /reserved by the system/i);
    });

    test('POST /api/urls rejects invalid custom alias format', async () => {
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com', customAlias: 'hi' }); // < 3 chars

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /3-30 characters/i);
    });

    test('POST /api/urls rejects past expiration date', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString();
      const res = await request(app)
        .post('/api/urls')
        .send({ url: 'https://example.com', expiresAt: pastDate });

      assert.equal(res.status, 400);
      assert.equal(res.body.success, false);
      assert.match(res.body.message, /must be in the future/i);
    });
  });

  describe('Partial Updates & Expiration Bug Regression', () => {
    test('PATCH /api/urls/:id rejects invalid status values', async () => {
      // Mock pool.query to simulate existing link
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('SELECT id, is_active FROM users')) {
          return { rows: [{ id: testUserId, is_active: true }] };
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
        if (text.includes('SELECT id, is_active FROM users')) {
          return { rows: [{ id: testUserId, is_active: true }] };
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
        if (text.includes('SELECT id, is_active FROM users')) {
          return { rows: [{ id: testUserId, is_active: true }] };
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
});
