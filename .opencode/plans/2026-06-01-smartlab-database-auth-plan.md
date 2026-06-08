# SmartLab Database & Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up SQLite database schema, JWT authentication, role-based authorization, password reset flow, and health check for the SmartLab backend.

**Architecture:** Single-file SQLite database managed via `better-sqlite3`, stateless JWT authentication with bcrypt password hashing, role-based middleware guards, and parameterized queries throughout.

**Tech Stack:** Node.js, Express, better-sqlite3, jsonwebtoken, bcryptjs, dotenv

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Project manifest with dependencies and scripts |
| `.env` | Environment variables (JWT secret, expiry) |
| `db/database.js` | Database connection, schema creation, WAL/foreign keys |
| `db/seed.js` | Demo data seeder (3 users, 20 devices, 10 issues, 5 alerts) |
| `middleware/auth.js` | JWT verification + role-based `authorize()` factory |
| `routes/auth.js` | Login, logout, me, forgot-password, reset-password endpoints |
| `app.js` | Express app setup, route mounting, health check, error handler |

---

### Task 1: Initialize Node.js Project with Dependencies

**Files:**
- Create: `package.json`
- Create: `.env`
- Create: `.gitignore`

- [ ] **Step 1: Write package.json**

```json
{
  "name": "smartlab",
  "version": "1.0.0",
  "description": "Smart Computer Lab Management & Maintenance System",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "seed": "node db/seed.js",
    "test": "jest --verbose --detectOpenHandles"
  },
  "jest": {
    "setupFiles": ["<rootDir>/tests/setup.js"],
    "testEnvironment": "node",
    "verbose": true,
    "forceExit": true
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "better-sqlite3": "^12.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "node-fetch": "^2.7.0",
    "qrcode": "^1.5.3"
  },
  "devDependencies": {
    "jest": "^30.4.2",
    "supertest": "^7.2.2"
  }
}
```

- [ ] **Step 2: Write .env**

```
PORT=3000
JWT_SECRET=smartlab_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions
```

- [ ] **Step 3: Write .gitignore**

```
node_modules/
*.db
*.db-shm
*.db-wal
.env
uploads/
coverage/
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `added N packages` — node_modules populated

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env .gitignore
git commit -m "chore: initialize project with dependencies and env config"
```

---

### Task 2: Create Database Schema

**Files:**
- Create: `db/database.js`

- [ ] **Step 1: Write db/database.js with all 6 tables**

```javascript
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'smartlab.db');
const db = new Database(DB_PATH);

// Enable Foreign Keys
// WAL mode for better concurrency
// Foreign keys enforcement for referential integrity

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT    UNIQUE NOT NULL,
      password_hash TEXT   NOT NULL,
      role         TEXT    NOT NULL CHECK(role IN ('admin','technician','user')),
      created_at   DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS devices (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      name             TEXT    NOT NULL,
      type             TEXT    NOT NULL,
      processor        TEXT,
      ram              TEXT,
      os               TEXT,
      location_x       INTEGER DEFAULT 0,
      location_y       INTEGER DEFAULT 0,
      age_years        REAL    DEFAULT 0,
      status           TEXT    NOT NULL DEFAULT 'working' CHECK(status IN ('working','broken','maintenance')),
      purchase_date    DATE,
      last_maintenance DATE,
      qr_token         TEXT    UNIQUE,
      notes            TEXT,
      created_at       DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id        INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      reported_by_id   INTEGER NOT NULL REFERENCES users(id),
      issue_type       TEXT    NOT NULL,
      description      TEXT    NOT NULL,
      image_path       TEXT,
      status           TEXT    NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
      ai_suggestions   TEXT,
      priority         TEXT    DEFAULT 'medium' CHECK(priority IN ('low','medium','high')),
      created_at       DATETIME DEFAULT (datetime('now')),
      resolved_at      DATETIME,
      resolved_by_id   INTEGER REFERENCES users(id),
      resolution_notes TEXT
    );

    CREATE TABLE IF NOT EXISTS maintenance_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id      INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      issue_id       INTEGER REFERENCES issues(id),
      technician_id  INTEGER REFERENCES users(id),
      action         TEXT    NOT NULL,
      duration_hours REAL    DEFAULT 0,
      cost           REAL    DEFAULT 0,
      created_at     DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Add reset_tokens table for password reset functionality
  db.exec(`
    CREATE TABLE IF NOT EXISTS reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT    UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Migrate alerts table if old CHECK constraint exists
  const alertsInfo = db.prepare("PRAGMA table_info(alerts)").all();
  if (alertsInfo.length > 0) {
    const typeCol = alertsInfo.find(c => c.name === 'type');
    if (typeCol && !typeCol.dflt_value && typeCol.type === 'TEXT') {
      // Check current constraint by trying to insert prediction
      try {
        db.prepare("INSERT INTO alerts (device_id, type, message, severity) VALUES (NULL, 'prediction', 'test', 'low')").run();
        db.prepare("DELETE FROM alerts WHERE type = 'prediction' AND message = 'test'").run();
      } catch {
        // Old constraint — need to recreate
        db.exec(`
          CREATE TABLE alerts_new (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
            type       TEXT    NOT NULL CHECK(type IN ('age','frequency','maintenance_gap','prediction')),
            message    TEXT    NOT NULL,
            severity   TEXT    NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')),
            is_read    INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT (datetime('now'))
          );
          INSERT INTO alerts_new SELECT * FROM alerts;
          DROP TABLE alerts;
          ALTER TABLE alerts_new RENAME TO alerts;
        `);
        console.log('✅ Alerts table upgraded');
      }
    }
  } else {
    db.exec(`
      CREATE TABLE IF NOT EXISTS alerts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
        type       TEXT    NOT NULL CHECK(type IN ('age','frequency','maintenance_gap','prediction')),
        message    TEXT    NOT NULL,
        severity   TEXT    NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')),
        is_read    INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT (datetime('now'))
      );
    `);
  }

  console.log('✅ Database ready');
}

initDatabase();

module.exports = db;
```

- [ ] **Step 2: Verify database initializes**

Run: `node -e "require('./db/database')"`
Expected: `✅ Database ready`

- [ ] **Step 3: Commit**

```bash
git add db/database.js
git commit -m "feat: create SQLite database schema with 6 tables and alerts migration"
```

---

### Task 3: Create Database Seeder with Demo Data

**Files:**
- Create: `db/seed.js`

- [ ] **Step 1: Write db/seed.js**

```javascript
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db     = require('./database');

function seed() {
  // ── 1. Clear old data ─────────────────────────────
  db.exec(`
    DELETE FROM maintenance_logs;
    DELETE FROM alerts;
    DELETE FROM issues;
    DELETE FROM devices;
    DELETE FROM users;
  `);

  // ── 2. Users ───────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (@name, @email, @password_hash, @role)
  `);

  const users = [
    { name: 'John Smith',   email: 'admin@lab.com', password: 'Admin@123',  role: 'admin' },
    { name: 'Ahmed Hassan', email: 'tech@lab.com',  password: 'Tech@123',   role: 'technician' },
    { name: 'Sarah Wilson', email: 'user@lab.com',  password: 'User@123',   role: 'user' },
  ];

  const userIds = {};
  for (const u of users) {
    const info = insertUser.run({
      name: u.name,
      email: u.email,
      password_hash: bcrypt.hashSync(u.password, 10),
      role: u.role,
    });
    userIds[u.role] = info.lastInsertRowid;
  }

  // ── 3. Devices (20 devices) ────────────────────────────────
  const insertDevice = db.prepare(`
    INSERT INTO devices
      (name, type, processor, ram, os, location_x, location_y, age_years, status, purchase_date, last_maintenance, qr_token, notes)
    VALUES
      (@name, @type, @processor, @ram, @os, @location_x, @location_y, @age_years, @status, @purchase_date, @last_maintenance, @qr_token, @notes)
  `);

  const statuses = ['working','working','working','working','working','working',
                    'broken','broken','broken','maintenance'];

  const devices = Array.from({ length: 20 }, (_, i) => {
    const num     = String(i + 1).padStart(2, '0');
    const row     = Math.floor(i / 4);
    const col     = i % 4;
    const age     = parseFloat((Math.random() * 7 + 1).toFixed(1));
    const status  = i < 12 ? 'working' : i < 17 ? 'broken' : 'maintenance';
    return {
      name:             `PC-${num}`,
      type:             i % 3 === 0 ? 'Dell OptiPlex' : i % 3 === 1 ? 'HP ProDesk' : 'Lenovo ThinkCentre',
      processor:        i % 2 === 0 ? 'Intel Core i5-10400' : 'Intel Core i7-8700',
      ram:              i % 2 === 0 ? '8 GB DDR4' : '16 GB DDR4',
      os:               'Windows 11 Pro',
      location_x:       col,
      location_y:       row,
      age_years:        age,
      status,
      purchase_date:    `202${Math.floor(Math.random() * 4)}-01-15`,
      last_maintenance: status === 'working' ? '2025-10-01' : null,
      qr_token:         crypto.randomUUID(),
      notes:            status === 'broken' ? 'Needs inspection' : null,
    };
  });

  const deviceIds = devices.map(d => insertDevice.run(d).lastInsertRowid);

  // ── 4. Issues (10 issues) ─────────────────────────────
  const insertIssue = db.prepare(`
    INSERT INTO issues
      (device_id, reported_by_id, issue_type, description, status, priority, created_at, resolved_at, resolved_by_id, resolution_notes)
    VALUES
      (@device_id, @reported_by_id, @issue_type, @description, @status, @priority, @created_at, @resolved_at, @resolved_by_id, @resolution_notes)
  `);

  const issueTypes = ['Screen malfunction', 'Keyboard not responding', 'Device not working', 'Severe slowdown', 'Network issue'];
  const issueDescs = [
    'Screen displays vertical lines and abnormal colors',
    'Some keyboard keys do not respond when pressed',
    'Device does not respond when powered on, emits repeated beeping sound',
    'Device takes more than 10 minutes to boot and launch programs',
    'Device cannot connect to the local network despite cable being connected',
  ];

  const issueIds = [];
  for (let i = 0; i < 10; i++) {
    const isResolved = i < 4;
    const info = insertIssue.run({
      device_id:        deviceIds[i % deviceIds.length],
      reported_by_id:   i % 2 === 0 ? userIds['user'] : userIds['admin'],
      issue_type:       issueTypes[i % 5],
      description:      issueDescs[i % 5],
      status:           isResolved ? 'resolved' : i < 7 ? 'in_progress' : 'open',
      priority:         i % 3 === 0 ? 'high' : i % 3 === 1 ? 'medium' : 'low',
      created_at:       `2026-0${Math.min(i + 1, 9)}-${String(Math.min(i * 3 + 1, 28)).padStart(2,'0')}`,
      resolved_at:      isResolved ? `2026-0${Math.min(i + 1, 9)}-${String(Math.min(i * 3 + 3, 28)).padStart(2,'0')}` : null,
      resolved_by_id:   isResolved ? userIds['technician'] : null,
      resolution_notes: isResolved ? 'Fixed by replacing the faulty component' : null,
    });
    issueIds.push(info.lastInsertRowid);
  }

  // ── 5. Maintenance logs ──────────────────────────────────────
  const insertLog = db.prepare(`
    INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost, created_at)
    VALUES (@device_id, @issue_id, @technician_id, @action, @duration_hours, @cost, @created_at)
  `);

  for (let i = 0; i < 4; i++) {
    insertLog.run({
      device_id:      deviceIds[12 + i],
      issue_id:       issueIds[i],
      technician_id:  userIds['technician'],
      action:         'Component replacement + device testing',
      duration_hours: parseFloat((Math.random() * 3 + 0.5).toFixed(1)),
      cost:           Math.floor(Math.random() * 200 + 50),
      created_at:     `2026-0${Math.min(i + 1, 9)}-${String(Math.min(i * 3 + 3, 28)).padStart(2,'0')}`,
    });
  }

  // ── 6. Smart alerts ──────────────────────────────────
  const insertAlert = db.prepare(`
    INSERT INTO alerts (device_id, type, message, severity, is_read)
    VALUES (@device_id, @type, @message, @severity, @is_read)
  `);

  const alertsData = [
    { device_id: deviceIds[0], type: 'age',             message: 'Device PC-01 is over 5 years old, periodic review recommended',          severity: 'medium', is_read: 0 },
    { device_id: deviceIds[1], type: 'age',             message: 'Device PC-02 has exceeded its expected lifespan, replacement recommended',                 severity: 'high',   is_read: 0 },
    { device_id: deviceIds[4], type: 'maintenance_gap', message: 'More than 6 months since last maintenance for device PC-05',                        severity: 'low',    is_read: 0 },
    { device_id: deviceIds[6], type: 'frequency',       message: 'Device PC-07 has malfunctioned more than 3 times this month, needs comprehensive inspection',      severity: 'high',   is_read: 1 },
    { device_id: deviceIds[9], type: 'maintenance_gap', message: 'Device PC-10 has not undergone any maintenance for over 8 months',                   severity: 'medium', is_read: 1 },
  ];

  for (const a of alertsData) insertAlert.run(a);

  console.log('✅ Demo data seeded successfully');
  console.log('─────────────────────────────────────');
  console.log('📧 admin@lab.com    / Admin@123  (Admin)');
  console.log('📧 tech@lab.com     / Tech@123   (Technician)');
  console.log('📧 user@lab.com     / User@123   (User)');
  console.log('─────────────────────────────────────');
}

seed();
```

- [ ] **Step 2: Run seeder and verify output**

Run: `npm run seed`
Expected:
```
✅ Database ready
✅ Demo data seeded successfully
─────────────────────────────────────
📧 admin@lab.com    / Admin@123  (Admin)
📧 tech@lab.com     / Tech@123   (Technician)
📧 user@lab.com     / User@123   (User)
─────────────────────────────────────
```

- [ ] **Step 3: Commit**

```bash
git add db/seed.js
git commit -m "feat: add database seeder with 3 users, 20 devices, 10 issues, 5 alerts"
```

---

### Task 4: Implement JWT Authentication Middleware

**Files:**
- Create: `middleware/auth.js`

- [ ] **Step 1: Write middleware/auth.js**

```javascript
require('dotenv').config();
const jwt = require('jsonwebtoken');
const db  = require('../db/database');

/**
 * Verify JWT and attach user data to request
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized — login required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired, please log in again' });
  }
}

/**
 * Role guard factory — example: authorize('admin') or authorize('admin','technician')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission for this operation' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
```

- [ ] **Step 2: Verify middleware loads without errors**

Run: `node -e "const { authenticate, authorize } = require('./middleware/auth'); console.log('authenticate:', typeof authenticate); console.log('authorize:', typeof authorize);"`
Expected:
```
authenticate: function
authorize: function
```

- [ ] **Step 3: Commit**

```bash
git add middleware/auth.js
git commit -m "feat: add JWT authentication and role-based authorization middleware"
```

---

### Task 5: Implement Auth Routes (Login, Logout, Me)

**Files:**
- Create: `routes/auth.js`

- [ ] **Step 1: Write routes/auth.js**

```javascript
require('dotenv').config();
const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const db       = require('../db/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout  (client deletes the token)
router.post('/logout', authenticate, (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());

  // Always return same message to prevent email enumeration
  if (!user) {
    return res.json({ message: 'If the email is registered, a reset link has been sent' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare(`
    INSERT INTO reset_tokens (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(user.id, token, expiresAt);

  // In production, send email here. For demo/testing, log to console.
  console.log(`🔐 Password reset token for ${email}: ${token}`);

  res.json({ message: 'If the email is registered, a reset link has been sent' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { token, new_password } = req.body;
  if (!token || !new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Token and new password (at least 6 characters) are required' });
  }

  const resetToken = db.prepare(`
    SELECT rt.*, u.email
    FROM reset_tokens rt
    JOIN users u ON rt.user_id = u.id
    WHERE rt.token = ? AND rt.used = 0 AND rt.expires_at > datetime('now')
  `).get(token);

  if (!resetToken) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  // Check if new password is same as old
  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(resetToken.user_id);
  if (bcrypt.compareSync(new_password, user.password_hash)) {
    return res.status(400).json({ error: 'New password must be different from the old one' });
  }

  // Update password
  const newHash = bcrypt.hashSync(new_password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, resetToken.user_id);

  // Mark token as used
  db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(resetToken.id);

  res.json({ message: 'Password reset successfully' });
});

module.exports = router;
```

- [ ] **Step 2: Verify auth routes load without errors**

Run: `node -e "const auth = require('./routes/auth'); console.log('auth router loaded:', typeof auth);"`
Expected: `auth router loaded: function`

- [ ] **Step 3: Commit**

```bash
git add routes/auth.js
git commit -m "feat: add auth routes for login, logout, me, forgot-password, and reset-password"
```

---

### Task 6: Implement Password Reset Flow

**Note:** The password reset flow (forgot-password and reset-password endpoints) is already included in `routes/auth.js` from Task 5. This task ensures the flow is verified end-to-end.

**Files:**
- Test: `routes/auth.js` (already created in Task 5)

- [ ] **Step 1: Test forgot-password endpoint**

Run (server must be running, or test via curl after starting):
```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email": "user@lab.com"}'
```
Expected: `{"message":"If the email is registered, a reset link has been sent"}`

- [ ] **Step 2: Verify reset token was created in database**

Run:
```bash
sqlite3 smartlab.db "SELECT token, used, expires_at FROM reset_tokens WHERE user_id = 3;"
```
Expected: One row with a hex token, `used = 0`, and future `expires_at`.

- [ ] **Step 3: Test reset-password with the token**

Run:
```bash
curl -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "<TOKEN_FROM_STEP_2>", "new_password": "NewPass@123"}'
```
Expected: `{"message":"Password reset successfully"}`

- [ ] **Step 4: Verify token is marked used**

Run:
```bash
sqlite3 smartlab.db "SELECT used FROM reset_tokens WHERE token = '<TOKEN_FROM_STEP_2>';"
```
Expected: `1`

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "test: verify password reset flow end-to-end"
```

---

### Task 7: Implement Role-Based Authorization

**Note:** The `authorize()` middleware factory is already defined in `middleware/auth.js` from Task 4. This task wires it into `app.js` and verifies RBAC enforcement.

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Write app.js with route mounting and health check**

```javascript
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static Files (Frontend) ────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/devices',     require('./routes/devices'));
app.use('/api/issues',      require('./routes/issues'));
app.use('/api/alerts',      require('./routes/alerts'));
app.use('/api/reports',     require('./routes/reports'));
app.use('/api/ai',          require('./routes/ai'));
app.use('/api/users',       require('./routes/users'));
app.use('/qr',              require('./routes/qr'));

// ── Health Check ────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ── Catch-all: Redirect to frontend (SPA-like) ──────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/qr')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global Error Handler ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
```

- [ ] **Step 2: Verify RBAC enforcement — admin-only route rejected for user**

Run (after logging in as user@lab.com):
```bash
curl -X GET http://localhost:3000/api/devices/stats \
  -H "Authorization: Bearer <USER_JWT_TOKEN>"
```
Expected: `{"error":"You do not have permission for this operation"}` with status 403

- [ ] **Step 3: Verify admin can access admin-only route**

Run (after logging in as admin@lab.com):
```bash
curl -X GET http://localhost:3000/api/devices/stats \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected: `{"total":20,"working":12,"broken":5,"maintenance":3}`

- [ ] **Step 4: Commit**

```bash
git add app.js
git commit -m "feat: set up Express app with route mounting, RBAC wiring, and global error handler"
```

---

### Task 8: Create Health Check Endpoint

**Note:** The `/api/health` endpoint is already included in `app.js` from Task 7. This task verifies it works.

**Files:**
- Verify: `app.js:27-29`

- [ ] **Step 1: Test health check endpoint**

Run:
```bash
curl -X GET http://localhost:3000/api/health
```
Expected: `{"status":"ok"}` with status 200

- [ ] **Step 2: Commit**

```bash
git commit --allow-empty -m "feat: add /api/health health check endpoint"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ Database schema (6 tables) — Task 2
- ✅ Database seeder (3 users, 20 devices, 10 issues, 5 alerts) — Task 3
- ✅ JWT authentication middleware — Task 4
- ✅ Auth routes (login, logout, me) — Task 5
- ✅ Password reset flow (forgot-password, reset-password) — Task 5 + Task 6
- ✅ Role-based authorization — Task 4 + Task 7
- ✅ Health check endpoint — Task 7 + Task 8

**2. Placeholder scan:** No TBD, TODO, or "implement later" found.

**3. Type consistency:** All table names, column names, and CHECK constraint values match across schema, seed, and route files.

---

**Plan complete.**
