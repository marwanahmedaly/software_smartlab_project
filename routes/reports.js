const express = require('express');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;
