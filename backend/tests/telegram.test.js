import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/index.js';
import { query, closePool } from '../src/db/pool.js';
import { runMigrations } from '../src/db/migrate.js';
import { config } from '../src/config/env.js';

describe('Telegram Integration API Endpoints', () => {
  let testUserToken = null;
  let testUserId = null;
  const testEmail = `telegram_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  const testTelegramUserId = '987654321';

  before(async () => {
    await runMigrations().catch(() => {});

    // Register test user
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Telegram Tester',
        email: testEmail,
        password: testPassword,
      });

    assert.equal(res.status, 201);
    testUserToken = res.body.token;
    testUserId = res.body.user.id;
  });

  after(async () => {
    // Clean up test data
    if (testUserId) {
      await query('DELETE FROM telegram_links WHERE user_id = $1', [testUserId]).catch(() => {});
      await query('DELETE FROM telegram_link_tokens WHERE user_id = $1', [testUserId]).catch(() => {});
      await query('DELETE FROM users WHERE id = $1', [testUserId]).catch(() => {});
    }
    await closePool().catch(() => {});
  });

  test('POST /api/telegram/link-code requires authentication', async () => {
    const res = await request(app).post('/api/telegram/link-code');
    assert.equal(res.status, 401);
  });

  test('POST /api/telegram/link-code generates a single-use 10-minute code', async () => {
    const res = await request(app)
      .post('/api/telegram/link-code')
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.code.startsWith('AX-'));
    assert.ok(res.body.token.startsWith('axly_tlink_'));
    assert.ok(res.body.deepLink.includes(res.body.code));
    assert.equal(res.body.expiresInSeconds, 600);
  });

  test('POST /api/telegram/verify rejects invalid or non-existent code', async () => {
    const res = await request(app)
      .post('/api/telegram/verify')
      .send({
        code: 'AX-INVALID99',
        telegramUserId: testTelegramUserId,
      });

    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.code, 'INVALID_LINK_CODE');
  });

  test('POST /api/telegram/verify successfully links account with valid code', async () => {
    // 1. Generate code
    const codeRes = await request(app)
      .post('/api/telegram/link-code')
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.equal(codeRes.status, 201);
    const linkingCode = codeRes.body.code;

    // 2. Verify code
    const verifyRes = await request(app)
      .post('/api/telegram/verify')
      .send({
        code: linkingCode,
        telegramUserId: testTelegramUserId,
        telegramUsername: 'test_tg_user',
        telegramFirstName: 'Tester',
      });

    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.body.success, true);
    assert.equal(verifyRes.body.user.id, testUserId);
    assert.ok(verifyRes.body.token, 'Should return JWT session token');

    // 3. Status check from web
    const statusRes = await request(app)
      .get('/api/telegram/status')
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.equal(statusRes.status, 200);
    assert.equal(statusRes.body.linked, true);
    assert.equal(statusRes.body.telegram.username, 'test_tg_user');
  });

  test('POST /api/telegram/verify rejects reused code (single-use enforcement)', async () => {
    // Generate code
    const codeRes = await request(app)
      .post('/api/telegram/link-code')
      .set('Authorization', `Bearer ${testUserToken}`);

    const linkingCode = codeRes.body.code;

    // First use: ok
    const firstUse = await request(app)
      .post('/api/telegram/verify')
      .send({
        code: linkingCode,
        telegramUserId: testTelegramUserId,
      });
    assert.equal(firstUse.status, 200);

    // Second use: must fail
    const secondUse = await request(app)
      .post('/api/telegram/verify')
      .send({
        code: linkingCode,
        telegramUserId: testTelegramUserId,
      });
    assert.equal(secondUse.status, 400);
    assert.equal(secondUse.body.code, 'CODE_ALREADY_USED');
  });

  test('POST /api/telegram/session retrieves active session with bot secret', async () => {
    const res = await request(app)
      .post('/api/telegram/session')
      .set('x-telegram-bot-secret', config.telegram.botSecret)
      .send({ telegramUserId: testTelegramUserId });

    assert.equal(res.status, 200);
    assert.equal(res.body.linked, true);
    assert.equal(res.body.user.id, testUserId);
    assert.ok(res.body.token);
  });

  test('POST /api/telegram/unlink successfully removes account link', async () => {
    const res = await request(app)
      .post('/api/telegram/unlink')
      .set('Authorization', `Bearer ${testUserToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify session lookup now reports not linked
    const sessionRes = await request(app)
      .post('/api/telegram/session')
      .set('x-telegram-bot-secret', config.telegram.botSecret)
      .send({ telegramUserId: testTelegramUserId });

    assert.equal(sessionRes.status, 200);
    assert.equal(sessionRes.body.linked, false);
  });
});
