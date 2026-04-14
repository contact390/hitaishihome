const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');

// Simple in-memory OTP store (for demo only)
const otps = new Map();

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ success: false, message: 'Username and password required' });

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT id, fullName, username, email, mobile, password FROM users WHERE username = ? OR email = ? LIMIT 1', [username, username]);
    conn.release();

    if (!rows || rows.length === 0) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // Strip password before returning
    const safeUser = {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      mobile: user.mobile
    };

    return res.json({ success: true, user: safeUser });
  } catch (err) {
    if (conn) conn.release();
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/get-user - accepts { identifier }
router.post('/get-user', async (req, res) => {
  const { identifier } = req.body || {};
  if (!identifier) return res.status(400).json({ success: false, message: 'Identifier required' });

  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT id, fullName, username, email, mobile FROM users WHERE username = ? OR email = ? LIMIT 1', [identifier, identifier]);
    conn.release();

    if (!rows || rows.length === 0) return res.json({ success: false, message: 'User not found' });
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    if (conn) conn.release();
    console.error('get-user error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// POST /api/send-otp - accepts { email }
router.post('/send-otp', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = Date.now() + (5 * 60 * 1000); // 5 minutes
  otps.set(email, { otp, expires });

  // NOTE: In production send email. Here we just return the OTP for testing.
  console.log(`OTP for ${email}: ${otp}`);
  return res.json({ success: true, message: 'OTP sent (check server logs in dev)', otp });
});

// POST /api/verify-otp
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ success: false, message: 'Email and OTP required' });

  const record = otps.get(email);
  if (!record) return res.status(400).json({ success: false, message: 'No OTP requested' });
  if (Date.now() > record.expires) {
    otps.delete(email);
    return res.status(400).json({ success: false, message: 'OTP expired' });
  }

  if (record.otp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
  // success
  otps.delete(email);
  return res.json({ success: true, message: 'OTP verified' });
});

// POST /api/reset-password - accepts { userId, newPassword }
router.post('/reset-password', async (req, res) => {
  const { userId, newPassword } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ success: false, message: 'userId and newPassword required' });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);
    const conn = await pool.getConnection();
    await conn.query('UPDATE users SET password = ? WHERE id = ?', [hashed, userId]);
    conn.release();
    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    console.error('reset-password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;
