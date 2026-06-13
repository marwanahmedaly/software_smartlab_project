/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management (admin only)
 */

const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

/**
 * @swagger
 * /api/v1/users:
 *   get:
 *     summary: List all users
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Array of users }
 *       403: { description: Forbidden }
 */
// GET /api/users — List users (admin only)
router.get('/', authenticate, authorize('admin'), (_req, res) => {
  const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY id ASC').all();
  res.json({ users });
});

/**
 * @swagger
 * /api/v1/users:
 *   post:
 *     summary: Add a new user
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [admin, technician, user] }
 *     responses:
 *       201: { description: User created }
 *       400: { description: Validation error }
 *       409: { description: Email already in use }
 *       403: { description: Forbidden }
 */
// POST /api/users — Add user (admin only)
router.post('/', authenticate, authorize('admin'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('role').isIn(['admin', 'technician', 'user']).withMessage('Invalid role'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, email, password, role } = req.body;
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (exists) return res.status(409).json({ error: 'Email already in use' });

    const info = db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (@name, @email, @password_hash, @role)
    `).run({ name, email: email.trim().toLowerCase(), password_hash: bcrypt.hashSync(password, 10), role });

    const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ user });
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   put:
 *     summary: Update a user
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               role: { type: string, enum: [admin, technician, user] }
 *     responses:
 *       200: { description: User updated }
 *       404: { description: User not found }
 *       403: { description: Forbidden }
 */
// PUT /api/users/:id — Update user (admin only)
router.put('/:id', authenticate, authorize('admin'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('role').optional().isIn(['admin', 'technician', 'user']).withMessage('Invalid role'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, password, role } = req.body;
    const password_hash = password ? bcrypt.hashSync(password, 10) : user.password_hash;

    db.prepare(`
      UPDATE users SET name=@name, email=@email, password_hash=@password_hash, role=@role WHERE id=@id
    `).run({
      name: name || user.name,
      email: email ? email.trim().toLowerCase() : user.email,
      password_hash,
      role: role || user.role,
      id: req.params.id,
    });

    const updated = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.params.id);
    res.json({ user: updated });
  }
);

/**
 * @swagger
 * /api/v1/users/{id}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Users]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: User deleted }
 *       400: { description: Cannot delete self }
 *       404: { description: User not found }
 *       403: { description: Forbidden }
 */
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
