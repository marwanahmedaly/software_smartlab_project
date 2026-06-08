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
