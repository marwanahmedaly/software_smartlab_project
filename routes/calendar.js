/**
 * @swagger
 * tags:
 *   name: Calendar
 *   description: Maintenance scheduling calendar
 */

const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @swagger
 * /api/v1/calendar:
 *   get:
 *     summary: List maintenance schedules
 *     tags: [Calendar]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Paginated schedules }
 *       403: { description: Forbidden }
 */
// GET /api/calendar — List maintenance schedules
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { status, from, to, technician_id, page = 1, limit = 20 } = req.query;
  let where = '1=1';
  const params = [];
  if (status)        { where += ' AND ms.status = ?'; params.push(status); }
  if (technician_id) { where += ' AND ms.technician_id = ?'; params.push(Number(technician_id)); }
  if (from && to)    { where += ' AND ms.scheduled_at BETWEEN ? AND ?'; params.push(from, to); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM maintenance_schedules ms WHERE ${where}`).get(...params).c;
  const schedules = db.prepare(`
    SELECT ms.*, d.name as device_name, u.name as technician_name
    FROM maintenance_schedules ms
    LEFT JOIN devices d ON ms.device_id = d.id
    LEFT JOIN users u ON ms.technician_id = u.id
    WHERE ${where}
    ORDER BY ms.scheduled_at ASC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ schedules, total, page: Number(page), limit: Number(limit) });
});

// GET /api/calendar/:id
router.get('/:id', authenticate, authorize('admin', 'technician'), (req, res) => {
  const schedule = db.prepare(`
    SELECT ms.*, d.name as device_name, u.name as technician_name
    FROM maintenance_schedules ms
    LEFT JOIN devices d ON ms.device_id = d.id
    LEFT JOIN users u ON ms.technician_id = u.id
    WHERE ms.id = ?
  `).get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  res.json({ schedule });
});

/**
 * @swagger
 * /api/v1/calendar:
 *   post:
 *     summary: Create a maintenance schedule
 *     tags: [Calendar]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, scheduled_at]
 *             properties:
 *               title: { type: string }
 *               device_id: { type: integer }
 *               description: { type: string }
 *               scheduled_at: { type: string, format: date-time }
 *               technician_id: { type: integer }
 *     responses:
 *       201: { description: Schedule created }
 *       400: { description: Validation error }
 */
// POST /api/calendar — Create schedule
router.post('/', authenticate, authorize('admin', 'technician'),
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('scheduled_at').isISO8601().withMessage('Valid scheduled date is required'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { device_id, title, description, scheduled_at, technician_id } = req.body;
    const info = db.prepare(`
      INSERT INTO maintenance_schedules (device_id, title, description, scheduled_at, technician_id, created_by)
      VALUES (@device_id, @title, @description, @scheduled_at, @technician_id, @created_by)
    `).run({
      device_id: device_id || null,
      title,
      description: description || null,
      scheduled_at,
      technician_id: technician_id || null,
      created_by: req.user.id,
    });
    const schedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(info.lastInsertRowid);

    // Create alert for technician if assigned
    if (technician_id) {
      const tech = db.prepare('SELECT name FROM users WHERE id = ?').get(Number(technician_id));
      const device = device_id ? db.prepare('SELECT name FROM devices WHERE id = ?').get(Number(device_id)) : null;
      db.prepare(`
        INSERT INTO alerts (device_id, type, message, severity)
        VALUES (?, 'assignment', ?, 'medium')
      `).run(
        device_id || null,
        `New maintenance task scheduled: "${title}" on ${device?.name || 'device'} — ${new Date(scheduled_at).toLocaleDateString()} — assigned to ${tech?.name || 'technician'}`
      );
    }

    res.status(201).json({ schedule });
  }
);

// PUT /api/calendar/:id — Update schedule
router.put('/:id', authenticate, authorize('admin', 'technician'), (req, res) => {
  const schedule = db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

  const { device_id, title, description, scheduled_at, status, technician_id } = req.body;
  db.prepare(`
    UPDATE maintenance_schedules SET
      device_id=@device_id, title=@title, description=@description,
      scheduled_at=@scheduled_at, status=@status, technician_id=@technician_id
    WHERE id=@id
  `).run({
    device_id: device_id ?? schedule.device_id,
    title: title || schedule.title,
    description: description ?? schedule.description,
    scheduled_at: scheduled_at || schedule.scheduled_at,
    status: status || schedule.status,
    technician_id: technician_id ?? schedule.technician_id,
    id: req.params.id,
  });
  res.json({ schedule: db.prepare('SELECT * FROM maintenance_schedules WHERE id = ?').get(req.params.id) });
});

// DELETE /api/calendar/:id
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const schedule = db.prepare('SELECT id FROM maintenance_schedules WHERE id = ?').get(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found' });
  db.prepare('DELETE FROM maintenance_schedules WHERE id = ?').run(req.params.id);
  res.json({ message: 'Schedule deleted' });
});

module.exports = router;