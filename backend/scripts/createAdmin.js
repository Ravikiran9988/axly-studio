#!/usr/bin/env node
import readline from 'readline';
import bcrypt from 'bcryptjs';
import pool, { closePool } from '../src/db/pool.js';
import { query } from '../src/db/pool.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const askQuestion = (queryText) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(queryText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

const createAdmin = async () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║               Axly Studio RBAC                   ║
║         Administrator Account Provisioning       ║
╚══════════════════════════════════════════════════╝
`);

  try {
    // 1. Gather credentials (from environment or interactive prompt)
    let email = process.env.ADMIN_EMAIL || await askQuestion('Enter Administrator Email: ');
    let name = process.env.ADMIN_NAME || await askQuestion('Enter Administrator Full Name (default: Axly Admin): ');
    let password = process.env.ADMIN_PASSWORD || await askQuestion('Enter Administrator Password (min 8 characters): ');

    if (!name) name = 'Axly Administrator';

    // 2. Validate input
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
      console.error('[ERROR] A valid email address is required.');
      process.exit(1);
    }

    if (!password || password.length < 8) {
      console.error('[ERROR] Password must be at least 8 characters long.');
      process.exit(1);
    }

    console.log(`\n[INFO] Hashing password with bcrypt (12 rounds) and creating administrator...`);
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Upsert user into database
    const result = await query(
      `INSERT INTO users (name, email, password_hash, plan, role, is_active)
       VALUES ($1, $2, $3, 'pro', 'admin', true)
       ON CONFLICT (email) 
       DO UPDATE SET 
         name = EXCLUDED.name,
         password_hash = EXCLUDED.password_hash,
         role = 'admin',
         is_active = true,
         updated_at = NOW()
       RETURNING id, name, email, role, is_active, created_at;`,
      [name, normalizedEmail, passwordHash]
    );

    const user = result.rows[0];

    console.log(`
[SUCCESS] Administrator account successfully provisioned!
--------------------------------------------------
ID:       ${user.id}
Name:     ${user.name}
Email:    ${user.email}
Role:     ${user.role}
Active:   ${user.is_active}
Created:  ${user.created_at}
--------------------------------------------------
You can now sign in at http://localhost:5173/login
`);

  } catch (err) {
    console.error('[ERROR] Failed to provision administrator account:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
};

createAdmin();
