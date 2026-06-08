const request = require('supertest');
const app = require('../app');
const { clearDatabase, seedUsers, createDevice, authHeader } = require('./helpers');

describe('Device Routes', () => {
  let admin, technician, user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    admin = users.admin;
    technician = users.technician;
    user = users.user;
  });

  describe('GET /api/devices', () => {
    it('should list all devices for authenticated user', async () => {
      createDevice({ name: 'PC-01', status: 'working' });
      createDevice({ name: 'PC-02', status: 'broken' });

      const res = await request(app)
        .get('/api/devices')
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.devices)).toBe(true);
      expect(res.body.devices.length).toBe(2);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(10);
    });

    it('should filter devices by status', async () => {
      createDevice({ name: 'PC-01', status: 'working' });
      createDevice({ name: 'PC-02', status: 'broken' });
      createDevice({ name: 'PC-03', status: 'maintenance' });

      const res = await request(app)
        .get('/api/devices?status=broken')
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.devices.length).toBe(1);
      expect(res.body.devices[0].status).toBe('broken');
      expect(res.body.total).toBe(1);
    });

    it('should search devices by name', async () => {
      createDevice({ name: 'PC-Workstation-01', status: 'working' });
      createDevice({ name: 'Laptop-01', status: 'working' });
      createDevice({ name: 'PC-Workstation-02', status: 'broken' });

      const res = await request(app)
        .get('/api/devices?search=Workstation')
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.devices.length).toBe(2);
      expect(res.body.total).toBe(2);
      res.body.devices.forEach(device => {
        expect(device.name).toContain('Workstation');
      });
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 15; i++) {
        createDevice({ name: `PC-${i}`, status: 'working' });
      }

      const res = await request(app)
        .get('/api/devices?page=2&limit=10')
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.devices.length).toBe(5);
      expect(res.body.total).toBe(15);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(10);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/devices');
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/devices/stats', () => {
    it('should return stats for admin', async () => {
      createDevice({ name: 'PC-01', status: 'working' });
      createDevice({ name: 'PC-02', status: 'working' });
      createDevice({ name: 'PC-03', status: 'broken' });
      createDevice({ name: 'PC-04', status: 'maintenance' });

      const res = await request(app)
        .get('/api/devices/stats')
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(4);
      expect(res.body.working).toBe(2);
      expect(res.body.broken).toBe(1);
      expect(res.body.maintenance).toBe(1);
    });

    it('should return stats for technician', async () => {
      createDevice({ name: 'PC-01', status: 'working' });

      const res = await request(app)
        .get('/api/devices/stats')
        .set(authHeader(technician));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });

    it('should reject regular user', async () => {
      const res = await request(app)
        .get('/api/devices/stats')
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/devices/stats');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id', () => {
    it('should return device with recent issues', async () => {
      const device = createDevice({ name: 'PC-Test', status: 'working' });

      const res = await request(app)
        .get(`/api/devices/${device.id}`)
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.body.device).toBeDefined();
      expect(res.body.device.id).toBe(device.id);
      expect(res.body.device.name).toBe(device.name);
      expect(Array.isArray(res.body.recent_issues)).toBe(true);
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .get('/api/devices/99999')
        .set(authHeader(user));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app).get(`/api/devices/${device.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/devices', () => {
    it('should create device as admin', async () => {
      const deviceData = {
        name: 'New-PC-01',
        type: 'desktop',
        processor: 'Intel i7',
        ram: '16GB',
        os: 'Windows 11',
        location_x: 5,
        location_y: 3,
        age_years: 1,
        status: 'working',
      };

      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(admin))
        .send(deviceData);

      expect(res.status).toBe(201);
      expect(res.body.device).toBeDefined();
      expect(res.body.device.name).toBe(deviceData.name);
      expect(res.body.device.type).toBe(deviceData.type);
      expect(res.body.device.processor).toBe(deviceData.processor);
      expect(res.body.device.qr_token).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(user))
        .send({ name: 'New-PC', type: 'desktop' });

      expect(res.status).toBe(403);
    });

    it('should reject technician', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(technician))
        .send({ name: 'New-PC', type: 'desktop' });

      expect(res.status).toBe(403);
    });

    it('should reject missing name', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(admin))
        .send({ type: 'desktop' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing type', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(admin))
        .send({ name: 'New-PC' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should use defaults for optional fields', async () => {
      const res = await request(app)
        .post('/api/devices')
        .set(authHeader(admin))
        .send({ name: 'Minimal-PC', type: 'desktop' });

      expect(res.status).toBe(201);
      expect(res.body.device.location_x).toBe(0);
      expect(res.body.device.location_y).toBe(0);
      expect(res.body.device.age_years).toBe(0);
      expect(res.body.device.status).toBe('working');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post('/api/devices')
        .send({ name: 'New-PC', type: 'desktop' });

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/devices/:id', () => {
    it('should update device as admin', async () => {
      const device = createDevice({ name: 'Old-Name', type: 'desktop', status: 'working' });

      const res = await request(app)
        .put(`/api/devices/${device.id}`)
        .set(authHeader(admin))
        .send({ name: 'New-Name', status: 'maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.device.name).toBe('New-Name');
      expect(res.body.device.status).toBe('maintenance');
      expect(res.body.device.type).toBe('desktop'); // unchanged
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .put('/api/devices/99999')
        .set(authHeader(admin))
        .send({ name: 'New-Name' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .put(`/api/devices/${device.id}`)
        .set(authHeader(user))
        .send({ name: 'New-Name' });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .put(`/api/devices/${device.id}`)
        .send({ name: 'New-Name' });

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /api/devices/:id/status', () => {
    it('should update status as admin', async () => {
      const device = createDevice({ name: 'PC-Test', status: 'working' });

      const res = await request(app)
        .patch(`/api/devices/${device.id}/status`)
        .set(authHeader(admin))
        .send({ status: 'maintenance' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
      expect(res.body.status).toBe('maintenance');
    });

    it('should update status as technician', async () => {
      const device = createDevice({ name: 'PC-Test', status: 'working' });

      const res = await request(app)
        .patch(`/api/devices/${device.id}/status`)
        .set(authHeader(technician))
        .send({ status: 'broken' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('broken');
    });

    it('should reject invalid status value', async () => {
      const device = createDevice({ name: 'PC-Test', status: 'working' });

      const res = await request(app)
        .patch(`/api/devices/${device.id}/status`)
        .set(authHeader(admin))
        .send({ status: 'invalid_status' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .patch('/api/devices/99999/status')
        .set(authHeader(admin))
        .send({ status: 'broken' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject regular user', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .patch(`/api/devices/${device.id}/status`)
        .set(authHeader(user))
        .send({ status: 'maintenance' });

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .patch(`/api/devices/${device.id}/status`)
        .send({ status: 'maintenance' });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/devices/:id', () => {
    it('should delete device as admin', async () => {
      const device = createDevice({ name: 'PC-To-Delete' });

      const res = await request(app)
        .delete(`/api/devices/${device.id}`)
        .set(authHeader(admin));

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();

      // Verify device is deleted
      const getRes = await request(app)
        .get(`/api/devices/${device.id}`)
        .set(authHeader(admin));
      expect(getRes.status).toBe(404);
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .delete('/api/devices/99999')
        .set(authHeader(admin));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject non-admin user', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .delete(`/api/devices/${device.id}`)
        .set(authHeader(user));

      expect(res.status).toBe(403);
    });

    it('should reject technician', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app)
        .delete(`/api/devices/${device.id}`)
        .set(authHeader(technician));

      expect(res.status).toBe(403);
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app).delete(`/api/devices/${device.id}`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/devices/:id/qr', () => {
    it('should generate QR code as PNG for authenticated user', async () => {
      const device = createDevice({ name: 'PC-QR-Test' });

      const res = await request(app)
        .get(`/api/devices/${device.id}/qr`)
        .set(authHeader(user));

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/png');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('QR-PC-QR-Test.png');
      expect(res.body).toBeInstanceOf(Buffer);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent device', async () => {
      const res = await request(app)
        .get('/api/devices/99999/qr')
        .set(authHeader(user));

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const device = createDevice({ name: 'PC-Test' });

      const res = await request(app).get(`/api/devices/${device.id}/qr`);
      expect(res.status).toBe(401);
    });
  });
});
