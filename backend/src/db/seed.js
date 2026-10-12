import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import pool from './pool.js';

const seed = async () => {
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

    // Create some sample URLs
    const sampleUrls = [
      { code: 'job2026', url: 'https://linkedin.com/in/demo-user', title: 'LinkedIn Profile' },
      { code: 'resume', url: 'https://drive.google.com/file/resume.pdf', title: 'My Resume' },
      { code: 'portfolio', url: 'https://demo.github.io/portfolio', title: 'Portfolio Website' },
      { code: 'github', url: 'https://github.com/demo-user', title: 'GitHub Profile' },
      { code: nanoid(6), url: 'https://example.com/product/electronics/phones', title: 'Electronics Store' },
    ];

    for (const item of sampleUrls) {
      await client.query(`
        INSERT INTO urls (short_code, original_url, title, user_id, click_count)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (short_code) DO NOTHING
      `, [item.code, item.url, item.title, userId, Math.floor(Math.random() * 15000)]);
    }

    await client.query('COMMIT');
    console.log('✅ Seed data inserted successfully');
    console.log('📧 Demo login: demo@axly.in / demo1234');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', err);
    throw err;
  } finally {
    client.release();
  }
};

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
