import bcrypt from 'bcryptjs';
import pool, { closePool } from './pool.js';
import { config } from '../config/env.js';

export const runSeed = async () => {
  if (config.NODE_ENV === 'production') {
    console.error('❌ Refusing to run seed data in production environment.');
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create demo admin user
    const adminPasswordHash = await bcrypt.hash('demo1234', 12);
    const adminResult = await client.query(`
      INSERT INTO users (name, email, password_hash, plan, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
      RETURNING id
    `, ['Axly Admin', 'demo@axly.in', adminPasswordHash, 'pro', 'admin']);

    const userId = adminResult.rows[0].id;

    // Create standard member user
    const userPasswordHash = await bcrypt.hash('user1234', 12);
    await client.query(`
      INSERT INTO users (name, email, password_hash, plan, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
      RETURNING id
    `, ['Standard User', 'user@axly.in', userPasswordHash, 'free', 'user']);

    // Create sample URLs
    const sampleUrls = [
      { code: 'job2026', url: 'https://linkedin.com', title: 'LinkedIn Profile' },
      { code: 'resume', url: 'https://drive.google.com', title: 'My Resume' },
      { code: 'portfolio', url: 'https://github.com', title: 'Portfolio Website' },
    ];

    for (const item of sampleUrls) {
      await client.query(`
        INSERT INTO urls (short_code, original_url, title, user_id, click_count, unique_clicks)
        VALUES ($1, $2, $3, $4, 0, 0)
        ON CONFLICT (short_code) DO NOTHING
      `, [item.code, item.url, item.title, userId]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed demo data created successfully.');
    console.log('👑 Admin login: demo@axly.in / demo1234');
    console.log('👤 Member login: user@axly.in / user1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
};

if (process.argv[1]?.endsWith('seed.js')) {
  runSeed()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async () => {
      await closePool();
      process.exit(1);
    });
}
