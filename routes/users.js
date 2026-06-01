const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/users — List users (admin only)
router.get('/', authenticate, authorize('admin'), (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

// POST /api/users — Add user (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (!['admin', 'technician', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already in use' });

  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (@name, @email, @password_hash, @role)
  `).run({ name, email: email.trim().toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role });

  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ user });
});

// PUT /api/users/:id — Update user (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, email, password, role } = req.body;
  const password_hash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

  db.prepare(`
    UPDATE users SET name=@name, email=@email, password_hash=@password_hash, role=@role WHERE id=@id
  `).run({ name: name || user.name, email: email ? email.trim().toLowerCase() : user.email, password_hash, role: role || user.role, id: req.params.id });

  const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
  res.json({ user: updated });
});

// DELETE /api/users/:id — Delete user (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  if (Number(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own account' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
