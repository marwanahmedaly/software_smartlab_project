/**
 * @swagger
 * tags:
 *   name: Issues
 *   description: Issue reporting and management
 */

const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});

/**
 * @swagger
 * /api/v1/issues:
 *   get:
 *     summary: List issues
 *     tags: [Issues]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: priority
 *         schema: { type: string }
 *       - in: query
 *         name: device_id
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of issues }
 *       401: { description: Unauthorized }
 */
// GET /api/issues — List issues
router.get('/', authenticate, (req, res) => {
  const { status, priority, device_id, assigned_to_id, page = 1, limit = 10 } = req.query;
  let where = '1=1';
  const params = [];

  if (status)        { where += ' AND i.status = ?';        params.push(status); }
  if (priority)      { where += ' AND i.priority = ?';      params.push(priority); }
  if (device_id)     { where += ' AND i.device_id = ?';     params.push(device_id); }
  if (assigned_to_id){ where += ' AND i.assigned_to_id = ?'; params.push(Number(assigned_to_id)); }

  // Regular users see only their own issues
  if (req.user.role === 'user') {
    where += ' AND i.reported_by_id = ?';
    params.push(req.user.id);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM issues i WHERE ${where}`).get(...params).c;

  const issues = db.prepare(`
    SELECT i.*, d.name AS device_name, u.name AS reporter_name,
           r.name AS resolver_name, a.name AS assigned_to_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    LEFT JOIN users   a ON i.assigned_to_id = a.id
    WHERE ${where}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ issues, total, page: Number(page), limit: Number(limit) });
});

/**
 * @swagger
 * /api/v1/issues/{id}:
 *   get:
 *     summary: Get issue details
 *     tags: [Issues]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Issue object }
 *       404: { description: Issue not found }
 */
// GET /api/issues/:id — Issue details
router.get('/:id', authenticate, (req, res) => {
  const issue = db.prepare(`
    SELECT i.*, d.name AS device_name, d.type AS device_type,
           u.name AS reporter_name, r.name AS resolver_name,
           a.name AS assigned_to_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    LEFT JOIN users   a ON i.assigned_to_id = a.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json({ issue });
});

/**
 * @swagger
 * /api/v1/issues:
 *   post:
 *     summary: Submit a new issue
 *     tags: [Issues]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               device_id: { type: integer }
 *               issue_type: { type: string }
 *               description: { type: string }
 *               priority: { type: string, enum: [low, medium, high] }
 *               image: { type: string, format: binary }
 *     responses:
 *       201: { description: Issue created }
 *       400: { description: Validation error }
 *       404: { description: Device not found }
 */
// POST /api/issues — Submit new issue
router.post('/', authenticate, upload.single('image'),
  body('device_id').notEmpty().withMessage('Device is required'),
  body('issue_type').trim().notEmpty().withMessage('Issue type is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { device_id, issue_type, description, priority } = req.body;
    const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(device_id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const image_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Transaction: update device status and insert issue atomically
    const transaction = db.transaction(() => {
      db.prepare("UPDATE devices SET status = 'broken' WHERE id = ?").run(device_id);
      const info = db.prepare(`
        INSERT INTO issues (device_id, reported_by_id, issue_type, description, image_path, priority)
        VALUES (@device_id, @reported_by_id, @issue_type, @description, @image_path, @priority)
      `).run({
        device_id: Number(device_id),
        reported_by_id: req.user.id,
        issue_type,
        description,
        image_path,
        priority: priority || 'medium',
      });
      return info.lastInsertRowid;
    });

    const issueId = transaction();
    const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issueId);
    res.status(201).json({ issue });
  }
);

/**
 * @swagger
 * /api/v1/issues/{id}/status:
 *   patch:
 *     summary: Update issue status
 *     tags: [Issues]
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
 *               status: { type: string, enum: [open, in_progress, resolved] }
 *               resolution_notes: { type: string }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status }
 *       404: { description: Issue not found }
 */
// PATCH /api/issues/:id/status — Update issue status (admin/tech)
router.patch('/:id/status', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { status, resolution_notes } = req.body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const resolved_at    = status === 'resolved' ? new Date().toISOString() : null;
  const resolved_by_id = status === 'resolved' ? req.user.id : null;

  // Transaction for atomic update
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE issues SET status=@status, resolved_at=@resolved_at,
        resolved_by_id=@resolved_by_id, resolution_notes=@resolution_notes
      WHERE id=@id
    `).run({ status, resolved_at, resolved_by_id, resolution_notes: resolution_notes || null, id: req.params.id });

    // If in_progress → set device status to maintenance
    if (status === 'in_progress') {
      db.prepare("UPDATE devices SET status='maintenance' WHERE id=?").run(issue.device_id);
    }

    // If resolved → set device status to working + add maintenance log
    if (status === 'resolved') {
      db.prepare("UPDATE devices SET status='working', last_maintenance=date('now') WHERE id=?").run(issue.device_id);
      db.prepare(`
        INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action)
        VALUES (?, ?, ?, ?)
      `).run(issue.device_id, issue.id, req.user.id, resolution_notes || 'Issue resolved');
    }
  });

  transaction();
  res.json({ message: 'Issue status updated', status });
});

/**
 * @swagger
 * /api/v1/issues/{id}/ai:
 *   patch:
 *     summary: Save AI suggestion to issue
 *     tags: [Issues]
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
 *               ai_suggestions: { type: string }
 *     responses:
 *       200: { description: Suggestion saved }
 *       404: { description: Issue not found }
 */
// PATCH /api/issues/:id/ai — Save AI suggestion
router.patch('/:id/ai', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { ai_suggestions } = req.body;
  db.prepare('UPDATE issues SET ai_suggestions = ? WHERE id = ?').run(ai_suggestions, req.params.id);
  res.json({ message: 'Suggestion saved' });
});

/**
 * @swagger
 * /api/v1/issues/{id}/assign:
 *   patch:
 *     summary: Assign an issue to a technician
 *     tags: [Issues]
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
 *               assigned_to_id: { type: integer }
 *     responses:
 *       200: { description: Issue assigned }
 *       400: { description: Invalid technician ID }
 *       404: { description: Issue not found }
 */
// PATCH /api/issues/:id/assign — Assign issue to technician
router.patch('/:id/assign', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { assigned_to_id } = req.body;
  if (!assigned_to_id || isNaN(Number(assigned_to_id))) {
    return res.status(400).json({ error: 'assigned_to_id is required' });
  }

  const technician = db.prepare('SELECT id, role FROM users WHERE id = ?').get(Number(assigned_to_id));
  if (!technician) return res.status(404).json({ error: 'Technician not found' });
  if (technician.role !== 'technician') {
    return res.status(400).json({ error: 'Can only assign to a technician role' });
  }

  const issue = db.prepare('SELECT id, device_id, issue_type FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  // Update assignment and set device to maintenance
  const transaction = db.transaction(() => {
    db.prepare('UPDATE issues SET assigned_to_id = ? WHERE id = ?').run(Number(assigned_to_id), req.params.id);
    db.prepare("UPDATE devices SET status='maintenance' WHERE id=?").run(issue.device_id);
  });
  transaction();

  // Create alert for technician
  const device = db.prepare('SELECT name FROM devices WHERE id = ?').get(issue.device_id);
  const techUser = db.prepare('SELECT name FROM users WHERE id = ?').get(Number(assigned_to_id));
  db.prepare(`
    INSERT INTO alerts (device_id, type, message, severity)
    VALUES (?, 'assignment', ?, 'medium')
  `).run(issue.device_id, `New issue assigned: "${issue.issue_type}" on ${device?.name || 'device'} — assigned to ${techUser?.name || 'technician'}`);

  const updated = db.prepare(`
    SELECT i.*, d.name AS device_name, u.name AS reporter_name,
           r.name AS resolver_name, a.name AS assigned_to_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    LEFT JOIN users   a ON i.assigned_to_id = a.id
    WHERE i.id = ?
  `).get(req.params.id);

  res.json({ message: 'Issue assigned to technician', issue: updated });
});

/**
 * @swagger
 * /api/v1/issues/{id}/auto-assign:
 *   post:
 *     summary: Auto-assign issue to least busy technician
 *     tags: [Issues]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Issue auto-assigned }
 *       404: { description: Issue not found or no technicians available }
 */
// POST /api/issues/:id/auto-assign — Auto-assign to least busy technician
router.post('/:id/auto-assign', authenticate, authorize('admin', 'technician'), (req, res) => {
  const issue = db.prepare('SELECT id, device_id, issue_type FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  // Find the technician with fewest open/in_progress issues
  const tech = db.prepare(`
    SELECT u.id, u.name, COUNT(i.id) AS load
    FROM users u
    LEFT JOIN issues i ON i.assigned_to_id = u.id AND i.status IN ('open', 'in_progress')
    WHERE u.role = 'technician'
    GROUP BY u.id
    ORDER BY load ASC, u.id ASC
    LIMIT 1
  `).get();

  if (!tech) return res.status(404).json({ error: 'No technicians available' });

  // Update assignment and set device to maintenance
  const transaction = db.transaction(() => {
    db.prepare('UPDATE issues SET assigned_to_id = ? WHERE id = ?').run(tech.id, req.params.id);
    db.prepare("UPDATE devices SET status='maintenance' WHERE id=?").run(issue.device_id);
  });
  transaction();

  // Create alert for technician
  const device = db.prepare('SELECT name FROM devices WHERE id = ?').get(issue.device_id);
  db.prepare(`
    INSERT INTO alerts (device_id, type, message, severity)
    VALUES (?, 'assignment', ?, 'medium')
  `).run(issue.device_id, `New issue assigned: "${issue.issue_type}" on ${device?.name || 'device'} — assigned to ${tech.name}`);

  const updated = db.prepare(`
    SELECT i.*, d.name AS device_name, u.name AS reporter_name,
           r.name AS resolver_name, a.name AS assigned_to_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    LEFT JOIN users   a ON i.assigned_to_id = a.id
    WHERE i.id = ?
  `).get(req.params.id);

  res.json({ message: `Issue auto-assigned to ${tech.name}`, issue: updated });
});

module.exports = router;
