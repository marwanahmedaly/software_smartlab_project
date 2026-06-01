require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout  (client deletes the token)
router.post('/logout', authenticate, (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  // Always return same message to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If the email is registered, a reset link has been sent' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare(`
    INSERT INTO reset_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, token, expiresAt);

  // In production, send email here. For demo/testing, log to console.
  console.log(`🔐 Password reset token for ${email}: ${token}`);

  res.json({ message: 'If the email is registered, a reset link has been sent' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Token and new password (at least 6 characters) are required' });
  }

  const resetToken = db.prepare(`
    SELECT rt.*, u.email
    FROM reset_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > datetime('now')
  `).get(token);

  if (!resetToken) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  // Check if new password is same as old
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(resetToken.user_id);
  if (bcrypt.compareSync(new_password, user.password_hash)) {
    return res.status(400).json({ error: 'New password must be different from the old one' });
  }

  // Update password
  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, resetToken.user_id);

  // Mark token as used
  db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
