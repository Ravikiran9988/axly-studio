import pool, { closePool } from './pool.js';

export const runMigrations = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        plan VARCHAR(50) DEFAULT 'free',
        role VARCHAR(50) DEFAULT 'user',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add user columns if table already existed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'role'
        ) THEN
          ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';
        END IF;
      END $$;
    `);

    // 2. Campaigns table
    await client.query(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_term VARCHAR(255),
        utm_content VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
    `);

    // 3. URLs table
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
        tags TEXT[] DEFAULT '{}',
        notes TEXT,
        is_preview_enabled BOOLEAN DEFAULT false,
        campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_term VARCHAR(255),
        utm_content VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add additive columns to URLs if table already existed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'tags'
        ) THEN
          ALTER TABLE urls ADD COLUMN tags TEXT[] DEFAULT '{}';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'notes'
        ) THEN
          ALTER TABLE urls ADD COLUMN notes TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'is_preview_enabled'
        ) THEN
          ALTER TABLE urls ADD COLUMN is_preview_enabled BOOLEAN DEFAULT false;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'campaign_id'
        ) THEN
          ALTER TABLE urls ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'utm_source'
        ) THEN
          ALTER TABLE urls ADD COLUMN utm_source VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'utm_medium'
        ) THEN
          ALTER TABLE urls ADD COLUMN utm_medium VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'utm_campaign'
        ) THEN
          ALTER TABLE urls ADD COLUMN utm_campaign VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'utm_term'
        ) THEN
          ALTER TABLE urls ADD COLUMN utm_term VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'utm_content'
        ) THEN
          ALTER TABLE urls ADD COLUMN utm_content VARCHAR(255);
        END IF;
      END $$;
    `);

    // Indexes for URL table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
      CREATE INDEX IF NOT EXISTS idx_urls_user_id ON urls(user_id);
      CREATE INDEX IF NOT EXISTS idx_urls_status ON urls(status);
      CREATE INDEX IF NOT EXISTS idx_urls_campaign_id ON urls(campaign_id);
    `);

    // 4. Smart Redirect Rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_redirect_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
        priority INT DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        rule_type VARCHAR(50) NOT NULL,
        match_value VARCHAR(255),
        destination_url TEXT NOT NULL,
        start_time TIME,
        end_time TIME,
        timezone VARCHAR(50) DEFAULT 'UTC',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_smart_rules_url_id ON smart_redirect_rules(url_id);
      CREATE INDEX IF NOT EXISTS idx_smart_rules_priority ON smart_redirect_rules(url_id, priority);
    `);

    // 5. Experiments & Variants tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS experiments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        conversion_goal VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_experiments_url_id ON experiments(url_id);
      CREATE INDEX IF NOT EXISTS idx_experiments_user_id ON experiments(user_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS experiment_variants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(255) NOT NULL,
        destination_url TEXT NOT NULL,
        weight INT DEFAULT 50,
        clicks BIGINT DEFAULT 0,
        conversions BIGINT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_variants_experiment_id ON experiment_variants(experiment_id);
    `);

    // 6. Conversion events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversion_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        experiment_id UUID REFERENCES experiments(id) ON DELETE CASCADE NOT NULL,
        variant_id UUID REFERENCES experiment_variants(id) ON DELETE CASCADE NOT NULL,
        visitor_hash VARCHAR(64),
        conversion_value NUMERIC DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversions_experiment_id ON conversion_events(experiment_id);
    `);

    // 7. Atomic Unique Visitors Tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS url_unique_visitors (
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
        visitor_hash VARCHAR(64) NOT NULL,
        first_seen TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (url_id, visitor_hash)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_unique_visitors_url_id ON url_unique_visitors(url_id);
    `);

    // 8. Click events table
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
        smart_rule_id UUID REFERENCES smart_redirect_rules(id) ON DELETE SET NULL,
        experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL,
        variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL,
        clicked_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Add additive columns to click_events if table already existed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'click_events' AND column_name = 'visitor_hash'
        ) THEN
          ALTER TABLE click_events ADD COLUMN visitor_hash VARCHAR(64);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'click_events' AND column_name = 'smart_rule_id'
        ) THEN
          ALTER TABLE click_events ADD COLUMN smart_rule_id UUID REFERENCES smart_redirect_rules(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'click_events' AND column_name = 'experiment_id'
        ) THEN
          ALTER TABLE click_events ADD COLUMN experiment_id UUID REFERENCES experiments(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'click_events' AND column_name = 'variant_id'
        ) THEN
          ALTER TABLE click_events ADD COLUMN variant_id UUID REFERENCES experiment_variants(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Indexes for analytics queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_clicks_url_id ON click_events(url_id);
      CREATE INDEX IF NOT EXISTS idx_clicks_clicked_at ON click_events(clicked_at);
      CREATE INDEX IF NOT EXISTS idx_clicks_url_visitor ON click_events(url_id, visitor_hash);
      CREATE INDEX IF NOT EXISTS idx_clicks_url_date ON click_events(url_id, clicked_at);
      CREATE INDEX IF NOT EXISTS idx_clicks_experiment_id ON click_events(experiment_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Phase 2 database schema, tables, and indexes migrated successfully');
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
