const request = require('supertest');
const app = require('../app');
const { clearDatabase, seedUsers, createDevice, authHeader } = require('./helpers');
const db = require('../db/database');

describe('Alert Routes', () => {
  let admin, technician, user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    admin = users.admin;
    technician = users.technician;
    user = users.user;
  });

  function createAlert(data = {}) {
    const defaults = {
      device_id: null,
      type: 'age',
      message: 'Test alert message',
      severity: 'medium',
      is_read: 0,
    };

    const alert = { ...defaults, ...data };

    const info = db.prepare(`
      INSERT INTO alerts (device_id, type, message, severity, is_read)
      VALUES (@device_id, @type, @message, @severity, @is_read)
    `).run(alert);

    return db.prepare('SELECT * FROM alerts WHERE id = ?').get(info.lastInsertRowid);
  }

  describe('GET /api/alerts', () => {
    it('should list all alerts for admin', async () => {
      const device = createDevice({ name: 'PC-01' });
      createAlert({ device_id: device.id, message: 'Alert 1', severity: 'high' });
      createAlert({ device_id: device.id, message: 'Alert 2', severity: 'low' });

      const res = await request(app)
        .get('/api/alerts')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body.alerts.length).toBe(2);
      expect(res.body.unread).toBe(2);
      expect(res.body.alerts[0].device_name).toBe(device.name);
    });

    it('should list all alerts for technician', async () => {
      createAlert({ message: 'Alert 1', severity: 'medium' });

      const res = await request(app)
        .get('/api/alerts')
        .set(authHeader(technician));

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(1);
      expect(res.body.unread).toBe(1);
    });

    it('should reject regular user with 403', async () => {
      const res = await request(app)
        .get('/api/alerts')
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/alerts');
      expect(res.status).toBe(401);
    });

    it('should filter alerts by severity', async () => {
      const device = createDevice({ name: 'PC-01' });
      createAlert({ device_id: device.id, message: 'High alert', severity: 'high' });
      createAlert({ device_id: device.id, message: 'Medium alert', severity: 'medium' });
      createAlert({ device_id: device.id, message: 'Low alert', severity: 'low' });

      const res = await request(app)
        .get('/api/alerts?severity=high')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(1);
      expect(res.body.alerts[0].severity).toBe('high');
      expect(res.body.unread).toBe(3); // unread counts all, not just filtered
    });

    it('should filter alerts by is_read', async () => {
      createAlert({ message: 'Unread alert', is_read: 0 });
      createAlert({ message: 'Read alert', is_read: 1 });

      const res = await request(app)
        .get('/api/alerts?is_read=0')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(1);
      expect(res.body.alerts[0].message).toBe('Unread alert');
    });

    it('should filter alerts by type', async () => {
      createAlert({ message: 'Age alert', type: 'age' });
      createAlert({ message: 'Frequency alert', type: 'frequency' });

      const res = await request(app)
        .get('/api/alerts?type=frequency')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(1);
      expect(res.body.alerts[0].type).toBe('frequency');
    });

    it('should include device_name from LEFT JOIN', async () => {
      const device = createDevice({ name: 'Test-Device' });
      createAlert({ device_id: device.id, message: 'Device alert' });
      createAlert({ message: 'No device alert' });

      const res = await request(app)
        .get('/api/alerts')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.alerts.length).toBe(2);
      const withDevice = res.body.alerts.find(a => a.device_id === device.id);
      const withoutDevice = res.body.alerts.find(a => a.device_id === null);
      expect(withDevice.device_name).toBe('Test-Device');
      expect(withoutDevice.device_name).toBeNull();
    });
  });

  describe('PATCH /api/alerts/:id/read', () => {
    it('should mark alert as read for admin', async () => {
      const alert = createAlert({ message: 'Unread alert', is_read: 0 });

      const res = await request(app)
        .patch(`/api/alerts/${alert.id}/read`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      const updated = db.prepare('SELECT is_read FROM alerts WHERE id = ?').get(alert.id);
      expect(updated.is_read).toBe(1);
    });

    it('should mark alert as read for technician', async () => {
      const alert = createAlert({ message: 'Unread alert', is_read: 0 });

      const res = await request(app)
        .patch(`/api/alerts/${alert.id}/read`)
        .set(authHeader(technician));

      expect(res.status).toBe(200);

      const updated = db.prepare('SELECT is_read FROM alerts WHERE id = ?').get(alert.id);
      expect(updated.is_read).toBe(1);
    });

    it('should return 404 for non-existent alert', async () => {
      const res = await request(app)
        .patch('/api/alerts/99999/read')
        .set(authHeader(admin));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject regular user with 403', async () => {
      const alert = createAlert({ message: 'Unread alert' });

      const res = await request(app)
        .patch(`/api/alerts/${alert.id}/read`)
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const alert = createAlert({ message: 'Unread alert' });

      const res = await request(app).patch(`/api/alerts/${alert.id}/read`);
      expect(res.status).toBe(401);
    });

    it('should not fail when marking an already-read alert as read', async () => {
      const alert = createAlert({ message: 'Already read', is_read: 1 });

      const res = await request(app)
        .patch(`/api/alerts/${alert.id}/read`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);

      const updated = db.prepare('SELECT is_read FROM alerts WHERE id = ?').get(alert.id);
      expect(updated.is_read).toBe(1);
    });
  });

  describe('PATCH /api/alerts/read-all', () => {
    it('should mark all alerts as read for admin', async () => {
      createAlert({ message: 'Alert 1', is_read: 0 });
      createAlert({ message: 'Alert 2', is_read: 0 });
      createAlert({ message: 'Alert 3', is_read: 1 });

      const res = await request(app)
        .patch('/api/alerts/read-all')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      const unreadCount = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
      expect(unreadCount).toBe(0);

      const allRead = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 1").get().c;
      expect(allRead).toBe(3);
    });

    it('should mark all alerts as read for technician', async () => {
      createAlert({ message: 'Alert 1', is_read: 0 });

      const res = await request(app)
        .patch('/api/alerts/read-all')
        .set(authHeader(technician));

      expect(res.status).toBe(200);

      const unreadCount = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
      expect(unreadCount).toBe(0);
    });

    it('should reject regular user with 403', async () => {
      const res = await request(app)
        .patch('/api/alerts/read-all')
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).patch('/api/alerts/read-all');
      expect(res.status).toBe(401);
    });

    it('should work even when there are no unread alerts', async () => {
      createAlert({ message: 'Already read', is_read: 1 });

      const res = await request(app)
        .patch('/api/alerts/read-all')
        .set(authHeader(admin));

      expect(res.status).toBe(200);

      const unreadCount = db.prepare("SELECT COUNT(*) as c FROM alerts WHERE is_read = 0").get().c;
      expect(unreadCount).toBe(0);
    });
  });
});
