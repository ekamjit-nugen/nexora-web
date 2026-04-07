import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { PresenceModule } from '../../src/presence/presence.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Presence Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([PresenceModule]));
    jwtService = module.get(JwtService);
    userToken = generateTestToken(jwtService, { sub: USER1_ID, email: 'user1@test.com' });
    user2Token = generateTestToken(jwtService, { sub: USER2_ID, email: 'user2@test.com' });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  beforeEach(async () => {
    await clearAllCollections(module);
  });

  describe('PUT /chat/presence/status — set status', () => {
    it('should set user status to online', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'online' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('online');
    });

    it('should set user status to away', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'away' })
        .expect(200);

      expect(res.body.data.status).toBe('away');
    });

    it('should set a custom status with emoji and text', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          status: 'online',
          customEmoji: ':coffee:',
          customText: 'In a meeting until 3pm',
        })
        .expect(200);

      expect(res.body.data.status).toBe('online');
      expect(res.body.data.customEmoji).toBe(':coffee:');
      expect(res.body.data.customText).toBe('In a meeting until 3pm');
    });

    it('should update status on subsequent calls', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'online' });

      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'offline' })
        .expect(200);

      expect(res.body.data.status).toBe('offline');
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .send({ status: 'online' })
        .expect(401);
    });
  });

  describe('GET /chat/presence/batch — batch lookup', () => {
    beforeEach(async () => {
      // Set presence for both users
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ status: 'online' });

      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/status')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ status: 'away' });
    });

    it('should return presence for multiple users', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/presence/batch')
        .query({ userIds: [USER1_ID, USER2_ID] })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return presence for a single user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/presence/batch')
        .query({ userIds: USER1_ID })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should return empty or default results for users with no presence set', async () => {
      const UNKNOWN_ID = '660000000000000000000099';
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/presence/batch')
        .query({ userIds: UNKNOWN_ID })
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  describe('PUT /chat/presence/dnd — set DND schedule', () => {
    it('should set a DND schedule', async () => {
      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          enabled: true,
          startTime: '22:00',
          endTime: '08:00',
          timezone: 'America/New_York',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('DND schedule updated');
    });

    it('should disable DND schedule', async () => {
      // First enable
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ enabled: true, startTime: '22:00', endTime: '08:00' });

      // Then disable
      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('should persist DND schedule and be retrievable via GET /chat/presence/dnd', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          enabled: true,
          startTime: '23:00',
          endTime: '07:00',
        });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.enabled).toBe(true);
      expect(res.body.data.startTime).toBe('23:00');
      expect(res.body.data.endTime).toBe('07:00');
    });

    it('should not affect another user\'s DND schedule', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ enabled: true, startTime: '22:00', endTime: '08:00' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/presence/dnd')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // User2 has no DND schedule set
      expect(res.body.data.enabled).toBe(false);
    });
  });
});
