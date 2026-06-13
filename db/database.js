const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'smartlab.db');
const db = new Database(DB_PATH);

// Enable Foreign Keys
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
      assigned_to_id   INTEGER REFERENCES users(id),
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

  // ── Audit / Activity Log ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id),
      action     TEXT    NOT NULL,
      entity_type TEXT   NOT NULL,
      entity_id  INTEGER,
      details    TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // ── Inventory / Spare Parts ───────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS inventory_parts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      category   TEXT    NOT NULL,
      quantity   INTEGER NOT NULL DEFAULT 0,
      min_stock  INTEGER NOT NULL DEFAULT 5,
      unit_cost  REAL    DEFAULT 0,
      supplier   TEXT,
      location   TEXT,
      notes      TEXT,
      created_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // ── Maintenance Schedules ─────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS maintenance_schedules (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      device_id    INTEGER REFERENCES devices(id) ON DELETE CASCADE,
      title        TEXT    NOT NULL,
      description  TEXT,
      scheduled_at DATETIME NOT NULL,
      status       TEXT    NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
      technician_id INTEGER REFERENCES users(id),
      created_by   INTEGER REFERENCES users(id),
      created_at   DATETIME DEFAULT (datetime('now'))
    );
  `);

  // ── Settings ──────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT (datetime('now'))
    );
  `);

  // Insert default settings
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
    ('ml_threshold', '30'),
    ('alert_email_digest', '0'),
    ('dark_mode_default', '0')
  `).run();

  // ── Add device warranty columns if missing ───────────────
  const deviceCols = db.prepare("PRAGMA table_info(devices)").all().map(c => c.name);
  if (!deviceCols.includes('warranty_expiry')) {
    db.prepare("ALTER TABLE devices ADD COLUMN warranty_expiry DATE").run();
  }
  if (!deviceCols.includes('vendor_support')) {
    db.prepare("ALTER TABLE devices ADD COLUMN vendor_support TEXT").run();
  }
  if (!deviceCols.includes('asset_tag')) {
    db.prepare("ALTER TABLE devices ADD COLUMN asset_tag TEXT").run();
  }
  if (!deviceCols.includes('serial_number')) {
    db.prepare("ALTER TABLE devices ADD COLUMN serial_number TEXT").run();
  }

  // ── Add assigned_to_id to issues if missing ───────────────
  const issueCols = db.prepare("PRAGMA table_info(issues)").all().map(c => c.name);
  if (!issueCols.includes('assigned_to_id')) {
    db.prepare("ALTER TABLE issues ADD COLUMN assigned_to_id INTEGER REFERENCES users(id)").run();
  }

    // Migrate alerts table if old CHECK constraint exists
  const alertsInfo = db.prepare("PRAGMA table_info(alerts)").all();
  if (alertsInfo.length > 0) {
    const typeCol = alertsInfo.find(c => c.name === 'type');
    if (typeCol && !typeCol.dflt_value && typeCol.type === 'TEXT') {
      // Check current constraint by trying to insert assignment
      try {
        db.prepare("INSERT INTO alerts (device_id, type, message, severity) VALUES (NULL, 'assignment', 'test', 'low')").run();
        db.prepare("DELETE FROM alerts WHERE type = 'assignment' AND message = 'test'").run();
      } catch {
        // Old constraint — need to recreate
        db.exec(`
          CREATE TABLE alerts_new (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id  INTEGER REFERENCES devices(id) ON DELETE CASCADE,
            type       TEXT    NOT NULL CHECK(type IN ('age','frequency','maintenance_gap','prediction','assignment')),
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
        type       TEXT    NOT NULL CHECK(type IN ('age','frequency','maintenance_gap','prediction','assignment')),
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
