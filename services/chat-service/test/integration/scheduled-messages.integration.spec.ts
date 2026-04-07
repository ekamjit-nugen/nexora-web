import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { ScheduledMessagesModule } from '../../src/scheduled/scheduled-messages.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Scheduled Messages Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;
  let conversationId: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';
  const USER3_ID = '660000000000000000000003';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, ScheduledMessagesModule]));
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
    // Create a direct conversation between user1 and user2
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = res.body.data._id;
  });

  describe('POST /chat/scheduled — schedule a message', () => {
    it('should schedule a message for a future time', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          conversationId,
          content: 'Hello from the future!',
          scheduledAt: futureDate,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.content).toContain('Hello from the future!');
      expect(res.body.data.isScheduled).toBe(true);
      expect(res.body.data.senderId).toBe(USER1_ID);
      expect(res.body.data.conversationId).toBe(conversationId);
    });

    it('should reject scheduling in a conversation the user does not belong to', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          conversationId,
          content: 'Should be rejected',
          scheduledAt: futureDate,
        })
        .expect(403);
    });

    it('should reject scheduling without required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId })
        .expect(400);
    });
  });

  describe('GET /chat/scheduled — list pending scheduled messages', () => {
    it('should return only pending future scheduled messages for the user', async () => {
      const futureDate1 = new Date(Date.now() + 3600000).toISOString();
      const futureDate2 = new Date(Date.now() + 7200000).toISOString();

      // Schedule two messages
      await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'Scheduled 1', scheduledAt: futureDate1 });

      await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'Scheduled 2', scheduledAt: futureDate2 });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      // Should be sorted by scheduledAt ascending
      expect(res.body.data[0].content).toContain('Scheduled 1');
      expect(res.body.data[1].content).toContain('Scheduled 2');
    });

    it('should not return scheduled messages from another user', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'User1 scheduled', scheduledAt: futureDate });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('DELETE /chat/scheduled/:id — cancel scheduled message', () => {
    it('should cancel a scheduled message', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'Will be cancelled', scheduledAt: futureDate });

      const messageId = createRes.body.data._id;

      await request(app.getHttpServer())
        .delete(`/api/v1/chat/scheduled/${messageId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify it no longer appears in the list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(listRes.body.data).toHaveLength(0);
    });

    it('should reject cancelling another user\'s scheduled message', async () => {
      const futureDate = new Date(Date.now() + 3600000).toISOString();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'Protected message', scheduledAt: futureDate });

      await request(app.getHttpServer())
        .delete(`/api/v1/chat/scheduled/${createRes.body.data._id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });
  });

  describe('Scheduled message with past date', () => {
    it('should still create a scheduled message with a past date (published by processor)', async () => {
      const pastDate = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago

      // The service does not validate that scheduledAt is in the future —
      // it simply stores it. The processor picks it up on the next run.
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/scheduled')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId, content: 'Past date message', scheduledAt: pastDate })
        .expect(201);

      expect(res.body.data.isScheduled).toBe(true);
    });
  });
});
