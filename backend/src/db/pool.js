import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL?.trim();

// Supabase and other hosted PostgreSQL providers require TLS.
// Keep certificate verification enabled by default.
const ssl = databaseUrl
  ? {
      rejectUnauthorized:
        process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
    }
  : undefined;

const poolConfig = {
  ...(databaseUrl
    ? {
        connectionString: databaseUrl,
        ssl,
      }
    : {
        // Local PostgreSQL / Docker Compose configuration.
        host: process.env.DB_HOST || 'localhost',
        port: Number.parseInt(process.env.DB_PORT || '5432', 10),
        database: process.env.DB_NAME || 'axly_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }),
  max: Number.parseInt(process.env.DB_POOL_MAX || '10', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: Number.parseInt(
    process.env.DB_CONNECTION_TIMEOUT_MS || '10000',
    10,
  ),
};

if (!databaseUrl && !process.env.DB_PASSWORD) {
  throw new Error(
    'Database configuration missing: set DATABASE_URL or configure DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD.',
  );
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();

export default pool;
