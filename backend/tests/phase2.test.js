import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/index.js';
import pool, { closePool } from '../src/db/pool.js';
import { config } from '../src/config/env.js';
import { validateSafeDestinationUrl } from '../src/utils/ssrf.js';

describe('Phase 2 — Axly Studio User Features & Intelligence Tests', () => {
  after(async () => {
    await closePool();
  });

  const memberId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const memberToken = jwt.sign(
    { id: memberId, email: 'operator@axly.in', name: 'Lead Operator', role: 'user' },
    config.jwt.secret,
    { expiresIn: '2h' }
  );

  describe('SSRF & Destination Safety Protection', () => {
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

  describe('Campaign and UTM Management', () => {
    test('POST /api/campaigns rejects unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/campaigns')
        .send({ name: 'Q4 Product Launch' });
      assert.equal(res.status, 401);
    });

    test('POST /api/campaigns creates a campaign for authenticated user', async () => {
      const originalQuery = pool.query;
      pool.query = async (text, params) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        if (text.includes('INSERT INTO campaigns')) {
          return {
            rows: [{
              id: 'camp-123',
              user_id: memberId,
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
          .set('Authorization', `Bearer ${memberToken}`)
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

  describe('Smart Redirect Rules Management', () => {
    test('POST /api/urls/:urlId/rules validates device rule matchValue', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id FROM urls WHERE id = $1 AND user_id = $2')) {
          return { rows: [{ id: 'url-1' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/url-1/rules')
          .set('Authorization', `Bearer ${memberToken}`)
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
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        if (text.includes('SELECT id FROM urls WHERE id = $1 AND user_id = $2')) {
          return { rows: [{ id: 'url-1' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/url-1/rules')
          .set('Authorization', `Bearer ${memberToken}`)
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

  describe('A/B Experiments & Conversion Tracking', () => {
    test('POST /api/experiments requires at least 2 variants', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/experiments')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            urlId: 'url-1',
            name: 'Hero CTA Test',
            variants: [{ name: 'A', destinationUrl: 'https://example.com/a' }], // Only 1 variant
          });

        assert.equal(res.status, 400);
        assert.match(res.body.message, /at least 2 destination variants/i);
      } finally {
        pool.query = originalQuery;
      }
    });
  });

  describe('Bulk Link Actions & CSV Processing', () => {
    test('POST /api/urls/bulk requires non-empty array of URL IDs', async () => {
      const originalQuery = pool.query;
      pool.query = async (text) => {
        if (text.includes('FROM users')) {
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/bulk')
          .set('Authorization', `Bearer ${memberToken}`)
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
          return { rows: [{ id: memberId, is_active: true, role: 'user' }] };
        }
        if (text.includes('INSERT INTO urls')) {
          return { rows: [{ id: 'url-mock', short_code: 'abc', original_url: 'https://example.com/valid', title: 'Test', status: 'active', created_at: new Date() }] };
        }
        return { rows: [] };
      };

      try {
        const res = await request(app)
          .post('/api/urls/bulk-import')
          .set('Authorization', `Bearer ${memberToken}`)
          .send({
            rows: [
              { originalUrl: 'https://example.com/valid' },
              { originalUrl: 'http://127.0.0.1/malicious' }, // SSRF error
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
});
