import pool, { closePool } from './pool.js';
import { config } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runSeed = async () => {
  if (config.NODE_ENV === 'production') {
    console.error('[ERROR] Refusing to run seed data in production environment.');
    return;
  }

  const targetEmail = (process.env.SEED_USER_EMAIL || '').trim().toLowerCase();
  if (!targetEmail || !EMAIL_REGEX.test(targetEmail)) {
    throw new Error(
      'Set SEED_USER_EMAIL to an existing development account before seeding sample links.'
    );
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const accountResult = await client.query(
      'SELECT id, email, role FROM users WHERE email = $1 LIMIT 1',
      [targetEmail]
    );

    if (accountResult.rows.length === 0) {
      throw new Error(
        `No account found for ${targetEmail}. Register a normal account first, then run the seed command again.`
      );
    }

    const account = accountResult.rows[0];

    // Seed sample links for the explicitly selected account only.
    const sampleUrls = [
      { code: 'job2026', url: 'https://linkedin.com', title: 'LinkedIn Profile' },
      { code: 'resume', url: 'https://drive.google.com', title: 'My Resume' },
      { code: 'portfolio', url: 'https://github.com', title: 'Portfolio Website' },
    ];

    for (const item of sampleUrls) {
      await client.query(
        `INSERT INTO urls (short_code, original_url, title, user_id, click_count, unique_clicks)
         VALUES ($1, $2, $3, $4, 0, 0)
         ON CONFLICT (short_code) DO NOTHING`,
        [item.code, item.url, item.title, account.id]
      );
    }

    await client.query('COMMIT');
    console.log(
      `[OK] Sample links seeded for ${account.email} (role: ${account.role}). No demo accounts were created.`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERROR] Seed failed:', err.message);
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
