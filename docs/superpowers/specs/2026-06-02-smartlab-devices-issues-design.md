# SmartLab — Device & Issue Management Design

| | |
|---|---|
| **Date** | 2026-06-02 |
| **Project** | SmartLab — Smart Computer Lab Management & Maintenance System |
| **Version** | 1.0.0 |
| **Tech Stack** | Node.js, Express, better-sqlite3, Multer, QRCode |

---

## Overview

The Device and Issue Management subsystems form the core operational layer of SmartLab. Devices represent the physical computer inventory; issues represent reported problems linked to those devices. The system provides full CRUD operations for devices and issues, with pagination, filtering, and search. Issues support image uploads via Multer, and resolving an issue automatically creates a maintenance log and sets the device back to `working`. Each device has a unique QR token that allows public access to its status without authentication.

---

## Device Management API

Base path: `GET|POST|PUT|PATCH|DELETE /api/devices`

All device routes (except QR public access) require authentication. Admin-only routes use `authorize('admin')`; status updates are also allowed for technicians via `authorize('admin', 'technician')`.

### List Devices (with Pagination, Filtering, Search)

```javascript
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
```

**Query Parameters:**
- `status` — filter by `working`, `broken`, or `maintenance`
- `search` — case-insensitive substring match on `name`
- `page` — page number (default: 1)
- `limit` — items per page (default: 10)

### Device Stats (Admin/Technician Only)

```javascript
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
```

### Get Device Details

```javascript
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
```

### Create Device (Admin Only)

```javascript
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
```

### Update Device (Admin Only)

```javascript
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
```

### Update Device Status (Admin/Technician)

```javascript
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
```

### Delete Device (Admin Only)

```javascript
// DELETE /api/devices/:id — Delete device (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Device deleted successfully' });
});
```

### Generate QR Code

```javascript
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
```

---

## Issue Management API

Base path: `GET|POST|PATCH /api/issues`

All issue routes require authentication. Status updates are restricted to `admin` and `technician` roles.

### Multer Configuration

```javascript
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

const router = express.Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Configure Multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only images are allowed'));
  },
});
```

**Multer settings:**
- **Storage:** disk-based, saves to `uploads/` directory with timestamp-prefixed filenames
- **File size limit:** 5 MB
- **File filter:** only `image/*` MIME types accepted
- **Static serving:** `app.js` mounts `/uploads` as a static directory

### List Issues (with Pagination, Filtering)

```javascript
// GET /api/issues — List issues
router.get('/', authenticate, (req, res) => {
  const { status, priority, device_id, page = 1, limit = 10 } = req.query;
  let where = '1=1';
  const params = [];

  if (status)    { where += ' AND i.status = ?';    params.push(status); }
  if (priority)  { where += ' AND i.priority = ?';  params.push(priority); }
  if (device_id) { where += ' AND i.device_id = ?'; params.push(device_id); }

  // Regular users see only their own issues
  if (req.user.role === 'user') {
    where += ' AND i.reported_by_id = ?';
    params.push(req.user.id);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM issues i WHERE ${where}`).get(...params).c;

  const issues = db.prepare(`
    SELECT i.*, d.name AS device_name, u.name AS reporter_name,
           r.name AS resolver_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    WHERE ${where}
    ORDER BY i.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), (Number(page) - 1) * Number(limit));

  res.json({ issues, total, page: Number(page), limit: Number(limit) });
});
```

**Query Parameters:**
- `status` — `open`, `in_progress`, `resolved`
- `priority` — `low`, `medium`, `high`
- `device_id` — filter by specific device
- `page` / `limit` — pagination

**RBAC note:** Regular `user` role can only see issues they reported. Admins and technicians see all issues.

### Get Issue Details

```javascript
// GET /api/issues/:id — Issue details
router.get('/:id', authenticate, (req, res) => {
  const issue = db.prepare(`
    SELECT i.*, d.name AS device_name, d.type AS device_type,
           u.name AS reporter_name, r.name AS resolver_name
    FROM issues i
    LEFT JOIN devices d ON i.device_id = d.id
    LEFT JOIN users   u ON i.reported_by_id = u.id
    LEFT JOIN users   r ON i.resolved_by_id = r.id
    WHERE i.id = ?
  `).get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });
  res.json({ issue });
});
```

### Submit New Issue

```javascript
// POST /api/issues — Submit new issue
router.post('/', authenticate, upload.single('image'), (req, res) => {
  const { device_id, issue_type, description, priority } = req.body;
  if (!device_id || !issue_type || !description) {
    return res.status(400).json({ error: 'Device, issue type, and description are required' });
  }

  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(device_id);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  // Update device status to broken
  db.prepare("UPDATE devices SET status = 'broken' WHERE id = ?").run(device_id);

  const image_path = req.file ? `/uploads/${req.file.filename}` : null;
  const info = db.prepare(`
    INSERT INTO issues (device_id, reported_by_id, issue_type, description, image_path, priority)
    VALUES (@device_id, @reported_by_id, @issue_type, @description, @image_path, @priority)
  `).run({
    device_id: Number(device_id),
    reported_by_id: req.user.id,
    issue_type,
    description,
    image_path,
    priority: priority || 'medium',
  });

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ issue });
});
```

**Side effect:** Submitting an issue automatically sets the linked device status to `broken`.

### Update Issue Status (Status Workflow)

```javascript
// PATCH /api/issues/:id/status — Update issue status (admin/tech)
router.patch('/:id/status', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { status, resolution_notes } = req.body;
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const issue = db.prepare('SELECT * FROM issues WHERE id = ?').get(req.params.id);
  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  const resolved_at    = status === 'resolved' ? new Date().toISOString() : null;
  const resolved_by_id = status === 'resolved' ? req.user.id : null;

  db.prepare(`
    UPDATE issues SET status=@status, resolved_at=@resolved_at,
      resolved_by_id=@resolved_by_id, resolution_notes=@resolution_notes
    WHERE id=@id
  `).run({ status, resolved_at, resolved_by_id, resolution_notes: resolution_notes || null, id: req.params.id });

  // If resolved → set device status to working + add maintenance log
  if (status === 'resolved') {
    db.prepare("UPDATE devices SET status='working', last_maintenance=date('now') WHERE id=?").run(issue.device_id);
    db.prepare(`
      INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action)
      VALUES (?, ?, ?, ?)
    `).run(issue.device_id, issue.id, req.user.id, resolution_notes || 'Issue resolved');
  }

  res.json({ message: 'Issue status updated', status });
});
```

**Status workflow:** `open` → `in_progress` → `resolved`

**Side effects on resolution:**
1. Device status changes to `working`
2. `last_maintenance` on device is set to current date
3. A maintenance log entry is auto-created linking the issue, device, and technician

### Save AI Suggestion

```javascript
// PATCH /api/issues/:id/ai — Save AI suggestion
router.patch('/:id/ai', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { ai_suggestions } = req.body;
  db.prepare('UPDATE issues SET ai_suggestions = ? WHERE id = ?').run(ai_suggestions, req.params.id);
  res.json({ message: 'Suggestion saved' });
});
```

---

## Maintenance Logs (Auto-Creation on Resolution)

Maintenance logs are **not directly created by API calls**. They are generated automatically when an issue is marked as `resolved` via `PATCH /api/issues/:id/status`.

The auto-creation logic:

```javascript
if (status === 'resolved') {
  db.prepare("UPDATE devices SET status='working', last_maintenance=date('now') WHERE id=?").run(issue.device_id);
  db.prepare(`
    INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action)
    VALUES (?, ?, ?, ?)
  `).run(issue.device_id, issue.id, req.user.id, resolution_notes || 'Issue resolved');
}
```

**Fields populated automatically:**
- `device_id` — from the resolved issue
- `issue_id` — the resolved issue's ID
- `technician_id` — the user who resolved the issue (`req.user.id`)
- `action` — the `resolution_notes` provided, or default `"Issue resolved"`
- `duration_hours` and `cost` — default to 0; can be updated later via admin intervention

---

## Public QR Access (No Authentication)

Each device has a unique `qr_token` (generated as `crypto.randomUUID()` on creation). Scanning the QR code opens a public device info page without requiring login.

### QR Redirect Route

```javascript
// routes/qr.js
const express = require('express');
const db      = require('../db/database');

const router = express.Router();

// GET /qr/:token — Open device page via QR code (no login required)
router.get('/:token', (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE qr_token = ?').get(req.params.token);
  if (!device) return res.status(404).send('Invalid or expired token');
  res.redirect(`/device.html?token=${req.params.token}`);
});

// GET /api/qr/:token/data — Device data via token (for device.html)
router.get('/:token/data', (req, res) => {
  const device = db.prepare('SELECT * FROM devices WHERE qr_token = ?').get(req.params.token);
  if (!device) return res.status(404).json({ error: 'Device not found' });

  const issues = db.prepare(`
    SELECT i.id, i.issue_type, i.description, i.status, i.priority, i.created_at
    FROM issues i
    WHERE i.device_id = ?
    ORDER BY i.created_at DESC
    LIMIT 10
  `).all(device.id);

  res.json({ device, issues });
});

module.exports = router;
```

### How it works:

1. Admin generates a QR PNG via `GET /api/devices/:id/qr`
2. The QR encodes a URL like `https://host/device.html?token=<qr_token>`
3. Visiting `/qr/:token` redirects to the device page
4. The frontend (`device.html`) fetches data from `GET /api/qr/:token/data` (no auth required)
5. The response includes device metadata and up to 10 recent issues

**Security note:** The QR token is a UUID — unguessable and unique per device. No sensitive data (passwords, internal IDs) is exposed.
