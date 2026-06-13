const request = require('supertest');
const app = require('../app');
const db = require('../db/database');
const { clearDatabase, seedUsers, createDevice, createIssue, authHeader } = require('./helpers');

describe('Issue Routes', () => {
  let admin, technician, user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    admin = users.admin;
    technician = users.technician;
    user = users.user;
  });

  describe('GET /api/issues', () => {
    it('should list all issues for admin', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });
      createIssue({ device_id: device.id, reported_by_id: admin.id, status: 'in_progress' });

      const res = await request(app)
        .get('/api/issues')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.issues)).toBe(true);
      expect(res.body.issues.length).toBe(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('should list all issues for technician', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });
      createIssue({ device_id: device.id, reported_by_id: admin.id, status: 'resolved' });

      const res = await request(app)
        .get('/api/issues')
        .set(authHeader(technician));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(2);
      expect(res.body.total).toBe(2);
    });

    it('should show only own issues for regular user', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open', description: 'User issue' });
      createIssue({ device_id: device.id, reported_by_id: admin.id, status: 'open', description: 'Admin issue' });

      const res = await request(app)
        .get('/api/issues')
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(1);
      expect(res.body.issues[0].description).toBe('User issue');
      expect(res.body.total).toBe(1);
    });

    it('should filter issues by status', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'in_progress' });
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved' });

      const res = await request(app)
        .get('/api/issues?status=open')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(1);
      expect(res.body.issues[0].status).toBe('open');
      expect(res.body.total).toBe(1);
    });

    it('should filter issues by priority', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      createIssue({ device_id: device.id, reported_by_id: user.id, priority: 'low' });
      createIssue({ device_id: device.id, reported_by_id: user.id, priority: 'high' });

      const res = await request(app)
        .get('/api/issues?priority=high')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(1);
      expect(res.body.issues[0].priority).toBe('high');
      expect(res.body.total).toBe(1);
    });

    it('should filter issues by device_id', async () => {
      const device1 = createDevice({ name: 'PC-01', status: 'working' });
      const device2 = createDevice({ name: 'PC-02', status: 'working' });
      createIssue({ device_id: device1.id, reported_by_id: user.id });
      createIssue({ device_id: device2.id, reported_by_id: user.id });

      const res = await request(app)
        .get(`/api/issues?device_id=${device1.id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(1);
      expect(res.body.issues[0].device_id).toBe(device1.id);
      expect(res.body.total).toBe(1);
    });

    it('should support pagination', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      for (let i = 1; i <= 15; i++) {
        createIssue({ device_id: device.id, reported_by_id: user.id, description: `Issue ${i}` });
      }

      const res = await request(app)
        .get('/api/issues?page=2&limit=10')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issues.length).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/issues');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/issues/:id', () => {
    it('should return issue details with related names', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .get(`/api/issues/${issue.id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issue).toBeDefined();
      expect(res.body.issue.id).toBe(issue.id);
      expect(res.body.issue.device_name).toBe(device.name);
      expect(res.body.issue.device_type).toBe(device.type);
      expect(res.body.issue.reporter_name).toBe(user.name);
    });

    it('should return 404 for non-existent issue', async () => {
      const res = await request(app)
        .get('/api/issues/99999')
        .set(authHeader(admin));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id });

      const res = await request(app).get(`/api/issues/${issue.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/issues', () => {
    it('should create issue and set device status to broken', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          device_id: device.id,
          issue_type: 'hardware',
          description: 'Screen is flickering',
          priority: 'high',
        });

      expect(res.status).toBe(201);
      expect(res.body.issue).toBeDefined();
      expect(res.body.issue.device_id).toBe(device.id);
      expect(res.body.issue.issue_type).toBe('hardware');
      expect(res.body.issue.description).toBe('Screen is flickering');
      expect(res.body.issue.priority).toBe('high');
      expect(res.body.issue.status).toBe('open');
      expect(res.body.issue.reported_by_id).toBe(user.id);

      // Verify device status changed to broken
      const updatedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
      expect(updatedDevice.status).toBe('broken');
    });

    it('should use default priority when not provided', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          device_id: device.id,
          issue_type: 'software',
          description: 'Application crashes',
        });

      expect(res.status).toBe(201);
      expect(res.body.issue.priority).toBe('medium');
    });

    it('should reject missing device_id', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          issue_type: 'hardware',
          description: 'Screen is broken',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing issue_type', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          device_id: device.id,
          description: 'Screen is broken',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing description', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          device_id: device.id,
          issue_type: 'hardware',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-existent device', async () => {
      const res = await request(app)
        .post('/api/issues')
        .set(authHeader(user))
        .send({
          device_id: 99999,
          issue_type: 'hardware',
          description: 'Screen is broken',
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .post('/api/issues')
        .send({
          device_id: device.id,
          issue_type: 'hardware',
          description: 'Screen is broken',
        });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/issues/:id/status', () => {
    it('should update status to resolved and set device to working as admin', async () => {
      const device = createDevice({ name: 'PC-01', status: 'broken' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'in_progress' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(admin))
        .send({
          status: 'resolved',
          resolution_notes: 'Replaced the faulty component',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.status).toBe('resolved');

      // Verify device status changed to working
      const updatedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
      expect(updatedDevice.status).toBe('working');
      expect(updatedDevice.last_maintenance).toBeDefined();

      // Verify maintenance log was created
      const log = db.prepare('SELECT * FROM maintenance_logs WHERE issue_id = ?').get(issue.id);
      expect(log).toBeDefined();
      expect(log.device_id).toBe(device.id);
      expect(log.technician_id).toBe(admin.id);
      expect(log.action).toBe('Replaced the faulty component');
    });

    it('should update status to resolved as technician', async () => {
      const device = createDevice({ name: 'PC-01', status: 'broken' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'in_progress' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(technician))
        .send({
          status: 'resolved',
          resolution_notes: 'Fixed the issue',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('resolved');

      const updatedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
      expect(updatedDevice.status).toBe('working');

      const log = db.prepare('SELECT * FROM maintenance_logs WHERE issue_id = ?').get(issue.id);
      expect(log).toBeDefined();
      expect(log.technician_id).toBe(technician.id);
    });

    it('should update status without resolution notes using default action', async () => {
      const device = createDevice({ name: 'PC-01', status: 'broken' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(admin))
        .send({ status: 'resolved' });

      expect(res.status).toBe(200);

      const log = db.prepare('SELECT * FROM maintenance_logs WHERE issue_id = ?').get(issue.id);
      expect(log).toBeDefined();
      expect(log.action).toBe('Issue resolved');
    });

    it('should update to in_progress without changing device status', async () => {
      const device = createDevice({ name: 'PC-01', status: 'broken' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(admin))
        .send({ status: 'in_progress' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('in_progress');

      // Device should be in maintenance mode
      const updatedDevice = db.prepare('SELECT * FROM devices WHERE id = ?').get(device.id);
      expect(updatedDevice.status).toBe('maintenance');

      // No maintenance log should be created
      const log = db.prepare('SELECT * FROM maintenance_logs WHERE issue_id = ?').get(issue.id);
      expect(log).toBeUndefined();
    });

    it('should reject invalid status value', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(admin))
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 for non-existent issue', async () => {
      const res = await request(app)
        .patch('/api/issues/99999/status')
        .set(authHeader(admin))
        .send({ status: 'resolved' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject regular user', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .set(authHeader(user))
        .send({ status: 'resolved' });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/status`)
        .send({ status: 'resolved' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/issues/:id/ai', () => {
    it('should save AI suggestions as admin', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/ai`)
        .set(authHeader(admin))
        .send({ ai_suggestions: 'Check power supply and replace if needed' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      const updatedIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id);
      expect(updatedIssue.ai_suggestions).toBe('Check power supply and replace if needed');
    });

    it('should save AI suggestions as technician', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/ai`)
        .set(authHeader(technician))
        .send({ ai_suggestions: 'Run diagnostic tool' });

      expect(res.status).toBe(200);

      const updatedIssue = db.prepare('SELECT * FROM issues WHERE id = ?').get(issue.id);
      expect(updatedIssue.ai_suggestions).toBe('Run diagnostic tool');
    });

    it('should reject regular user', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/ai`)
        .set(authHeader(user))
        .send({ ai_suggestions: 'Some suggestion' });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const res = await request(app)
        .patch(`/api/issues/${issue.id}/ai`)
        .send({ ai_suggestions: 'Some suggestion' });

      expect(res.status).toBe(401);
    });
  });
});
