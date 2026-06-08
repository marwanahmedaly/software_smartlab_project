const express = require('express');
const db      = require('../db/database');
const { runModel } = require('../services/ml_bridge');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/alerts — List alerts (admin/tech only)
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { severity, is_read, type } = req.query;
  let where = '1=1';
  const params = [];

  if (severity !== undefined) { where += ' AND a.severity = ?'; params.push(severity); }
  if (is_read  !== undefined) { where += ' AND a.is_read = ?';  params.push(Number(is_read)); }
  if (type     !== undefined) { where += ' AND a.type = ?';     params.push(type); }

  const alerts = db.prepare(`
    SELECT a.*, d.name AS device_name
    FROM alerts a
    LEFT JOIN devices d ON a.device_id = d.id
    WHERE ${where}
    ORDER BY a.created_at DESC
  `).all(...params);

  const unread = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
  res.json({ alerts, unread });
});

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

// POST /api/alerts/predictions/run — Run model manually (admin/tech)
router.post('/predictions/run', authenticate, authorize('admin', 'technician'), async (req, res) => {
  try {
    const result = await runModel('predict');
    const predictions = result.predictions || [];
    let created = 0;
    for (const p of predictions) {
      if (p.score < 30) continue; // Only medium risk and above
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

// PATCH /api/alerts/read-all — Mark all as read
router.patch('/read-all', authenticate, authorize('admin', 'technician'), (_req, res) => {
  db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
  res.json({ message: 'All alerts marked as read' });
});

// PATCH /api/alerts/:id/read — Mark one alert as read
router.patch('/:id/read', authenticate, authorize('admin', 'technician'), (req, res) => {
  const alert = db.prepare('SELECT id FROM alerts WHERE id = ?').get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Updated' });
});

module.exports = router;
