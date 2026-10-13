import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';
import { config } from '../config/env.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      name: user.name, 
      role: user.role || 'user',
      token_version: user.token_version || 1,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
};

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name is required and must be at least 2 characters.' 
      });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name cannot exceed 100 characters.' 
      });
    }

    // Validate email
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid email address is required.' 
      });
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 255 || !EMAIL_REGEX.test(normalizedEmail)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide a valid email address.' 
      });
    }

    // Validate password
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ 
        success: false, 
        message: 'Password is required.' 
      });
    }
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password must be at least 8 characters long.' 
      });
    }
    if (password.length > 128) {
      return res.status(400).json({ 
        success: false, 
        message: 'Password cannot exceed 128 characters.' 
      });
    }

    // Check if email already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ success: false, message: 'Email is already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      const result = await query(
        `INSERT INTO users (name, email, password_hash, role) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, name, email, plan, role, created_at`,
        [name.trim(), normalizedEmail, passwordHash, 'user']
      );

      const user = result.rows[0];
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: { id: user.id, name: user.name, email: user.email, plan: user.plan, role: user.role || 'user' }
      });
    } catch (insertErr) {
      // Handle PostgreSQL unique constraint violation race condition
      if (insertErr.code === '23505') {
        return res.status(409).json({ success: false, message: 'Email is already registered.' });
      }
      throw insertErr;
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await query(
      'SELECT id, name, email, password_hash, plan, role, avatar_url, is_active, token_version FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ success: false, message: 'Account is disabled. Contact support.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // Update last_login_at
    query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]).catch(() => {});

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        plan: user.plan,
        role: user.role || 'user',
        avatar_url: user.avatar_url || null,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, plan, role, avatar_url, bio, company, website, phone, job_title, location, created_at 
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// PATCH /api/auth/me - Update the signed-in user's profile
export const updateMe = async (req, res) => {
  try {
    const {
      name,
      avatar_url,
      avatarUrl,
      bio,
      company,
      website,
      phone,
      job_title,
      jobTitle,
      location,
    } = req.body || {};

    const cleanName = typeof name === 'string' ? name.trim() : null;
    if (cleanName !== null && (cleanName.length < 2 || cleanName.length > 80)) {
      return res.status(400).json({
        success: false,
        message: 'Display name must be between 2 and 80 characters.',
      });
    }

    // Coalesce camelCase and snake_case
    const resolvedAvatar = avatar_url !== undefined ? avatar_url : avatarUrl;
    const resolvedJobTitle = job_title !== undefined ? job_title : jobTitle;

    // Build dynamic update set safely
    const updates = [];
    const values = [];
    let idx = 1;

    if (cleanName !== null) {
      updates.push(`name = $${idx++}`);
      values.push(cleanName);
    }
    if (resolvedAvatar !== undefined) {
      updates.push(`avatar_url = $${idx++}`);
      values.push(resolvedAvatar ? String(resolvedAvatar).trim() : null);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${idx++}`);
      values.push(bio ? String(bio).trim().slice(0, 500) : null);
    }
    if (company !== undefined) {
      updates.push(`company = $${idx++}`);
      values.push(company ? String(company).trim().slice(0, 100) : null);
    }
    if (website !== undefined) {
      updates.push(`website = $${idx++}`);
      values.push(website ? String(website).trim().slice(0, 255) : null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${idx++}`);
      values.push(phone ? String(phone).trim().slice(0, 50) : null);
    }
    if (resolvedJobTitle !== undefined) {
      updates.push(`job_title = $${idx++}`);
      values.push(resolvedJobTitle ? String(resolvedJobTitle).trim().slice(0, 100) : null);
    }
    if (location !== undefined) {
      updates.push(`location = $${idx++}`);
      values.push(location ? String(location).trim().slice(0, 100) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No profile fields provided to update.' });
    }

    updates.push('updated_at = NOW()');
    values.push(req.user.id);

    const result = await query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${idx}
       RETURNING id, name, email, plan, role, avatar_url, bio, company, website, phone, job_title, location, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: result.rows[0],
    });
  } catch (err) {
    console.error('UpdateMe error:', err);
    return res.status(500).json({ success: false, message: 'Could not update profile.' });
  }
};

