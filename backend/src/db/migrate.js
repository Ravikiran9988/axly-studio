import pool, { closePool } from './pool.js';

export const runMigrations = async () => {
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
        short_code VARCHAR(50) UNIQUE NOT NULL,
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

    // Indexes for URL table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_status ON urls(status);
    `);

    // Click events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS click_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
        ip_address INET,
        visitor_hash VARCHAR(64),
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

    // Backward-compatible column addition if table already existed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'click_events' AND column_name = 'visitor_hash'
        ) THEN
          ALTER TABLE click_events ADD COLUMN visitor_hash VARCHAR(64);
        END IF;
      END $$;
    `);

    // Indexes for analytics queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON click_events(url_id);
      CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON click_events(clicked_at);
      CREATE INDEX IF NOT EXISTS idx_clicks_url_visitor ON click_events(url_id, visitor_hash);
      CREATE INDEX IF NOT EXISTS idx_clicks_url_date ON click_events(url_id, clicked_at);
    `);

    await client.query('COMMIT');
    console.log('✅ Database tables and indexes migrated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

// If run directly from CLI
if (process.argv[1]?.endsWith('migrate.js')) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async () => {
      await closePool();
      process.exit(1);
    });
}
