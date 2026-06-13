/**
 * @swagger
 * tags:
 *   name: Alerts
 *   description: Smart alerts and ML predictions
 */

const express = require('express');
const db      = require('../db/database');
const { runModel } = require('../services/ml_bridge');
const { authenticate, authorize } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();

/**
 * @swagger
 * /api/v1/alerts:
 *   get:
 *     summary: List alerts
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema: { type: string }
 *       - in: query
 *         name: is_read
 *         schema: { type: integer }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200: { description: List of alerts }
 *       403: { description: Forbidden }
 */
// GET /api/alerts — List alerts (admin/tech only)
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { severity, is_read, type, page = 1, limit = 20 } = req.query;
  let where = '1=1';
  const params = [];

  if (severity !== undefined) { where += ' AND a.severity = ?'; params.push(severity); }
  if (is_read  !== undefined) { where += ' AND a.is_read = ?';  params.push(Number(is_read)); }
  if (type     !== undefined) { where += ' AND a.type = ?';     params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM alerts a WHERE ${where}`).get(...params).c;
  const alerts = db.prepare(`
    SELECT a.*, d.name AS device_name
    FROM alerts a
    LEFT JOIN devices d ON a.device_id = d.id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  const unread = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
  res.json({ alerts, unread, total, page: Number(page), limit: Number(limit) });
});

/**
 * @swagger
 * /api/v1/alerts/predictions:
 *   get:
 *     summary: Get ML model predictions
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Array of predictions }
 *       500: { description: ML error }
 */
// GET /api/alerts/predictions — Trained model predictions (admin/tech only)
router.get('/predictions', authenticate, authorize('admin', 'technician'), async (req, res) => {
  try {
    const result = await runModel('predict');
    res.json({ predictions: result.predictions || [] });
  } catch (err) {
    console.error('ML predict error:', err.message);
    res.status(500).json({ error: 'Failed to run trained prediction model' });
  }
});

/**
 * @swagger
 * /api/v1/alerts/predictions/run:
 *   post:
 *     summary: Run ML model and generate alerts
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Predictions and alerts created }
 *       500: { description: ML error }
 */
// POST /api/alerts/predictions/run — Run model manually (admin/tech)
router.post('/predictions/run', authenticate, authorize('admin', 'technician'), async (req, res) => {
  try {
    const threshold = Number(db.prepare("SELECT value FROM settings WHERE key = 'ml_threshold'").get()?.value || 30);
    const result = await runModel('predict');
    const predictions = result.predictions || [];
    let created = 0;
    for (const p of predictions) {
      if (p.score < threshold) continue;
      const existing = db.prepare(`
        SELECT id FROM alerts
        WHERE device_id = ? AND type = 'prediction' AND is_read = 0
          AND DATE(created_at) = DATE('now')
      `).get(p.device_id);
      if (!existing) {
        db.prepare(`
          INSERT INTO alerts (device_id, type, message, severity)
          VALUES (?, 'prediction', ?, ?)
        `).run(
          p.device_id,
          `🤖 Trained model prediction: Device ${p.device_name} failure probability ${p.probability} (${p.score}%)`,
          p.severity
        );
        created++;
      }
    }
    res.json({ message: `Created ${created} new alert(s)`, predictions, created });
  } catch (err) {
    console.error('ML run error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/v1/alerts/read-all:
 *   patch:
 *     summary: Mark all alerts as read
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: All marked as read }
 */
// PATCH /api/alerts/read-all — Mark all as read
router.patch('/read-all', authenticate, authorize('admin', 'technician'), (_req, res) => {
  db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ message: 'All alerts marked as read' });
});

/**
 * @swagger
 * /api/v1/alerts/{id}/read:
 *   patch:
 *     summary: Mark an alert as read
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Alert marked as read }
 *       404: { description: Alert not found }
 */
// PATCH /api/alerts/:id/read — Mark one alert as read
router.patch('/:id/read', authenticate, authorize('admin', 'technician'), (req, res) => {
  const alert = db.prepare('SELECT id FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Updated' });
});

/**
 * @swagger
 * /api/v1/alerts/{id}:
 *   delete:
 *     summary: Dismiss an alert
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Alert dismissed }
 *       404: { description: Alert not found }
 */
// DELETE /api/alerts/:id — Dismiss/delete alert
router.delete('/:id', authenticate, authorize('admin', 'technician'), (req, res) => {
  const alert = db.prepare('SELECT id FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  db.prepare('DELETE FROM alerts WHERE id = ?').run(req.params.id);
  res.json({ message: 'Alert dismissed' });
});

/**
 * @swagger
 * /api/v1/alerts/settings:
 *   get:
 *     summary: Get alert settings
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Settings object }
 */
// GET /api/alerts/settings — Get alert settings
router.get('/settings', authenticate, authorize('admin', 'technician'), (req, res) => {
  const threshold = db.prepare("SELECT value FROM settings WHERE key = 'ml_threshold'").get()?.value || '30';
  const digest = db.prepare("SELECT value FROM settings WHERE key = 'alert_email_digest'").get()?.value || '0';
  res.json({ ml_threshold: Number(threshold), alert_email_digest: digest === '1' });
});

/**
 * @swagger
 * /api/v1/alerts/settings:
 *   put:
 *     summary: Update alert settings
 *     tags: [Alerts]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ml_threshold: { type: integer, minimum: 0, maximum: 100 }
 *               alert_email_digest: { type: boolean }
 *     responses:
 *       200: { description: Settings updated }
 *       400: { description: Validation error }
 */
// PUT /api/alerts/settings — Update alert settings
router.put('/settings', authenticate, authorize('admin'),
  body('ml_threshold').optional().isInt({ min: 0, max: 100 }).withMessage('Threshold must be 0-100'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { ml_threshold, alert_email_digest } = req.body;
    if (ml_threshold !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('ml_threshold', ?)").run(String(ml_threshold));
    }
    if (alert_email_digest !== undefined) {
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('alert_email_digest', ?)").run(alert_email_digest ? '1' : '0');
    }
    res.json({ message: 'Settings updated' });
  }
);

module.exports = router;
