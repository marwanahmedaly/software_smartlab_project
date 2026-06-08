const db = require('../db/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function clearDatabase() {
  const tables = ['maintenance_logs', 'alerts', 'issues', 'reset_tokens', 'devices', 'users'];
  for (const table of tables) {
    try {
      db.prepare(`DELETE FROM ${table}`).run();
    } catch (err) {
      if (!err.message.includes('no such table')) throw err;
    }
  }
}

function createUser({ name, email, password, role }) {
  const info = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (@name, @email, @password_hash, @role)
  `).run({
    name,
    email: email.trim().toLowerCase(),
    password_hash: bcrypt.hashSync(password, 10),
    role,
  });

  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function createDevice(data = {}) {
  const defaults = {
    name: 'PC-Test',
    type: 'desktop',
    processor: 'Intel i5',
    ram: '8GB',
    os: 'Windows 10',
    location_x: 1,
    location_y: 1,
    age_years: 2,
    status: 'working',
    qr_token: crypto.randomUUID(),
  };

  const device = { ...defaults, ...data };

  const info = db.prepare(`
    INSERT INTO devices
      (name, type, processor, ram, os, location_x, location_y, age_years, status, qr_token)
    VALUES
      (@name, @type, @processor, @ram, @os, @location_x, @location_y, @age_years, @status, @qr_token)
  `).run(device);

  return db.prepare('SELECT * FROM devices WHERE id = ?').get(info.lastInsertRowid);
}

function createIssue(data) {
  if (!data.device_id || !data.reported_by_id) {
    throw new Error('device_id and reported_by_id are required');
  }

  const defaults = {
    issue_type: 'hardware',
    description: 'Test issue description',
    priority: 'medium',
    status: 'open',
  };

  const issue = { ...defaults, ...data };

  const info = db.prepare(`
    INSERT INTO issues
      (device_id, reported_by_id, issue_type, description, priority, status)
    VALUES
      (@device_id, @reported_by_id, @issue_type, @description, @priority, @status)
  `).run(issue);

  return db.prepare('SELECT * FROM issues WHERE id = ?').get(info.lastInsertRowid);
}

function getToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authHeader(user) {
  return { Authorization: `Bearer ${getToken(user)}` };
}

function seedUsers() {
  const users = {
    admin: createUser({
      name: 'Test Admin',
      email: 'admin@test.com',
      password: 'Admin@123',
      role: 'admin',
    }),
    technician: createUser({
      name: 'Test Technician',
      email: 'tech@test.com',
      password: 'Tech@123',
      role: 'technician',
    }),
    user: createUser({
      name: 'Test User',
      email: 'user@test.com',
      password: 'User@123',
      role: 'user',
    }),
  };

  return users;
}

module.exports = {
  clearDatabase,
  createUser,
  createDevice,
  createIssue,
  getToken,
  authHeader,
  seedUsers,
};
