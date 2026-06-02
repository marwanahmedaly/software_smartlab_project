const express  = require('express');
const crypto   = require('crypto');
const QRCode   = require('qrcode');
const db       = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

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

// POST /api/devices — Add device (admin only)
router.post('/', authenticate, authorize('admin'), (req, res) => {
  const { name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, notes } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Device name and type are required' });

  const qr_token = crypto.randomUUID();
  const info = db.prepare(`
    INSERT INTO devices (name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, qr_token, notes)
    VALUES (@name,@type,@processor,@ram,@os,@location_x,@location_y,@age_years,@status,@purchase_date,@last_maintenance,@qr_token,@notes)
  `).run({ name, type, processor, ram, os, location_x: location_x || 0, location_y: location_y || 0, age_years: age_years || 0, status: status || 'working', purchase_date: purchase_date || null, last_maintenance: last_maintenance || null, qr_token, notes: notes || null });

  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ device });
});

// PUT /api/devices/:id — Update device (admin only)
router.put('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const { name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, notes } = req.body;
  db.prepare(`
    UPDATE devices SET
      name=@name, type=@type, processor=@processor, ram=@ram, os=@os,
      location_x=@location_x, location_y=@location_y, age_years=@age_years,
      status=@status, purchase_date=@purchase_date, last_maintenance=@last_maintenance, notes=@notes
    WHERE id=@id
  `).run({ name: name || device.name, type: type || device.type, processor: processor ?? device.processor, ram: ram ?? device.ram, os: os ?? device.os, location_x: location_x ?? device.location_x, location_y: location_y ?? device.location_y, age_years: age_years ?? device.age_years, status: status || device.status, purchase_date: purchase_date ?? device.purchase_date, last_maintenance: last_maintenance ?? device.last_maintenance, notes: notes ?? device.notes, id: req.params.id });

  res.json({ device: db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id) });
});

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

// DELETE /api/devices/:id — Delete device (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Device deleted successfully' });
});

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
