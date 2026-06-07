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
