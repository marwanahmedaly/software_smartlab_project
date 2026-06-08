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
