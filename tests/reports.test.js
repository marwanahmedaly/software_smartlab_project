const request = require('supertest');
const app = require('../app');
const db = require('../db/database');
const { clearDatabase, seedUsers, createDevice, createIssue, authHeader } = require('./helpers');

describe('Report Routes', () => {
  let admin, technician, user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    admin = users.admin;
    technician = users.technician;
    user = users.user;
  });

  describe('GET /api/reports/summary', () => {
    it('should return summary stats for admin', async () => {
      const device1 = createDevice({ name: 'PC-01', status: 'working' });
      const device2 = createDevice({ name: 'PC-02', status: 'broken' });
      createDevice({ name: 'PC-03', status: 'maintenance' });

      createIssue({ device_id: device1.id, reported_by_id: user.id, status: 'open' });
      createIssue({ device_id: device2.id, reported_by_id: user.id, status: 'resolved' });

      const res = await request(app)
        .get('/api/reports/summary')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.device_stats).toBeDefined();
      expect(res.body.device_stats.total).toBe(3);
      expect(res.body.device_stats.working).toBe(1);
      expect(res.body.device_stats.broken).toBe(1);
      expect(res.body.device_stats.maintenance).toBe(1);

      expect(res.body.issue_stats).toBeDefined();
      expect(res.body.issue_stats.total).toBe(2);
      expect(res.body.issue_stats.open).toBe(1);
      expect(res.body.issue_stats.resolved).toBe(1);

      expect(res.body.top_broken).toBeDefined();
      expect(Array.isArray(res.body.top_broken)).toBe(true);
      expect(res.body.monthly_issues).toBeDefined();
      expect(Array.isArray(res.body.monthly_issues)).toBe(true);
    });

    it('should return summary stats for technician', async () => {
      createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .get('/api/reports/summary')
        .set(authHeader(technician));

      expect(res.status).toBe(200);
      expect(res.body.device_stats).toBeDefined();
      expect(res.body.device_stats.total).toBe(1);
    });

    it('should reject regular user', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/summary');
      expect(res.status).toBe(401);
    });

    it('should filter summary by date range', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      // Create an issue today
      createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/reports/summary?from=${today}&to=${today}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.issue_stats.total).toBe(1);
      expect(res.body.top_broken.length).toBeGreaterThanOrEqual(0);
    });

    it('should return empty stats when no data exists', async () => {
      const res = await request(app)
        .get('/api/reports/summary')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.device_stats.total).toBe(0);
      expect(res.body.issue_stats.total).toBe(0);
      expect(res.body.avg_fix_hours).toBeNull();
      expect(res.body.top_broken.length).toBe(0);
    });
  });

  describe('GET /api/reports/maintenance', () => {
    it('should return maintenance logs for admin', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved' });

      db.prepare(`UPDATE issues SET resolved_by_id = ?, resolved_at = datetime('now') WHERE id = ?`).run(admin.id, issue.id);

      db.prepare(`
        INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(device.id, issue.id, admin.id, 'Replaced motherboard', 2.5, 150);

      const res = await request(app)
        .get('/api/reports/maintenance')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);

      const log = res.body.logs[0];
      expect(log.device_name).toBe(device.name);
      expect(log.reporter_name).toBe(user.name);
      expect(log.technician_name).toBe(admin.name);
      expect(log.duration_hours).toBe(2.5);
      expect(log.cost).toBe(150);
    });

    it('should return maintenance logs for technician', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved' });

      db.prepare(`UPDATE issues SET resolved_by_id = ?, resolved_at = datetime('now') WHERE id = ?`).run(technician.id, issue.id);

      db.prepare(`
        INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(device.id, issue.id, technician.id, 'Fixed screen', 1, 50);

      const res = await request(app)
        .get('/api/reports/maintenance')
        .set(authHeader(technician));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].technician_name).toBe(technician.name);
    });

    it('should reject regular user', async () => {
      const res = await request(app)
        .get('/api/reports/maintenance')
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/reports/maintenance');
      expect(res.status).toBe(401);
    });

    it('should filter maintenance logs by status', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue1 = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved' });
      const issue2 = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'open' });

      db.prepare(`
        INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(device.id, issue1.id, admin.id, 'Resolved issue', 1, 50);

      const res = await request(app)
        .get('/api/reports/maintenance?status=resolved')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(1);
      expect(res.body.logs[0].status).toBe('resolved');
      expect(res.body.total).toBe(1);
    });

    it('should filter maintenance logs by date range', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });
      const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved' });

      db.prepare(`
        INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(device.id, issue.id, admin.id, 'Resolved issue', 1, 50);

      const today = new Date().toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/reports/maintenance?from=${today}&to=${today}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeGreaterThanOrEqual(0);
    });

    it('should support pagination', async () => {
      const device = createDevice({ name: 'PC-01', status: 'working' });

      for (let i = 1; i <= 15; i++) {
        const issue = createIssue({ device_id: device.id, reported_by_id: user.id, status: 'resolved', description: `Issue ${i}` });
        db.prepare(`
          INSERT INTO maintenance_logs (device_id, issue_id, technician_id, action, duration_hours, cost)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(device.id, issue.id, admin.id, `Action ${i}`, 1, 50);
      }

      const res = await request(app)
        .get('/api/reports/maintenance?page=2&limit=10')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it('should return empty logs when no issues exist', async () => {
      const res = await request(app)
        .get('/api/reports/maintenance')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBe(0);
      expect(res.body.total).toBe(0);
    });
  });
});
