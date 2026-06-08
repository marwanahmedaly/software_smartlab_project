# Testing & Deployment Design Specification

**Title:** SmartLab Testing & Deployment Operations Design  
**Date:** 2026-06-07  
**Project:** SmartLab — Computer Lab Management & Maintenance System  
**Spec:** spec-07

---

## 1. Overview

SmartLab uses a comprehensive testing and deployment pipeline. Tests run with Jest and Supertest against an in-memory SQLite database (`test.db`). The application is containerized with Docker (Node.js + Python) for consistent deployments, includes a health check endpoint for orchestration, and uses environment-based configuration for flexibility across dev/staging/production.

---

## 2. Test Architecture

### 2.1 Stack

| Tool | Purpose | Version |
|------|---------|---------|
| Jest | Test runner | ^30.4.2 |
| Supertest | HTTP assertion library | ^7.2.2 |
| better-sqlite3 | SQLite driver (test DB) | ^12.1.0 |
| bcryptjs | Password hashing (tests) | ^2.4.3 |
| jsonwebtoken | JWT generation (tests) | ^9.0.2 |

### 2.2 Test Database

Tests use an isolated SQLite file (`./test.db`) separate from the production `smartlab.db`. The test database is auto-created by `better-sqlite3` and wiped before each test via `clearDatabase()`.

### 2.3 Test Setup File

`tests/setup.js` runs before any test files are loaded:

```javascript
// tests/setup.js
process.env.DB_PATH = './test.db';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'openrouter';
process.env.OPENROUTER_API_KEY = 'test-key';
```

### 2.4 Jest Configuration

```json
{
  "jest": {
    "setupFiles": ["<rootDir>/tests/setup.js"],
    "testEnvironment": "node",
    "verbose": true,
    "forceExit": true
  }
}
```

### 2.5 Test Script

```json
{
  "scripts": {
    "test": "jest --verbose --detectOpenHandles"
  }
}
```

---

## 3. Test Utilities (helpers.js)

`tests/helpers.js` provides reusable factory functions for seeding test data:

```javascript
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

  return db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(info.lastInsertRowid);
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
```

---

## 4. Test Suites Overview

| Suite | File | Lines | Coverage |
|-------|------|-------|----------|
| Auth | `tests/auth.test.js` | 257 | Login, logout, me, forgot/reset password |
| Devices | `tests/devices.test.js` | 454 | CRUD, filtering, pagination, QR |
| Issues | `tests/issues.test.js` | 478 | Submit, status update, image upload, AI suggestions |
| Alerts | `tests/alerts.test.js` | 265 | List, read, mark all read, predictions |
| Reports | `tests/reports.test.js` | 238 | Summary stats, monthly breakdown, top broken |
| Users | `tests/users.test.js` | 366 | CRUD, role-based access, self-deletion guard |
| AI | `tests/ai.test.js` | 83 | Diagnosis endpoint, mocked AI factory |

**Total: 2,141 lines of test code across 7 suites.**

---

## 5. Auth Test Suite (auth.test.js)

```javascript
const request = require('supertest');
const app = require('../app');
const db = require('../db/database');
const { clearDatabase, createUser, seedUsers, authHeader } = require('./helpers');

// Ensure reset_tokens table exists for forgot-password / reset-password tests
db.exec(`
  CREATE TABLE IF NOT EXISTS reset_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT    NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  );
`);

describe('Auth Routes', () => {
  beforeEach(() => {
    clearDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials and return JWT', async () => {
      const user = createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'user',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'Password123' });

      expect(res.statusCode).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toEqual({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      });
    });

    it('should reject invalid password', async () => {
      createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'user',
      });

      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'Password123' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const users = seedUsers();
      const admin = users.admin;

      const res = await request(app)
        .get('/api/auth/me')
        .set(authHeader(admin));

      expect(res.statusCode).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(admin.id);
      expect(res.body.user.email).toBe(admin.email);
      expect(res.body.user.role).toBe(admin.role);
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set({ Authorization: 'Bearer invalid-token' });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should succeed with valid token', async () => {
      const users = seedUsers();

      const res = await request(app)
        .post('/api/auth/logout')
        .set(authHeader(users.user));

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('should reject without token', async () => {
      const res = await request(app).post('/api/auth/logout');

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should create reset token for existing user', async () => {
      const user = createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'user',
      });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.statusCode).toBe(200);

      const tokenRow = db
        .prepare('SELECT * FROM reset_tokens WHERE user_id = ?')
        .get(user.id);
      expect(tokenRow).toBeDefined();
      expect(tokenRow.token).toBeDefined();
      expect(tokenRow.expires_at).toBeDefined();
    });

    it('should return same message for non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      // Should return 200 to prevent email enumeration
      expect(res.statusCode).toBe(200);
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      const user = createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'OldPassword123',
        role: 'user',
      });

      // Manually insert a reset token into the DB
      const token = 'valid-reset-token-12345';
      db.prepare(
        `INSERT INTO reset_tokens (user_id, token, expires_at)
         VALUES (?, ?, datetime('now', '+1 hour'))`
      ).run(user.id, token);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, new_password: 'NewPassword123' });

      expect(res.statusCode).toBe(200);

      // Verify login with new password works
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'NewPassword123' });
      expect(loginRes.statusCode).toBe(200);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', new_password: 'NewPassword123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject same password', async () => {
      const user = createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'SamePassword123',
        role: 'user',
      });

      const token = 'same-password-token-12345';
      db.prepare(
        `INSERT INTO reset_tokens (user_id, token, expires_at)
         VALUES (?, ?, datetime('now', '+1 hour'))`
      ).run(user.id, token);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, new_password: 'SamePassword123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject short password', async () => {
      const user = createUser({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
        role: 'user',
      });

      const token = 'short-password-token-12345';
      db.prepare(
        `INSERT INTO reset_tokens (user_id, token, expires_at)
         VALUES (?, ?, datetime('now', '+1 hour'))`
      ).run(user.id, token);

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token, new_password: '123' });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
```

---

## 6. Users Test Suite (users.test.js)

```javascript
const request = require('supertest');
const app = require('../app');
const db = require('../db/database');
const bcrypt = require('bcryptjs');
const { clearDatabase, seedUsers, createUser, authHeader } = require('./helpers');

describe('User Routes', () => {
  let admin, technician, user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    admin = users.admin;
    technician = users.technician;
    user = users.user;
  });

  describe('GET /api/users', () => {
    it('should list all users for admin', async () => {
      const res = await request(app)
        .get('/api/users')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBe(3);

      const emails = res.body.users.map(u => u.email);
      expect(emails).toContain('admin@test.com');
      expect(emails).toContain('tech@test.com');
      expect(emails).toContain('user@test.com');
    });

    it('should reject non-admin user', async () => {
      const res = await request(app)
        .get('/api/users')
        .set(authHeader(user));

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('should reject technician', async () => {
      const res = await request(app)
        .get('/api/users')
        .set(authHeader(technician));

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('POST /api/users', () => {
    it('should create user as admin', async () => {
      const newUser = {
        name: 'New User',
        email: 'newuser@test.com',
        password: 'NewPass@123',
        role: 'user',
      };

      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send(newUser);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.name).toBe(newUser.name);
      expect(res.body.user.email).toBe(newUser.email);
      expect(res.body.user.role).toBe(newUser.role);
      expect(res.body.user.id).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          name: 'Duplicate User',
          email: 'user@test.com',
          password: 'Pass@123',
          role: 'user',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBeDefined();
    });

    it('should reject invalid role', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          name: 'Bad Role User',
          email: 'badrole@test.com',
          password: 'Pass@123',
          role: 'superuser',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          email: 'noname@test.com',
          password: 'Pass@123',
          role: 'user',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing email', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          name: 'No Email',
          password: 'Pass@123',
          role: 'user',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing password', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          name: 'No Password',
          email: 'nopass@test.com',
          role: 'user',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing role', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(admin))
        .send({
          name: 'No Role',
          email: 'norole@test.com',
          password: 'Pass@123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const res = await request(app)
        .post('/api/users')
        .set(authHeader(user))
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'Pass@123',
          role: 'user',
        });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/users')
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          password: 'Pass@123',
          role: 'user',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user as admin', async () => {
      const target = createUser({
        name: 'Target User',
        email: 'target@test.com',
        password: 'Target@123',
        role: 'user',
      });

      const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set(authHeader(admin))
        .send({
          name: 'Updated Name',
          email: 'updated@test.com',
          role: 'technician',
        });

      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name');
      expect(res.body.user.email).toBe('updated@test.com');
      expect(res.body.user.role).toBe('technician');
    });

    it('should update password if provided', async () => {
      const target = createUser({
        name: 'Target User',
        email: 'target@test.com',
        password: 'OldPass@123',
        role: 'user',
      });

      const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set(authHeader(admin))
        .send({
          name: 'Target User',
          email: 'target@test.com',
          role: 'user',
          password: 'NewPass@456',
        });

      expect(res.status).toBe(200);

      // Verify password was actually updated by logging in
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'target@test.com', password: 'NewPass@456' });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.token).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .put('/api/users/99999')
        .set(authHeader(admin))
        .send({
          name: 'Ghost User',
          email: 'ghost@test.com',
          role: 'user',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const target = createUser({
        name: 'Target User',
        email: 'target@test.com',
        password: 'Target@123',
        role: 'user',
      });

      const res = await request(app)
        .put(`/api/users/${target.id}`)
        .set(authHeader(user))
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const target = createUser({
        name: 'Target User',
        email: 'target@test.com',
        password: 'Target@123',
        role: 'user',
      });

      const res = await request(app)
        .put(`/api/users/${target.id}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user as admin', async () => {
      const target = createUser({
        name: 'To Delete',
        email: 'todelete@test.com',
        password: 'Delete@123',
        role: 'user',
      });

      const res = await request(app)
        .delete(`/api/users/${target.id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      // Verify user is deleted
      const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(target.id);
      expect(userRow).toBeUndefined();
    });

    it('should prevent self-deletion', async () => {
      const res = await request(app)
        .delete(`/api/users/${admin.id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();

      // Verify admin still exists
      const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(admin.id);
      expect(userRow).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const res = await request(app)
        .delete('/api/users/99999')
        .set(authHeader(admin));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const target = createUser({
        name: 'To Delete',
        email: 'todelete@test.com',
        password: 'Delete@123',
        role: 'user',
      });

      const res = await request(app)
        .delete(`/api/users/${target.id}`)
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const target = createUser({
        name: 'To Delete',
        email: 'todelete@test.com',
        password: 'Delete@123',
        role: 'user',
      });

      const res = await request(app).delete(`/api/users/${target.id}`);

      expect(res.status).toBe(401);
    });
  });
});
```

---

## 7. Docker Configuration

### 7.1 Dockerfile

```dockerfile
# ── Base Image ────────────────────────────────────────────────
FROM node:20-alpine

# Install Python 3, pip, and curl for ML scripts and healthchecks
RUN apk add --no-cache \
    python3 \
    py3-pip \
    curl \
    make \
    gcc \
    g++ \
    musl-dev \
    python3-dev

# Create app directory
WORKDIR /app

# ── Install Node dependencies ─────────────────────────────────
COPY package*.json ./
RUN npm ci --omit=dev

# ── Install Python dependencies ───────────────────────────────
COPY requirements.txt ./
RUN python3 -m venv /opt/venv && \
    /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
ENV PATH="/opt/venv/bin:$PATH"

# ── Copy application code ─────────────────────────────────────
COPY . .

# ── Create persistent directories ─────────────────────────────
RUN mkdir -p /app/uploads /app/data

# ── Create non-root user ──────────────────────────────────────
# Note: For production, uncomment and use a non-root user
# RUN addgroup -g 1000 -S nodejs && \
#     adduser -S nodejs -u 1000 -G nodejs && \
#     chown -R nodejs:nodejs /app /app/data /app/uploads
# USER nodejs

# ── Entrypoint for auto-seeding ───────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# ── Expose and run ────────────────────────────────────────────
EXPOSE 3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

### 7.2 docker-compose.yml

```yaml
version: '3.8'

services:
  smartlab:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: smartlab-app
    ports:
      - "3000:3000"
    volumes:
      # Persist SQLite database
      - ./data:/app/data
      # Persist uploaded images
      - ./uploads:/app/uploads
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DB_PATH=/app/data/smartlab.db
      - JWT_SECRET=${JWT_SECRET}
      - JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-7d}
      # AI Provider Configuration
      - AI_PROVIDER=${AI_PROVIDER:-openrouter}
      # OpenRouter (default for testing)
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - OPENROUTER_MODEL=${OPENROUTER_MODEL:-meta-llama/llama-3.2-3b-instruct:free}
      - OPENROUTER_URL=${OPENROUTER_URL:-https://openrouter.ai/api/v1/chat/completions}
      # Ollama (for local demo)
      - OLLAMA_URL=${OLLAMA_URL:-http://host.docker.internal:11434}
      - OLLAMA_MODEL=${OLLAMA_MODEL:-llama3.2}
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 7.3 docker-entrypoint.sh

```bash
#!/bin/sh
set -e

# ── Auto-seed on first startup ────────────────────────────────
if [ ! -f /app/data/.seeded ]; then
    echo "🌱 First startup detected — seeding database..."
    node db/seed.js
    touch /app/data/.seeded
    echo "✅ Database seeded"
fi

# ── Start the application ─────────────────────────────────────
exec "$@"
```

---

## 8. Health Check Endpoint

A lightweight health check is exposed at `GET /api/health` for Docker and load balancer monitoring:

```javascript
// app.js
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

The Docker Compose `healthcheck` configuration polls this endpoint every 30 seconds with a 40-second startup grace period.

---

## 9. Environment Configuration

### 9.1 .env.example

```bash
# Server
NODE_ENV=development
PORT=3000
DB_PATH=./smartlab.db
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# AI Provider: openrouter | ollama
AI_PROVIDER=openrouter

# OpenRouter (cloud AI)
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=meta-llama/llama-3.2-3b-instruct:free
OPENROUTER_URL=https://openrouter.ai/api/v1/chat/completions

# Ollama (local AI)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

### 9.2 Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | No | `development` | Runtime environment |
| `PORT` | No | `3000` | HTTP server port |
| `DB_PATH` | No | `./smartlab.db` | SQLite database file path |
| `JWT_SECRET` | Yes | — | Signing secret for JWT tokens |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiry duration |
| `AI_PROVIDER` | No | `openrouter` | AI backend selector |
| `OPENROUTER_API_KEY` | If AI=openrouter | — | OpenRouter API key |
| `OPENROUTER_MODEL` | No | `meta-llama/llama-3.2-3b-instruct:free` | Model ID |
| `OPENROUTER_URL` | No | OpenRouter default | API endpoint |
| `OLLAMA_URL` | No | `http://localhost:11434` | Ollama base URL |
| `OLLAMA_MODEL` | No | `llama3.2` | Ollama model name |

---

## 10. Summary

| Concern | Implementation |
|---------|---------------|
| Test Runner | Jest + Supertest |
| Test DB | In-memory SQLite (`test.db`) |
| Factories | `tests/helpers.js` (user, device, issue) |
| Coverage | 7 suites, 2,141 lines |
| Container | Node 20 Alpine + Python 3 venv |
| Auto-seed | `docker-entrypoint.sh` on first boot |
| Health Check | `GET /api/health` + Docker Compose |
| Config | `.env` file with fallback defaults |
| AI Switching | `AI_PROVIDER` toggles OpenRouter ↔ Ollama |
