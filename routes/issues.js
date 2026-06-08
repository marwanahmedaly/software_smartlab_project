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

// PATCH /api/issues/:id/ai — Save AI suggestion
router.patch('/:id/ai', authenticate, authorize('admin', 'technician'), (req, res) => {
  const { ai_suggestions } = req.body;
  db.prepare('UPDATE issues SET ai_suggestions = ? WHERE id = ?').run(ai_suggestions, req.params.id);
  res.json({ message: 'Suggestion saved' });
});

module.exports = router;
