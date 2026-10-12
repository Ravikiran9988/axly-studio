import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../src/config/env.js';

describe('Environment & Secrets Configuration', () => {
  test('allows safe defaults in development mode', () => {
    process.env.NODE_ENV = 'development';
    assert.doesNotThrow(() => validateEnv());
  });

  test('rejects missing JWT_SECRET in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;
    
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    assert.throws(
      () => validateEnv(),
      /Environment validation failed/
    );

    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  });

  test('rejects insecure default JWT_SECRET in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'axly_dev_secret_key_change_in_production';

    assert.throws(
      () => validateEnv(),
      /Environment validation failed/
    );

    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  });

  test('rejects JWT_SECRET shorter than 32 characters in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSecret = process.env.JWT_SECRET;

    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'too_short_secret_key';

    assert.throws(
      () => validateEnv(),
      /Environment validation failed/
    );

    process.env.NODE_ENV = originalEnv;
    process.env.JWT_SECRET = originalSecret;
  });
});
