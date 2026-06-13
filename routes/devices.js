/**
 * @swagger
 * tags:
 *   name: Devices
 *   description: Device management, QR codes, stats
 */

const express  = require('express');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const db       = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');
const { body, param, validationResult } = require('express-validator');

const router = express.Router();

/**
 * @swagger
 * /api/v1/devices:
 *   get:
 *     summary: List all devices
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200: { description: Paginated list of devices }
 *       401: { description: Unauthorized }
 */
// GET /api/devices — List devices
router.get('/', authenticate, (req, res) => {
  const { status, search, page = 1, limit = 10 } = req.query;
  let query  = 'SELECT * FROM devices WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) { query += ' AND name LIKE ?'; params.push(`%${search}%`); }

  const total = db.prepare(`SELECT COUNT(*) as c FROM devices WHERE 1=1${status ? ' AND status=?' : ''}${search ? ' AND name LIKE ?' : ''}`).get(...params).c;
  query += ' ORDER BY id ASC LIMIT ? OFFSET ?';
  params.push(Number(limit), (Number(page) - 1) * Number(limit));

  const devices = db.prepare(query).all(...params);
  res.json({ devices, total, page: Number(page), limit: Number(limit) });
});

/**
 * @swagger
 * /api/v1/devices/stats:
 *   get:
 *     summary: Device statistics
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Total, working, broken, maintenance counts }
 *       403: { description: Forbidden }
 */
// GET /api/devices/stats — Device stats (admin/tech only)
router.get('/stats', authenticate, authorize('admin', 'technician'), (req, res) => {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='working'     THEN 1 ELSE 0 END) AS working,
      SUM(CASE WHEN status='broken'      THEN 1 ELSE 0 END) AS broken,
      SUM(CASE WHEN status='maintenance' THEN 1 ELSE 0 END) AS maintenance
    FROM devices
  `).get();
  res.json(stats);
});

/**
 * @swagger
 * /api/v1/devices/{id}:
 *   get:
 *     summary: Get device details
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Device object with recent issues }
 *       404: { description: Device not found }
 */
// GET /api/devices/:id — Device details
router.get('/:id', authenticate, (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const issues = db.prepare(`
    SELECT i.*, u.name AS reporter_name
    FROM issues i
    LEFT JOIN users u ON i.reported_by_id = u.id
    WHERE i.device_id = ?
    ORDER BY i.created_at DESC
    LIMIT 5
  `).all(req.params.id);

  res.json({ device, recent_issues: issues });
});

/**
 * @swagger
 * /api/v1/devices:
 *   post:
 *     summary: Add a new device
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name: { type: string }
 *               type: { type: string }
 *               processor: { type: string }
 *               ram: { type: string }
 *               os: { type: string }
 *               location_x: { type: integer }
 *               location_y: { type: integer }
 *               age_years: { type: number }
 *               status: { type: string, enum: [working, broken, maintenance] }
 *               purchase_date: { type: string, format: date }
 *               last_maintenance: { type: string, format: date }
 *               warranty_expiry: { type: string, format: date }
 *               vendor_support: { type: string }
 *               asset_tag: { type: string }
 *               serial_number: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Device created }
 *       400: { description: Validation error }
 *       403: { description: Forbidden }
 */
// POST /api/devices — Add device (admin only)
router.post('/', authenticate, authorize('admin'),
  body('name').trim().notEmpty().withMessage('Device name is required'),
  body('type').trim().notEmpty().withMessage('Device type is required'),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, notes, warranty_expiry, vendor_support, asset_tag, serial_number } = req.body;
    const qr_token = crypto.randomUUID();
    const info = db.prepare(`
      INSERT INTO devices (name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, qr_token, notes, warranty_expiry, vendor_support, asset_tag, serial_number)
      VALUES (@name,@type,@processor,@ram,@os,@location_x,@location_y,@age_years,@status,@purchase_date,@last_maintenance,@qr_token,@notes,@warranty_expiry,@vendor_support,@asset_tag,@serial_number)
    `).run({
      name, type, processor, ram, os,
      location_x: location_x || 0, location_y: location_y || 0,
      age_years: age_years || 0, status: status || 'working',
      purchase_date: purchase_date || null, last_maintenance: last_maintenance || null,
      qr_token, notes: notes || null,
      warranty_expiry: warranty_expiry || null,
      vendor_support: vendor_support || null,
      asset_tag: asset_tag || null,
      serial_number: serial_number || null,
    });

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ device });
  }
);

/**
 * @swagger
 * /api/v1/devices/{id}:
 *   put:
 *     summary: Update a device
 *     tags: [Devices]
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
 *               type: { type: string }
 *               status: { type: string, enum: [working, broken, maintenance] }
 *     responses:
 *       200: { description: Device updated }
 *       404: { description: Device not found }
 *       403: { description: Forbidden }
 */
// PUT /api/devices/:id — Update device (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, notes, warranty_expiry, vendor_support, asset_tag, serial_number } = req.body;
  db.prepare(`
    UPDATE devices SET
      name=@name, type=@type, processor=@processor, ram=@ram, os=@os,
      location_x=@location_x, location_y=@location_y, age_years=@age_years,
      status=@status, purchase_date=@purchase_date, last_maintenance=@last_maintenance, notes=@notes,
      warranty_expiry=@warranty_expiry, vendor_support=@vendor_support, asset_tag=@asset_tag, serial_number=@serial_number
    WHERE id=@id
  `).run({
    name: name || device.name, type: type || device.type,
    processor: processor ?? device.processor, ram: ram ?? device.ram, os: os ?? device.os,
    location_x: location_x ?? device.location_x, location_y: location_y ?? device.location_y,
    age_years: age_years ?? device.age_years, status: status || device.status,
    purchase_date: purchase_date ?? device.purchase_date, last_maintenance: last_maintenance ?? device.last_maintenance,
    notes: notes ?? device.notes,
    warranty_expiry: warranty_expiry ?? device.warranty_expiry,
    vendor_support: vendor_support ?? device.vendor_support,
    asset_tag: asset_tag ?? device.asset_tag,
    serial_number: serial_number ?? device.serial_number,
    id: req.params.id,
  });

  res.json({ device: db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) });
});

/**
 * @swagger
 * /api/v1/devices/{id}/status:
 *   patch:
 *     summary: Update device status
 *     tags: [Devices]
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
 *               status: { type: string, enum: [working, broken, maintenance] }
 *     responses:
 *       200: { description: Status updated }
 *       400: { description: Invalid status }
 *       404: { description: Device not found }
 */
// PATCH /api/devices/:id/status — Update device status (admin/tech)
router.patch('/:id/status', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { status } = req.body;
  if (!['working', 'broken', 'maintenance'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }
  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  db.prepare('UPDATE devices SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated', status });
});

/**
 * @swagger
 * /api/v1/devices/{id}:
 *   delete:
 *     summary: Delete a device
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Device deleted }
 *       404: { description: Device not found }
 *       403: { description: Forbidden }
 */
// DELETE /api/devices/:id — Delete device (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Device deleted successfully' });
});

/**
 * @swagger
 * /api/v1/devices/workload:
 *   get:
 *     summary: Technician workload statistics
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200: { description: Array of technician workload stats }
 *       403: { description: Forbidden }
 */
// GET /api/devices/workload — Technician workload stats
router.get('/workload', authenticate, authorize('admin', 'technician'), (req, res) => {
  const workload = db.prepare(`
    SELECT
      u.id,
      u.name,
      COUNT(i.id) as total_issues,
      SUM(CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END) as resolved,
      SUM(CASE WHEN i.status = 'open' THEN 1 ELSE 0 END) as open,
      SUM(CASE WHEN i.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      AVG((julianday(i.resolved_at) - julianday(i.created_at)) * 24) as avg_hours
    FROM users u
    LEFT JOIN issues i ON i.resolved_by_id = u.id
    WHERE u.role = 'technician'
    GROUP BY u.id
    ORDER BY total_issues DESC
  `).all();
  res.json({ workload });
});

/**
 * @swagger
 * /api/v1/devices/{id}/qr:
 *   get:
 *     summary: Download device QR code as PNG
 *     tags: [Devices]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: PNG image }
 *       404: { description: Device not found }
 */
// GET /api/devices/:id/qr — Download QR code as PNG
router.get('/:id/qr', authenticate, async (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const url     = `${baseUrl}/device.html?token=${device.qr_token}`;

  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `attachment; filename="QR-${device.name}.png"`);
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

module.exports = router;
