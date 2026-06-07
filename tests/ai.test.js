jest.mock('../services/ai_factory', () => ({
  getAIService: () => ({
    diagnose: jest.fn().mockResolvedValue('1) Faulty HDMI cable\n2) Check connection cable\n3) Replace the cable')
  })
}));

const request = require('supertest');
const app = require('../app');
const { clearDatabase, seedUsers, createDevice, authHeader } = require('./helpers');

describe('AI Diagnosis Routes', () => {
  let user;

  beforeEach(() => {
    clearDatabase();
    const users = seedUsers();
    user = users.user;
  });

  describe('POST /api/ai/diagnose', () => {
    it('should return AI suggestion with device context', async () => {
      const device = createDevice({ name: 'PC-Test', type: 'desktop' });

      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: 'Screen not working',
          device_id: device.id,
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestion).toBeDefined();
      expect(res.body.suggestion).toContain('HDMI cable');
    });

    it('should work without device_id', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: 'Screen not working',
        });

      expect(res.status).toBe(200);
      expect(res.body.suggestion).toBeDefined();
      expect(res.body.suggestion).toContain('HDMI cable');
    });

    it('should reject short description (< 5 chars)', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({
          description: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject missing description', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .set(authHeader(user))
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/ai/diagnose')
        .send({
          description: 'Screen not working',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });
});
