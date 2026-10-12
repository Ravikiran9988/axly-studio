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

    // Create demo user
    const passwordHash = await bcrypt.hash('demo1234', 12);
    const userResult = await client.query(`
      INSERT INTO users (name, email, password_hash, plan)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `, ['Demo User', 'demo@axly.in', passwordHash, 'pro']);

    const userId = userResult.rows[0].id;

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
    console.log('📧 Demo login: demo@axly.in / demo1234');
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
