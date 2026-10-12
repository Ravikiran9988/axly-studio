import pg from 'pg';
import { config } from '../config/env.js';

const { Pool } = pg;

const createPoolConfig = () => {
  const dbConfig = config.database;

  // If DATABASE_URL is provided (e.g. Supabase Cloud)
  if (dbConfig.connectionString) {
    const isSupabase = dbConfig.connectionString.includes('supabase.co') || 
                       dbConfig.connectionString.includes('supabase.com');
    
    return {
      connectionString: dbConfig.connectionString,
      ssl: dbConfig.ssl || (isSupabase ? { rejectUnauthorized: true } : false),
      max: dbConfig.max,
      idleTimeoutMillis: dbConfig.idleTimeoutMillis,
      connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
    };
  }

  // Local or discrete configuration
  return {
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
    ssl: dbConfig.ssl,
    max: dbConfig.max,
    idleTimeoutMillis: dbConfig.idleTimeoutMillis,
    connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
  };
};

const pool = new Pool(createPoolConfig());

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (err) {
    // Log helpful diagnostic info without leaking passwords
    if (config.NODE_ENV !== 'test') {
      console.error('Database query error:', {
        message: err.message,
        code: err.code,
        detail: err.detail,
      });
    }
    throw err;
  }
};

export const getClient = () => pool.connect();

export const closePool = async () => {
  try {
    await pool.end();
  } catch (err) {
    console.error('Error closing database pool:', err);
  }
};

export default pool;
