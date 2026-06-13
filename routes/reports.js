/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: Analytics, reports, and insights
 */

const express = require('express');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @swagger
 * /api/v1/reports/summary:
 *   get:
 *     summary: General summary statistics
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Summary stats, charts data, top broken devices }
 *       403: { description: Forbidden }
 */
// GET /api/reports/summary — General stats with date filter (admin/tech only)
router.get('/summary', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { from, to } = req.query;
  // Use parameterized queries instead of string interpolation to prevent SQL injection
  const dateParams = [];
  const dateWhere  = from && to ? 'AND i.created_at BETWEEN ? AND ?' : '';
  if (from && to) dateParams.push(from, `${to} 23:59:59`);

  const devStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='working'     THEN 1 ELSE 0 END) AS working,
      SUM(CASE WHEN status='broken'      THEN 1 ELSE 0 END) AS broken,
      SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) AS maintenance
    FROM devices
  `).get();

  const issueStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='resolved'    THEN 1 ELSE 0 END) AS resolved,
      SUM(CASE WHEN status='open'        THEN 1 ELSE 0 END) AS open,
      SUM(CASE WHEN status='in_progress' THEN 1 ELSE 0 END) AS in_progress
    FROM issues i WHERE 1=1 ${dateWhere}
  `).get(...dateParams);

  // Average repair time in hours
  const avgFix = db.prepare(`
    SELECT AVG(
      (julianday(i.resolved_at) - julianday(i.created_at)) * 24
    ) AS avg_hours
    FROM issues i
    WHERE i.status='resolved' AND i.resolved_at IS NOT NULL ${dateWhere}
  `).get(...dateParams);

  // Most broken devices — Prefix i.created_at to avoid ambiguity in JOIN
  const topBroken = db.prepare(`
    SELECT d.id, d.name, COUNT(*) AS issue_count
    FROM issues i
    JOIN devices d ON i.device_id = d.id
    WHERE 1=1 ${dateWhere}
    GROUP BY i.device_id
    ORDER BY issue_count DESC
    LIMIT 5
  `).all(...dateParams);

  // Bar chart data (issues by month)
  const monthlyIssues = db.prepare(`
    SELECT strftime('%Y-%m', i.created_at) AS month, COUNT(*) AS count
    FROM issues i
    GROUP BY month
    ORDER BY month DESC
    LIMIT 6
  `).all().reverse();

  res.json({
    device_stats:   devStats,
    issue_stats:    issueStats,
    avg_fix_hours:  avgFix.avg_hours,
    top_broken:     topBroken,
    monthly_issues: monthlyIssues,
  });
});

/**
 * @swagger
 * /api/v1/reports/maintenance:
 *   get:
 *     summary: Maintenance logs with filters
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200: { description: Maintenance logs }
 *       403: { description: Forbidden }
 */
// GET /api/reports/maintenance — Maintenance logs with filter
router.get('/maintenance', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { from, to, status, page = 1, limit = 10 } = req.query;
  let where = '1=1';
  const params = [];

  if (from && to) { where += " AND i.created_at BETWEEN ? AND ?"; params.push(from, `${to} 23:59:59`); }
  if (status)     { where += ' AND i.status = ?'; params.push(status); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM issues i WHERE ${where}`).get(...params).c;

  const logs = db.prepare(`
    SELECT i.id, i.issue_type, i.description, i.status, i.priority,
           i.created_at, i.resolved_at, i.resolution_notes,
           d.name AS device_name,
           u.name AS reporter_name,
           r.name AS technician_name,
           ml.duration_hours, ml.cost
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    LEFT JOIN maintenance_logs ml ON ml.issue_id = i.id
    WHERE ${where}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ logs, total, page: Number(page), limit: Number(limit) });
});

/**
 * @swagger
 * /api/v1/reports/technicians:
 *   get:
 *     summary: Technician performance report
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         schema: { type: string, format: date }
 *     responses:
 *       200: { description: Array of technician performance stats }
 *       403: { description: Forbidden }
 */
// GET /api/reports/technicians — Technician performance
router.get('/technicians', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { from, to } = req.query;
  let dateWhere = '';
  const params = [];
  if (from && to) { dateWhere = ' AND i.created_at BETWEEN ? AND ?'; params.push(from, `${to} 23:59:59`); }

  const technicians = db.prepare(`
    SELECT
      u.id,
      u.name,
      COUNT(i.id) as total_resolved,
      AVG((julianday(i.resolved_at) - julianday(i.created_at)) * 24) as avg_hours,
      SUM(ml.cost) as total_cost,
      SUM(ml.duration_hours) as total_hours
    FROM users u
    LEFT JOIN issues i ON i.resolved_by_id = u.id AND i.status = 'resolved'
    LEFT JOIN maintenance_logs ml ON ml.issue_id = i.id
    WHERE u.role = 'technician' ${dateWhere}
    GROUP BY u.id
    ORDER BY total_resolved DESC
  `).all(...params);

  res.json({ technicians });
});

/**
 * @swagger
 * /api/v1/reports/inventory:
 *   get:
 *     summary: Inventory cost summary
 *     tags: [Reports]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Inventory summary and category breakdown }
 *       403: { description: Forbidden }
 */
// GET /api/reports/inventory — Inventory cost summary
router.get('/inventory', authenticate, authorize('admin', 'technician'), (_req, res) => {
  const summary = db.prepare(`
    SELECT
      COUNT(*) as total_parts,
      SUM(quantity) as total_stock,
      SUM(quantity * unit_cost) as total_value,
      SUM(CASE WHEN quantity <= min_stock THEN 1 ELSE 0 END) as low_stock_count
    FROM inventory_parts
  `).get();

  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(quantity) as stock, SUM(quantity * unit_cost) as value
    FROM inventory_parts
    GROUP BY category
    ORDER BY value DESC
  `).all();

  res.json({ summary, by_category: byCategory });
});

module.exports = router;
