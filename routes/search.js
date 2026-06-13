/**
 * @swagger
 * tags:
 *   name: Search
 *   description: Full-text search across entities
 */

const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     summary: Full-text search across devices, issues, and inventory
 *     tags: [Search]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string, minLength: 2 }
 *     responses:
 *       200: { description: Search results grouped by entity }
 *       400: { description: Query too short }
 *       403: { description: Forbidden }
 */
// GET /api/search — Full-text search across devices, issues, inventory
router.get('/', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { q, limit = 10 } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }
  const query = `%${q.trim()}%`;

  const devices = db.prepare(`
    SELECT id, name, type, status, 'device' as entity
    FROM devices
    WHERE name LIKE ? OR type LIKE ? OR processor LIKE ? OR notes LIKE ? OR asset_tag LIKE ? OR serial_number LIKE ?
    LIMIT ?
  `).all(query, query, query, query, query, query, Number(limit));

  const issues = db.prepare(`
    SELECT i.id, i.issue_type, i.description, i.status, d.name as device_name, 'issue' as entity
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    WHERE i.issue_type LIKE ? OR i.description LIKE ? OR i.resolution_notes LIKE ?
    LIMIT ?
  `).all(query, query, query, Number(limit));

  const parts = db.prepare(`
    SELECT id, name, category, quantity, 'inventory' as entity
    FROM inventory_parts
    WHERE name LIKE ? OR category LIKE ? OR supplier LIKE ? OR location LIKE ?
    LIMIT ?
  `).all(query, query, query, query, Number(limit));

  res.json({
    query: q.trim(),
    results: {
      devices,
      issues,
      inventory: parts,
    },
    total: devices.length + issues.length + parts.length,
  });
});

module.exports = router;