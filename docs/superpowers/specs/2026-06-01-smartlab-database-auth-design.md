# SmartLab — Database & Authentication Design

| | |
|---|---|
| **Date** | 2026-06-01 |
| **Project** | SmartLab — Smart Computer Lab Management & Maintenance System |
| **Version** | 1.0.0 |
| **Tech Stack** | Node.js, Express, better-sqlite3, JWT, bcryptjs |

---

## Overview

SmartLab uses **SQLite** (via `better-sqlite3`) as its single-file database, managed through a centralized `db/database.js` module. The schema consists of six tightly-related tables that cover user accounts, device inventory, issue tracking, maintenance history, system alerts, and password-reset tokens. Authentication is **stateless JWT** (JSON Web Token) with role-based access control (RBAC). Passwords are hashed with bcrypt, secrets are environment-driven, and all SQL queries are parameterized to prevent injection.

---

## Database Schema

### `users`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL |
| email | TEXT | UNIQUE NOT NULL |
| password_hash | TEXT | NOT NULL |
| role | TEXT | NOT NULL CHECK(role IN ('admin','technician','user')) |
| created_at | DATETIME | DEFAULT (datetime('now')) |

### `devices`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| name | TEXT | NOT NULL |
| type | TEXT | NOT NULL |
| processor | TEXT | |
| ram | TEXT | |
| os | TEXT | |
| location_x | INTEGER | DEFAULT 0 |
| location_y | INTEGER | DEFAULT 0 |
| age_years | REAL | DEFAULT 0 |
| status | TEXT | NOT NULL DEFAULT 'working' CHECK(status IN ('working','broken','maintenance')) |
| purchase_date | DATE | |
| last_maintenance | DATE | |
| qr_token | TEXT | UNIQUE |
| notes | TEXT | |
| created_at | DATETIME | DEFAULT (datetime('now')) |

### `issues`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| device_id | INTEGER | NOT NULL REFERENCES devices(id) ON DELETE CASCADE |
| reported_by_id | INTEGER | NOT NULL REFERENCES users(id) |
| issue_type | TEXT | NOT NULL |
| description | TEXT | NOT NULL |
| image_path | TEXT | |
| status | TEXT | NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')) |
| ai_suggestions | TEXT | |
| priority | TEXT | DEFAULT 'medium' CHECK(priority IN ('low','medium','high')) |
| created_at | DATETIME | DEFAULT (datetime('now')) |
| resolved_at | DATETIME | |
| resolved_by_id | INTEGER | REFERENCES users(id) |
| resolution_notes | TEXT | |

### `maintenance_logs`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| device_id | INTEGER | NOT NULL REFERENCES devices(id) ON DELETE CASCADE |
| issue_id | INTEGER | REFERENCES issues(id) |
| technician_id | INTEGER | REFERENCES users(id) |
| action | TEXT | NOT NULL |
| duration_hours | REAL | DEFAULT 0 |
| cost | REAL | DEFAULT 0 |
| created_at | DATETIME | DEFAULT (datetime('now')) |

### `alerts`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| device_id | INTEGER | REFERENCES devices(id) ON DELETE CASCADE |
| type | TEXT | NOT NULL CHECK(type IN ('age','frequency','maintenance_gap','prediction')) |
| message | TEXT | NOT NULL |
| severity | TEXT | NOT NULL DEFAULT 'medium' CHECK(severity IN ('low','medium','high')) |
| is_read | INTEGER | NOT NULL DEFAULT 0 |
| created_at | DATETIME | DEFAULT (datetime('now')) |

### `reset_tokens`

| Column | Type | Constraints |
|---|---|---|
| id | INTEGER | PRIMARY KEY AUTOINCREMENT |
| user_id | INTEGER | NOT NULL REFERENCES users(id) ON DELETE CASCADE |
| token | TEXT | UNIQUE NOT NULL |
| expires_at | DATETIME | NOT NULL |
| used | INTEGER | NOT NULL DEFAULT 0 |
| created_at | DATETIME | DEFAULT (datetime('now')) |

### Actual CREATE TABLE Statements

From `db/database.js`:

```javascript
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
```

### Database Initialization

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
```

---

## Authentication

### JWT Middleware (`middleware/auth.js`)

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

### Login Flow (`routes/auth.js`)

```javascript
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
```

---

## Password Reset Flow

### Request Reset (`POST /api/auth/forgot-password`)

```javascript
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
```

### Reset Password (`POST /api/auth/reset-password`)

```javascript
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
```

---

## Role-Based Access Control (RBAC)

Three roles govern all API access:

| Role | Capabilities |
|---|---|
| **admin** | Full CRUD on devices, users, issues, and reports. Can generate QR codes, delete records, and view all stats. |
| **technician** | Can view all devices and issues, update device status, resolve issues, and view stats. Cannot add/delete devices or manage users. |
| **user** | Can view devices, submit new issues (only their own), and view their own issues only. Cannot access admin/tech endpoints. |

RBAC is enforced via the `authorize(...roles)` middleware factory. Example usage:

```javascript
// Admin only
router.post('/', authenticate, authorize('admin'), (req, res) => { ... });

// Admin or technician
router.patch('/:id/status', authenticate, authorize('admin', 'technician'), (req, res) => { ... });
```

---

## Security Model

### Parameterized Queries

All database interactions use **parameterized statements** (named or positional parameters). There is NO string concatenation of user input into SQL:

```javascript
// ✅ Named parameters
const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(payload.id);

// ✅ Positional parameters with spread
db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, resetToken.user_id);
```

### CORS

```javascript
// app.js
const cors = require('cors');
app.use(cors());
```

CORS is enabled for all origins in development. In production, this should be restricted to the known frontend domain.

### Environment-Based Secrets

```
# .env.example
JWT_SECRET=smartlab_super_secret_key_change_in_production
JWT_EXPIRES_IN=7d
```

Secrets are loaded via `dotenv` at application startup. `JWT_SECRET` is used to sign and verify tokens. `JWT_EXPIRES_IN` defaults to `7d`.

### Password Hashing

```javascript
const bcrypt = require('bcryptjs');

// Hashing on registration/seed
const hash = bcrypt.hashSync(plainPassword, 10);

// Verification on login
const valid = bcrypt.compareSync(password, user.password_hash);
```

Passwords are hashed with **bcrypt at cost factor 10**. Plaintext passwords are never stored.

### Email Enumeration Prevention

The forgot-password endpoint returns the same message whether the email exists or not, preventing attackers from discovering registered accounts.

---

## Database Seeding Strategy

The seed script (`db/seed.js`) is designed for **demo/testing environments** and is NOT run automatically on startup. It must be executed manually via `npm run seed`.

### What the seed creates:

1. **3 users** — one per role:
   - `admin@lab.com` / `Admin@123` (admin)
   - `tech@lab.com` / `Tech@123` (technician)
   - `user@lab.com` / `User@123` (user)

2. **20 devices** — a mix of Dell, HP, and Lenovo PCs with randomized ages, statuses, and locations.

3. **10 issues** — across different devices, some resolved, some in progress, some open.

4. **4 maintenance logs** — linked to resolved issues.

5. **5 smart alerts** — age, frequency, and maintenance-gap alerts.

### Key aspects:

- **Wipes existing data first** via `DELETE FROM` in reverse dependency order.
- **Uses `bcrypt.hashSync(password, 10)`** for consistent password hashing.
- **Uses `crypto.randomUUID()`** for unique QR tokens on each device.
- **Deterministic structure, randomized data** — ages, costs, and dates are randomized for realism.

### Seed command:

```bash
npm run seed
```

> **Warning:** Running seed in production will erase all data. The seed script should be guarded behind an environment check if deployed to a live environment.
