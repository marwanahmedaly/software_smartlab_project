/**
 * @swagger
 * tags:
 *   name: Activity
 *   description: Audit logs and activity tracking
 */

const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/v1/activity:
 *   get:
 *     summary: List audit logs
 *     tags: [Activity]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: entity_type
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated audit logs }
 *       403: { description: Forbidden }
 */
// GET /api/activity — List audit logs
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { entity_type, user_id, page = 1, limit = 20 } = req.query;
  let where = '1=1';
  const params = [];
  if (entity_type) { where += ' AND entity_type = ?'; params.push(entity_type); }
  if (user_id)     { where += ' AND user_id = ?';     params.push(Number(user_id)); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM audit_logs WHERE ${where}`).get(...params).c;
  const logs = db.prepare(`
    SELECT a.*, u.name AS user_name
    FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ logs, total, page: Number(page), limit: Number(limit) });
});

/**
 * @swagger
 * /api/v1/activity/stats:
 *   get:
 *     summary: Activity summary statistics
 *     tags: [Activity]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Today, week, and top actions stats }
 *       403: { description: Forbidden }
 */
// GET /api/activity/stats — Activity summary
router.get('/stats', authenticate, authorize('admin', 'technician'), (req, res) => {
  const today = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE DATE(created_at) = DATE('now')").get().c;
  const week  = db.prepare("SELECT COUNT(*) as c FROM audit_logs WHERE created_at >= datetime('now', '-7 days')").get().c;
  const topActions = db.prepare(`
    SELECT action, COUNT(*) as count
    FROM audit_logs
    GROUP BY action
    ORDER BY count DESC
    LIMIT 5
  `).all();
  res.json({ today, week, top_actions: topActions });
});

module.exports = router;