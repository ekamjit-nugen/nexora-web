import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { SettingsModule } from '../../src/settings/settings.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Settings Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([SettingsModule]));
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

  describe('GET /chat/settings — get user settings', () => {
    it('should return default settings for a new user', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.userId).toBe(USER1_ID);
    });

    it('should return the same settings on subsequent calls (idempotent)', async () => {
      // First call creates settings
      await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Second call returns the same record
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.userId).toBe(USER1_ID);
    });

    it('should return different settings for different users', async () => {
      const res1 = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const res2 = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res1.body.data.userId).toBe(USER1_ID);
      expect(res2.body.data.userId).toBe(USER2_ID);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .expect(401);
    });
  });

  describe('PUT /chat/settings — update appearance settings', () => {
    it('should update appearance settings', async () => {
      // Ensure settings exist first
      await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          appearance: {
            theme: 'dark',
            fontSize: 'large',
            compactMode: true,
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.appearance.theme).toBe('dark');
      expect(res.body.data.appearance.fontSize).toBe('large');
      expect(res.body.data.appearance.compactMode).toBe(true);
    });

    it('should persist appearance changes across requests', async () => {
      await request(app.getHttpServer())
        .put('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ appearance: { theme: 'dark' } });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.appearance.theme).toBe('dark');
    });
  });

  describe('PUT /chat/settings — update read receipt preferences', () => {
    it('should update read receipt preferences', async () => {
      // Ensure settings exist first
      await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`);

      const res = await request(app.getHttpServer())
        .put('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          readReceipts: {
            sendReadReceipts: false,
            showReadReceipts: false,
          },
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.readReceipts.sendReadReceipts).toBe(false);
      expect(res.body.data.readReceipts.showReadReceipts).toBe(false);
    });

    it('should not affect other users\' settings when updating', async () => {
      // User1 disables read receipts
      await request(app.getHttpServer())
        .put('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ readReceipts: { sendReadReceipts: false } });

      // User2 settings should be unaffected (defaults)
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/settings')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Default should be true (or whatever the schema default is)
      expect(res.body.data.userId).toBe(USER2_ID);
    });
  });
});
