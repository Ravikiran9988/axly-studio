import dotenv from 'dotenv';

dotenv.config();

const INSECURE_JWT_SECRETS = [
  'axly_dev_secret_key_change_in_production',
  'change_this_in_production_axly_jwt_secret_2026',
  'secret',
  'jwtsecret',
  '123456',
  'password',
  'your_secret_here',
];

const INSECURE_VISITOR_SALTS = [
  'axly_local_visitor_salt_change_me_before_production',
  'replace_with_a_secure_random_32_character_or_longer_secret',
  'change_me',
  'your_visitor_salt_here',
  'secret',
  'password',
];



export const validateEnv = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const errors = [];

  // Production checks
  if (nodeEnv === 'production') {
    if (!process.env.JWT_SECRET) {
      errors.push('JWT_SECRET environment variable is missing.');
    } else if (process.env.JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters in production.');
    } else if (INSECURE_JWT_SECRETS.includes(process.env.JWT_SECRET.toLowerCase())) {
      errors.push('JWT_SECRET cannot be a default or well-known development secret in production.');
    }

    if (!process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
      errors.push('Database configuration is incomplete: either DATABASE_URL or DB_PASSWORD must be provided in production.');
    }

    if (!process.env.VISITOR_SALT) {
      errors.push('VISITOR_SALT environment variable is missing. Set a strong, random secret of at least 32 characters.');
    } else if (process.env.VISITOR_SALT.length < 32) {
      errors.push('VISITOR_SALT must be at least 32 characters in production.');
    } else if (INSECURE_VISITOR_SALTS.includes(process.env.VISITOR_SALT.toLowerCase())) {
      errors.push('VISITOR_SALT cannot be a placeholder or well-known development value in production.');
    }

  }

  if (errors.length > 0) {
    console.error('[FATAL] Production environment validation failed:');
    errors.forEach((err) => console.error(`  - ${err}`));
    throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
  }
};

const nodeEnv = process.env.NODE_ENV || 'development';

export const config = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT || '5000', 10),
  TRUST_PROXY: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1' ? 1 : false,

  // Database
  database: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'axly_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'password',
    ssl: process.env.DB_SSL === 'true' ||
      (process.env.DATABASE_URL && (
        process.env.DATABASE_URL.includes('supabase.com') ||
        process.env.DATABASE_URL.includes('supabase.co') ||
        process.env.DATABASE_URL.includes('neon.tech')
      ))
      ? { rejectUnauthorized: true }
      : false,
    max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '30000', 10),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT_MS || '5000', 10),
  },

  // Visitor analytics: development/test fallback only; production startup requires VISITOR_SALT.
  visitorSalt: process.env.VISITOR_SALT || (nodeEnv === 'test'
    ? 'test_visitor_salt_32_characters_minimum'
    : 'axly_local_visitor_salt_change_me_before_production'),

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || (nodeEnv === 'test' ? 'test_jwt_secret_32_characters_minimum_required' : 'axly_dev_secret_key_change_in_production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // URLs
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  SHORT_DOMAIN: process.env.SHORT_DOMAIN || 'http://localhost:5000',

  // Rate Limiting
  rateLimits: {
    generalWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    generalMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    createWindowMs: parseInt(process.env.CREATE_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    createMax: parseInt(process.env.CREATE_RATE_LIMIT_MAX || '50', 10),
    guestCreateWindowMs: parseInt(process.env.GUEST_CREATE_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    guestCreateMax: parseInt(process.env.GUEST_CREATE_RATE_LIMIT_MAX || '10', 10), // 10 links/hr for guests
    authWindowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    authMax: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  },

  // Telegram Bot integration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    botSecret: process.env.TELEGRAM_BOT_SECRET || (nodeEnv === 'test' ? 'test_telegram_bot_secret_32_characters_minimum' : ''),
    botUsername: process.env.TELEGRAM_BOT_USERNAME || 'AxlyStudioBot',
  },
};
