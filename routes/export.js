/**
 * @swagger
 * tags:
 *   name: Export
 *   description: CSV export endpoints
 */

const express = require('express');
const db = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Ensure exports directory exists
const EXPORT_DIR = path.join(__dirname, '..', 'exports');
if (!fs.existsSync(EXPORT_DIR)) fs.mkdirSync(EXPORT_DIR, { recursive: true });

/**
 * @swagger
 * /api/v1/export/devices:
 *   get:
 *     summary: Export devices to CSV
 *     tags: [Export]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200: { description: CSV file download }
 *       403: { description: Forbidden }
 */
// GET /api/export/devices — Export devices to CSV
router.get('/devices', authenticate, authorize('admin', 'technician'), async (req, res) => {
  const { status } = req.query;
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }

  const devices = db.prepare(`SELECT * FROM devices WHERE ${where} ORDER BY id ASC`).all(...params);

  const filePath = path.join(EXPORT_DIR, `devices-${Date.now()}.csv`);
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'name', title: 'Name' },
      { id: 'type', title: 'Type' },
      { id: 'processor', title: 'Processor' },
      { id: 'ram', title: 'RAM' },
      { id: 'os', title: 'OS' },
      { id: 'location_x', title: 'Location X' },
      { id: 'location_y', title: 'Location Y' },
      { id: 'age_years', title: 'Age (Years)' },
      { id: 'status', title: 'Status' },
      { id: 'purchase_date', title: 'Purchase Date' },
      { id: 'last_maintenance', title: 'Last Maintenance' },
      { id: 'warranty_expiry', title: 'Warranty Expiry' },
      { id: 'vendor_support', title: 'Vendor Support' },
      { id: 'asset_tag', title: 'Asset Tag' },
      { id: 'serial_number', title: 'Serial Number' },
      { id: 'notes', title: 'Notes' },
    ],
  });

  await csvWriter.writeRecords(devices);
  res.download(filePath, 'smartlab-devices.csv', (err) => {
    if (err) console.error('Download error:', err);
    fs.unlink(filePath, () => {});
  });
});

/**
 * @swagger
 * /api/v1/export/issues:
 *   get:
 *     summary: Export issues to CSV
 *     tags: [Export]
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
 *       200: { description: CSV file download }
 *       403: { description: Forbidden }
 */
// GET /api/export/issues — Export issues to CSV
router.get('/issues', authenticate, authorize('admin', 'technician'), async (req, res) => {
  const { status, from, to } = req.query;
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND i.status = ?'; params.push(status); }
  if (from && to) { where += ' AND i.created_at BETWEEN ? AND ?'; params.push(from, `${to} 23:59:59`); }

  const issues = db.prepare(`
    SELECT i.*, d.name AS device_name, u.name AS reporter_name, r.name AS resolver_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users u ON i.reported_by_id = u.id
    LEFT JOIN users r ON i.resolved_by_id = r.id
    WHERE ${where}
    ORDER BY i.created_at DESC
  `).all(...params);

  const filePath = path.join(EXPORT_DIR, `issues-${Date.now()}.csv`);
  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: 'ID' },
      { id: 'device_name', title: 'Device' },
      { id: 'issue_type', title: 'Issue Type' },
      { id: 'description', title: 'Description' },
      { id: 'status', title: 'Status' },
      { id: 'priority', title: 'Priority' },
      { id: 'reporter_name', title: 'Reporter' },
      { id: 'resolver_name', title: 'Technician' },
      { id: 'created_at', title: 'Created' },
      { id: 'resolved_at', title: 'Resolved' },
      { id: 'resolution_notes', title: 'Resolution Notes' },
    ],
  });

  await csvWriter.writeRecords(issues);
  res.download(filePath, 'smartlab-issues.csv', (err) => {
    if (err) console.error('Download error:', err);
    fs.unlink(filePath, () => {});
  });
});

module.exports = router;