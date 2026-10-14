import pool, { closePool } from './pool.js';

export const runMigrations = async () => {
  const client = await pool.connect();
  let migrationLockAcquired = false;

  try {
    // Serialize schema changes across simultaneous application instances.
    await client.query('SELECT pg_advisory_lock(71226014, 1)');
    migrationLockAcquired = true;
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

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'avatar_url'
        ) THEN
          ALTER TABLE users ADD COLUMN avatar_url TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'bio'
        ) THEN
          ALTER TABLE users ADD COLUMN bio TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'company'
        ) THEN
          ALTER TABLE users ADD COLUMN company VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'website'
        ) THEN
          ALTER TABLE users ADD COLUMN website VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'phone'
        ) THEN
          ALTER TABLE users ADD COLUMN phone VARCHAR(50);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'job_title'
        ) THEN
          ALTER TABLE users ADD COLUMN job_title VARCHAR(255);
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'location'
        ) THEN
          ALTER TABLE users ADD COLUMN location VARCHAR(255);
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

    // 9. Phase 3: Users enhancements (session invalidation, suspension, login tracking)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'token_version'
        ) THEN
          ALTER TABLE users ADD COLUMN token_version INT DEFAULT 1;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'suspended_at'
        ) THEN
          ALTER TABLE users ADD COLUMN suspended_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'suspended_reason'
        ) THEN
          ALTER TABLE users ADD COLUMN suspended_reason TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'users' AND column_name = 'last_login_at'
        ) THEN
          ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
        END IF;
      END $$;
    `);

    // 10. Phase 3: URLs enhancements (moderation & health status)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'moderation_status'
        ) THEN
          ALTER TABLE urls ADD COLUMN moderation_status VARCHAR(50) DEFAULT 'approved';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'moderation_reason'
        ) THEN
          ALTER TABLE urls ADD COLUMN moderation_reason TEXT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'moderated_at'
        ) THEN
          ALTER TABLE urls ADD COLUMN moderated_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'moderator_id'
        ) THEN
          ALTER TABLE urls ADD COLUMN moderator_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'last_health_check_at'
        ) THEN
          ALTER TABLE urls ADD COLUMN last_health_check_at TIMESTAMPTZ;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'health_status'
        ) THEN
          ALTER TABLE urls ADD COLUMN health_status VARCHAR(50) DEFAULT 'unknown';
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'health_status_code'
        ) THEN
          ALTER TABLE urls ADD COLUMN health_status_code INT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'health_response_time_ms'
        ) THEN
          ALTER TABLE urls ADD COLUMN health_response_time_ms INT;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'urls' AND column_name = 'health_error'
        ) THEN
          ALTER TABLE urls ADD COLUMN health_error TEXT;
        END IF;
      END $$;
    `);

    // 11. Phase 3: Link Reports table (Public visitor abuse reports & moderation queue)
    await client.query(`
      CREATE TABLE IF NOT EXISTS link_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
        short_code VARCHAR(50) NOT NULL,
        reporter_ip_hash VARCHAR(64),
        reporter_email VARCHAR(255),
        reason VARCHAR(100) NOT NULL,
        details TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        reviewer_notes TEXT,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reports_url_id ON link_reports(url_id);
      CREATE INDEX IF NOT EXISTS idx_reports_status ON link_reports(status);
      CREATE INDEX IF NOT EXISTS idx_reports_created_at ON link_reports(created_at);
    `);

    // 12. Phase 3: Link Health Checks history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS link_health_checks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        url_id UUID REFERENCES urls(id) ON DELETE CASCADE NOT NULL,
        target_url TEXT NOT NULL,
        status_code INT,
        response_time_ms INT,
        is_healthy BOOLEAN NOT NULL,
        error_reason TEXT,
        checked_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_health_checks_url_id ON link_health_checks(url_id);
      CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON link_health_checks(checked_at);
    `);

    // 13. Phase 3: Audit Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
        actor_email VARCHAR(255) NOT NULL,
        action VARCHAR(100) NOT NULL,
        target_type VARCHAR(50) NOT NULL,
        target_id VARCHAR(255),
        details JSONB DEFAULT '{}',
        ip_hash VARCHAR(64),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    // 14. Phase 3: Platform Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Seed default platform settings
    const defaultSettings = [
      { key: 'guest_hourly_limit', value: 10, description: 'Maximum links a guest can shorten per hour' },
      { key: 'authenticated_daily_limit', value: 1000, description: 'Maximum links an authenticated member can create per day' },
      { key: 'max_url_length', value: 4096, description: 'Maximum accepted destination URL character length' },
      { key: 'default_expiration_days', value: 0, description: 'Default expiration in days (0 for permanent)' },
      { key: 'enable_guest_shortening', value: true, description: 'Allow unauthenticated guests to shorten links' },
      { key: 'enable_preview_pages', value: true, description: 'Enable safety interstitial preview pages' },
      { key: 'enable_ab_testing', value: true, description: 'Allow authenticated users to run A/B experiments' },
      { key: 'enable_smart_rules', value: true, description: 'Allow device and time smart routing rules' },
      { key: 'require_captcha_for_guests', value: false, description: 'Require CAPTCHA for guest link creation' },
    ];

    for (const s of defaultSettings) {
      await client.query(`
        INSERT INTO platform_settings (key, value, description)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO NOTHING
      `, [s.key, JSON.stringify(s.value), s.description]);
    }

    // ==========================================
    // PHASE 4 MIGRATIONS: WORKSPACES, API KEYS,
    // WEBHOOKS, CUSTOM DOMAINS, NOTIFICATIONS
    // ==========================================

    // 15. Workspaces table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        owner_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
        is_personal BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
      CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);
    `);

    // 16. Workspace Members table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(workspace_id, user_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
    `);

    // 17. Workspace Invitations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'viewer',
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON workspace_invitations(token_hash);
      CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON workspace_invitations(workspace_id);
    `);

    // 18. Backfill personal workspaces for any existing users
    await client.query(`
      INSERT INTO workspaces (name, slug, owner_id, is_personal)
      SELECT 
        CONCAT(u.name, '''s Workspace'),
        CONCAT('personal-', SUBSTRING(REPLACE(u.id::text, '-', ''), 1, 12)),
        u.id,
        true
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM workspaces w WHERE w.owner_id = u.id AND w.is_personal = true
      );

      INSERT INTO workspace_members (workspace_id, user_id, role)
      SELECT w.id, w.owner_id, 'owner'
      FROM workspaces w
      ON CONFLICT (workspace_id, user_id) DO NOTHING;
    `);

    // Add workspace_id to existing resource tables
    await client.query(`
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
      ALTER TABLE experiments ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_urls_workspace_id ON urls(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id ON campaigns(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_experiments_workspace_id ON experiments(workspace_id);
    `);

    // 19. Developer API Keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        key_prefix VARCHAR(16) NOT NULL,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        scopes TEXT[] DEFAULT '{"links:read","links:write"}',
        rate_limit_per_minute INT DEFAULT 120,
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        is_revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
    `);

    // 20. Webhooks and Deliveries tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        url TEXT NOT NULL,
        secret VARCHAR(64) NOT NULL,
        events TEXT[] NOT NULL DEFAULT '{"link.created"}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
      CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS webhook_deliveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID REFERENCES webhooks(id) ON DELETE CASCADE NOT NULL,
        event VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        status_code INT,
        response_body TEXT,
        duration_ms INT,
        is_success BOOLEAN DEFAULT false,
        attempt_count INT DEFAULT 1,
        next_retry_at TIMESTAMPTZ,
        error_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
      CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
    `);

    // 21. Custom Domains table
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        domain VARCHAR(255) UNIQUE NOT NULL,
        verification_token VARCHAR(64) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending_dns',
        dns_record_type VARCHAR(10) DEFAULT 'CNAME',
        dns_expected_value VARCHAR(255) NOT NULL,
        verified_at TIMESTAMPTZ,
        ssl_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_custom_domains_user_id ON custom_domains(user_id);
      CREATE INDEX IF NOT EXISTS idx_custom_domains_domain ON custom_domains(domain);
    `);

    await client.query(`
      ALTER TABLE urls ADD COLUMN IF NOT EXISTS custom_domain_id UUID REFERENCES custom_domains(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_urls_custom_domain_id ON urls(custom_domain_id);
    `);

    // 22. In-App Notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
    `);

    // 23. Custom public pages / Link-in-bio builder
    await client.query(`
      ALTER TABLE custom_domains
        ADD COLUMN IF NOT EXISTS domain_type VARCHAR(30) NOT NULL DEFAULT 'shortlinks';
      UPDATE custom_domains SET domain_type = 'shortlinks' WHERE domain_type IS NULL;
      ALTER TABLE custom_domains DROP CONSTRAINT IF EXISTS custom_domains_domain_type_check;
      ALTER TABLE custom_domains ADD CONSTRAINT custom_domains_domain_type_check
        CHECK (domain_type IN ('shortlinks', 'page'));
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS public_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        slug VARCHAR(64) NOT NULL,
        title VARCHAR(160) NOT NULL,
        bio VARCHAR(600) DEFAULT '',
        profile_image_url TEXT,
        page_type VARCHAR(40) NOT NULL DEFAULT 'link-in-bio',
        template_key VARCHAR(40) NOT NULL DEFAULT 'minimal',
        theme JSONB NOT NULL DEFAULT '{"mode":"light","accent":"#2563eb","background":"#f8fafc","buttonStyle":"rounded"}'::jsonb,
        blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'draft',
        seo_title VARCHAR(180),
        seo_description VARCHAR(320),
        og_image_url TEXT,
        publish_at TIMESTAMPTZ,
        unpublish_at TIMESTAMPTZ,
        custom_domain_id UUID REFERENCES custom_domains(id) ON DELETE SET NULL,
        contact_email VARCHAR(320),
        contact_phone VARCHAR(80),
        contact_company VARCHAR(160),
        contact_job_title VARCHAR(160),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ,
        CONSTRAINT public_pages_status_check CHECK (status IN ('draft', 'published', 'archived')),
        CONSTRAINT public_pages_type_check CHECK (page_type IN ('link-in-bio', 'business-card', 'portfolio', 'creator')),
        CONSTRAINT public_pages_template_check CHECK (template_key IN ('minimal', 'creator', 'developer', 'business', 'business-card'))
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_public_pages_slug_lower ON public_pages (LOWER(slug));
      CREATE INDEX IF NOT EXISTS idx_public_pages_user_id ON public_pages(user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_public_pages_status_schedule ON public_pages(status, publish_at, unpublish_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_public_pages_custom_domain_unique
        ON public_pages(custom_domain_id) WHERE custom_domain_id IS NOT NULL;
    `);

    // Additive guards for existing installations created before page publishing shipped.
    await client.query(`
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS page_type VARCHAR(40) NOT NULL DEFAULT 'link-in-bio';
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS template_key VARCHAR(40) NOT NULL DEFAULT 'minimal';
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS theme JSONB NOT NULL DEFAULT '{"mode":"light","accent":"#2563eb","background":"#f8fafc","buttonStyle":"rounded"}'::jsonb;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS blocks JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS seo_title VARCHAR(180);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS seo_description VARCHAR(320);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS og_image_url TEXT;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS unpublish_at TIMESTAMPTZ;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS custom_domain_id UUID REFERENCES custom_domains(id) ON DELETE SET NULL;
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS contact_email VARCHAR(320);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(80);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS contact_company VARCHAR(160);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS contact_job_title VARCHAR(160);
      ALTER TABLE public_pages ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
    `);

    // Privacy-preserving page views and per-block click events. Raw visitor IPs are never persisted.
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id UUID REFERENCES public_pages(id) ON DELETE CASCADE NOT NULL,
        event_type VARCHAR(30) NOT NULL CHECK (event_type IN ('page_view', 'link_click')),
        block_id VARCHAR(100),
        visitor_hash VARCHAR(64),
        referrer_host VARCHAR(255),
        device_type VARCHAR(40),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_page_events_page_date ON page_events(page_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_page_events_page_type ON page_events(page_id, event_type, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_page_events_page_visitor ON page_events(page_id, visitor_hash);
    `);

    // Optional lead-capture blocks. Consent is required and leads are visible only to the page owner.
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id UUID REFERENCES public_pages(id) ON DELETE CASCADE NOT NULL,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(320) NOT NULL,
        message VARCHAR(2000),
        consent BOOLEAN NOT NULL DEFAULT false,
        visitor_hash VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_page_leads_page_date ON page_leads(page_id, created_at DESC);
    `);

    // Page revision history for safe edits and restore operations.
    await client.query(`
      CREATE TABLE IF NOT EXISTS page_revisions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        page_id UUID REFERENCES public_pages(id) ON DELETE CASCADE NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        revision_label VARCHAR(160) NOT NULL DEFAULT 'Saved version',
        snapshot JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_page_revisions_page_date ON page_revisions(page_id, created_at DESC);
    `);

    await client.query('COMMIT');
    console.log('[OK] Phase 2, 3 & Phase 4 database schema, tables, and indexes migrated successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Migration failed:', err.message);
    throw err;
  } finally {
    if (migrationLockAcquired) {
      try {
        await client.query('SELECT pg_advisory_unlock(71226014, 1)');
      } catch (lockErr) {
        // Releasing the PostgreSQL connection also releases a session-level advisory lock.
        console.error('[WARN] Could not explicitly release migration lock:', lockErr.message);
      }
    }
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
