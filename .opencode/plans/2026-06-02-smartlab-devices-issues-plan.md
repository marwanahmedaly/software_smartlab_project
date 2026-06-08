# SmartLab Device & Issue Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build device CRUD with pagination/filtering, QR code generation, public QR access, issue reporting with image uploads, and status workflow with auto-maintenance log creation.

**Architecture:** Express routers mounted under `/api/devices` and `/api/issues`, parameterized SQL queries, Multer for file uploads, QRCode library for PNG generation, and automatic maintenance log insertion on issue resolution.

**Tech Stack:** Node.js, Express, better-sqlite3, Multer, qrcode, crypto

---

## File Structure

| File | Responsibility |
|---|---|
| `routes/devices.js` | Device CRUD, stats, QR generation |
| `routes/issues.js` | Issue list, create, status workflow, AI suggestions |
| `routes/qr.js` | Public QR token redirect and data endpoints (no auth) |
| `app.js` | Route mounting, static file serving for uploads |

---

### Task 1: Implement Device Management API (List with Pagination/Filtering)

**Files:**
- Create: `routes/devices.js`

- [ ] **Step 1: Write list endpoint with pagination, filtering, and search**

```javascript
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
```

- [ ] **Step 2: Verify list endpoint with curl**

Run (server must be running with seeded data):
```bash
curl -X GET http://localhost:3000/api/devices \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: JSON with `devices` array of 10 items, `total: 20`, `page: 1`, `limit: 10`

- [ ] **Step 3: Test filtering by status**

Run:
```bash
curl -X GET "http://localhost:3000/api/devices?status=broken" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `total: 5`, all returned devices have `status: 'broken'`

- [ ] **Step 4: Test search by name**

Run:
```bash
curl -X GET "http://localhost:3000/api/devices?search=PC-01" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `total: 1`, device name is `PC-01`

- [ ] **Step 5: Commit**

```bash
git add routes/devices.js
git commit -m "feat: add device list endpoint with pagination, filtering, and search"
```

---

### Task 2: Implement Device Statistics Endpoint

**Files:**
- Modify: `routes/devices.js`

- [ ] **Step 1: Add stats endpoint (admin/technician only)**

Add after the list endpoint in `routes/devices.js`:

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

- [ ] **Step 2: Verify stats endpoint**

Run:
```bash
curl -X GET http://localhost:3000/api/devices/stats \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `{"total":20,"working":12,"broken":5,"maintenance":3}`

- [ ] **Step 3: Verify regular user is denied access**

Run:
```bash
curl -X GET http://localhost:3000/api/devices/stats \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"
```
Expected: `{"error":"You do not have permission for this operation"}` with status 403

- [ ] **Step 4: Commit**

```bash
git add routes/devices.js
git commit -m "feat: add device statistics endpoint with admin/technician RBAC"
```

---

### Task 3: Implement Device CRUD (Create, Update, Delete)

**Files:**
- Modify: `routes/devices.js`

- [ ] **Step 1: Add GET /:id — Device details**

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

- [ ] **Step 2: Add POST / — Create device (admin only)**

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

- [ ] **Step 3: Add PUT /:id — Update device (admin only)**

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

- [ ] **Step 4: Add PATCH /:id/status — Update device status (admin/tech)**

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

- [ ] **Step 5: Add DELETE /:id — Delete device (admin only)**

```javascript
// DELETE /api/devices/:id — Delete device (admin only)
router.delete('/:id', authenticate, authorize('admin'), (req, res) => {
  const device = db.prepare('SELECT id FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Device deleted successfully' });
});
```

- [ ] **Step 6: Test device CRUD end-to-end**

Create:
```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"PC-TEST","type":"Dell OptiPlex"}'
```
Expected: `{"device":{"id":21,"name":"PC-TEST",...}}`

Update:
```bash
curl -X PUT http://localhost:3000/api/devices/21 \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"PC-TEST-UPDATED"}'
```
Expected: `{"device":{"id":21,"name":"PC-TEST-UPDATED",...}}`

Delete:
```bash
curl -X DELETE http://localhost:3000/api/devices/21 \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `{"message":"Device deleted successfully"}`

- [ ] **Step 7: Commit**

```bash
git add routes/devices.js
git commit -m "feat: add device CRUD endpoints with admin/technician RBAC"
```

---

### Task 4: Implement QR Token Generation

**Note:** QR tokens are generated automatically as `crypto.randomUUID()` during device creation (Task 3, Step 2). This task verifies tokens exist and are unique.

**Files:**
- Verify: `routes/devices.js` (POST handler)

- [ ] **Step 1: Verify QR tokens in database**

Run:
```bash
sqlite3 smartlab.db "SELECT id, name, qr_token FROM devices LIMIT 3;"
```
Expected: 3 rows, each with a unique UUID in `qr_token` column

- [ ] **Step 2: Verify uniqueness constraint**

Run:
```bash
sqlite3 smartlab.db "SELECT COUNT(DISTINCT qr_token) AS unique_tokens, COUNT(*) AS total FROM devices;"
```
Expected: `unique_tokens` equals `total` (20)

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "feat: generate unique QR tokens via crypto.randomUUID() on device creation"
```

---

### Task 5: Implement QR Code Generation Endpoint

**Files:**
- Modify: `routes/devices.js`

- [ ] **Step 1: Add GET /:id/qr — Download QR code as PNG**

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

- [ ] **Step 2: Add module.exports at end of file**

Ensure the last line of `routes/devices.js` is:

```javascript
module.exports = router;
```

- [ ] **Step 3: Test QR generation**

Run:
```bash
curl -X GET http://localhost:3000/api/devices/1/qr \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -o /tmp/test-qr.png
```

Verify:
```bash
file /tmp/test-qr.png
```
Expected: `/tmp/test-qr.png: PNG image data, 300 x 300, 8-bit/color RGBA, non-interlaced`

- [ ] **Step 4: Commit**

```bash
git add routes/devices.js
git commit -m "feat: add QR code PNG generation endpoint for devices"
```

---

### Task 6: Implement Public QR Device Access

**Files:**
- Create: `routes/qr.js`

- [ ] **Step 1: Write routes/qr.js**

```javascript
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

- [ ] **Step 2: Verify /qr/:token redirect**

Get a token from the database:
```bash
sqlite3 smartlab.db "SELECT qr_token FROM devices WHERE id = 1;"
```

Run:
```bash
curl -I http://localhost:3000/qr/<TOKEN_FROM_ABOVE>
```
Expected: `HTTP/1.1 302 Found` with `Location: /device.html?token=<TOKEN>`

- [ ] **Step 3: Verify /api/qr/:token/data returns device info without auth**

Run:
```bash
curl -X GET http://localhost:3000/api/qr/<TOKEN_FROM_ABOVE>/data
```
Expected: JSON with `device` object and `issues` array (no auth header needed)

- [ ] **Step 4: Commit**

```bash
git add routes/qr.js
git commit -m "feat: add public QR access routes (redirect + data) without authentication"
```

---

### Task 7: Implement Issue Reporting API (List, Create)

**Files:**
- Create: `routes/issues.js`

- [ ] **Step 1: Write issue list endpoint with RBAC filtering**

```javascript
const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../db/database');
const { authenticate, authorize } = require('../middleware/auth');

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

- [ ] **Step 2: Write issue create endpoint**

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

- [ ] **Step 3: Write issue get by ID endpoint**

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

- [ ] **Step 4: Verify issue list and create**

List:
```bash
curl -X GET http://localhost:3000/api/issues \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `total: 10`, array of issues with `device_name` and `reporter_name`

Create:
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"device_id":1,"issue_type":"Network issue","description":"Cannot connect to Wi-Fi"}'
```
Expected: `{"issue":{"id":11,...,"status":"open"}}`

- [ ] **Step 5: Verify device status changed to broken on issue creation**

Run:
```bash
sqlite3 smartlab.db "SELECT status FROM devices WHERE id = 1;"
```
Expected: `broken`

- [ ] **Step 6: Commit**

```bash
git add routes/issues.js
git commit -m "feat: add issue list, create, and detail endpoints with RBAC filtering"
```

---

### Task 8: Configure Multer for Image Uploads

**Note:** Multer is already configured in `routes/issues.js` (Task 7, Step 1). This task verifies uploads work and static serving is configured.

**Files:**
- Verify: `routes/issues.js` (lines 11-28)
- Verify: `app.js` (line 14)

- [ ] **Step 1: Verify uploads directory is created automatically**

Run:
```bash
ls -la uploads/
```
Expected: Directory exists (created on first issues.js load)

- [ ] **Step 2: Test image upload with issue creation**

Create a test image:
```bash
convert -size 100x100 xc:blue /tmp/test-image.png
```

Upload:
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -F "device_id=2" \
  -F "issue_type=Screen malfunction" \
  -F "description=Screen flickering intermittently" \
  -F "image=@/tmp/test-image.png"
```
Expected: `{"issue":{"id":12,...,"image_path":"/uploads/<timestamp>-test-image.png"}}`

- [ ] **Step 3: Verify image is accessible via static route**

Run:
```bash
curl -I "http://localhost:3000/uploads/<TIMESTAMP>-test-image.png"
```
Expected: `HTTP/1.1 200 OK` with `Content-Type: image/png`

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "feat: configure Multer for 5MB image uploads with static serving"
```

---

### Task 9: Implement Issue Status Workflow (open → in_progress → resolved) with Auto-Maintenance Log Creation

**Files:**
- Modify: `routes/issues.js`

- [ ] **Step 1: Add PATCH /:id/status endpoint**

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

- [ ] **Step 2: Add PATCH /:id/ai endpoint**

```javascript
// PATCH /api/issues/:id/ai — Save AI suggestion
router.patch('/:id/ai', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { ai_suggestions } = req.body;
  db.prepare('UPDATE issues SET ai_suggestions = ? WHERE id = ?').run(ai_suggestions, req.params.id);
  res.json({ message: 'Suggestion saved' });
});
```

- [ ] **Step 3: Ensure module.exports at end of file**

```javascript
module.exports = router;
```

- [ ] **Step 4: Test status workflow end-to-end**

Create a new issue:
```bash
curl -X POST http://localhost:3000/api/issues \
  -H "Authorization: Bearer <USER_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"device_id":3,"issue_type":"Keyboard not responding","description":"Keys stuck"}'
```
Note the issue ID from response (e.g., `id: 13`).

Move to in_progress:
```bash
curl -X PATCH "http://localhost:3000/api/issues/13/status" \
  -H "Authorization: Bearer <TECH_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"in_progress"}'
```
Expected: `{"message":"Issue status updated","status":"in_progress"}`

Resolve:
```bash
curl -X PATCH "http://localhost:3000/api/issues/13/status" \
  -H "Authorization: Bearer <TECH_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","resolution_notes":"Replaced keyboard module"}'
```
Expected: `{"message":"Issue status updated","status":"resolved"}`

- [ ] **Step 5: Verify auto-maintenance log was created**

Run:
```bash
sqlite3 smartlab.db "SELECT action, technician_id FROM maintenance_logs WHERE issue_id = 13;"
```
Expected: `Replaced keyboard module` with the technician's user ID

- [ ] **Step 6: Verify device status reset to working**

Run:
```bash
sqlite3 smartlab.db "SELECT status, last_maintenance FROM devices WHERE id = 3;"
```
Expected: `status: working`, `last_maintenance: today's date`

- [ ] **Step 7: Commit**

```bash
git add routes/issues.js
git commit -m "feat: add issue status workflow with auto-maintenance log on resolution"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Device list with pagination/filtering — Task 1
- ✅ Device statistics endpoint — Task 2
- ✅ Device CRUD (create, update, delete) — Task 3
- ✅ QR token generation — Task 4
- ✅ QR code generation endpoint — Task 5
- ✅ Public QR device access — Task 6
- ✅ Issue reporting API (list, create) — Task 7
- ✅ Multer image upload configuration — Task 8
- ✅ Issue status workflow (open→in_progress→resolved) with auto-maintenance log — Task 9

**2. Placeholder scan:** No TBD, TODO, or "implement later" found.

**3. Type consistency:**
- Device status values: `'working'`, `'broken'`, `'maintenance'` — consistent across schema and routes
- Issue status values: `'open'`, `'in_progress'`, `'resolved'` — consistent across schema and routes
- Alert type values: `'age'`, `'frequency'`, `'maintenance_gap'`, `'prediction'` — consistent across schema
- `qr_token` generated via `crypto.randomUUID()` — consistent in device creation and QR lookup
- `image_path` stored as `/uploads/<filename>` — consistent between Multer save and static serving

---

**Plan complete.**
