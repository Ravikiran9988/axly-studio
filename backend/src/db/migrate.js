import pool from './pool.js';

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        plan VARCHAR(50) DEFAULT 'free',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // URLs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        short_code VARCHAR(20) UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        custom_alias VARCHAR(50),
        title VARCHAR(500),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        click_count BIGINT DEFAULT 0,
        unique_clicks BIGINT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'active',
        expires_at TIMESTAMPTZ,
        password_hash VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create index for short_code lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
    `);

    // Click events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS click_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
        ip_address INET,
        user_agent TEXT,
        referer TEXT,
        country VARCHAR(100),
        city VARCHAR(100),
        region VARCHAR(100),
        device_type VARCHAR(50),
        browser VARCHAR(100),
        os VARCHAR(100),
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Index for analytics queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON click_events(url_id);
      CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON click_events(clicked_at);
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating tables:', err);
    throw err;
  } finally {
    client.release();
  }
};

createTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
