import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { RemindersModule } from '../../src/reminders/reminders.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Reminders Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;
  let conversationId: string;
  let messageId: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';
  const USER3_ID = '660000000000000000000003';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, MessagesModule, RemindersModule]));
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
    // Create a conversation and a message to attach reminders to
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = convRes.body.data._id;

    const msgRes = await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Remember this message', type: 'text' });
    messageId = msgRes.body.data._id;
  });

  describe('POST /chat/reminders — create reminder', () => {
    it('should create a reminder for a message', async () => {
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          messageId,
          conversationId,
          reminderAt,
          note: 'Follow up on this',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.messageId).toBe(messageId);
      expect(res.body.data.conversationId).toBe(conversationId);
      expect(res.body.data.userId).toBe(USER1_ID);
      expect(res.body.data.note).toBe('Follow up on this');
      expect(res.body.data.status).toBe('pending');
    });

    it('should create a reminder without a note', async () => {
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.messageId).toBe(messageId);
    });

    it('should reject creating a reminder without required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId })
        .expect(400);
    });
  });

  describe('GET /chat/reminders — list pending reminders', () => {
    it('should list only pending future reminders for the user', async () => {
      const reminderAt1 = new Date(Date.now() + 3600000).toISOString();
      const reminderAt2 = new Date(Date.now() + 7200000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt: reminderAt1, note: 'Reminder 1' });

      await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt: reminderAt2, note: 'Reminder 2' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      // Should be sorted by reminderAt ascending
      expect(res.body.data[0].note).toBe('Reminder 1');
      expect(res.body.data[1].note).toBe('Reminder 2');
    });

    it('should not return reminders belonging to another user', async () => {
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('DELETE /chat/reminders/:id — cancel reminder', () => {
    it('should cancel an existing reminder', async () => {
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt });

      const reminderId = createRes.body.data._id;

      await request(app.getHttpServer())
        .delete(`/api/v1/chat/reminders/${reminderId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Cancelled reminder should no longer appear in pending list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(listRes.body.data).toHaveLength(0);
    });

    it('should reject cancelling another user\'s reminder', async () => {
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId, conversationId, reminderAt });

      await request(app.getHttpServer())
        .delete(`/api/v1/chat/reminders/${createRes.body.data._id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(404);
    });
  });

  describe('Reminder for message in conversation user does not belong to', () => {
    it('should still create the reminder (service does not validate membership)', async () => {
      // The RemindersService stores the reminder without checking conversation membership.
      // Membership validation, if needed, is enforced at the notification delivery layer.
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });
      const reminderAt = new Date(Date.now() + 3600000).toISOString();

      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/reminders')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ messageId, conversationId, reminderAt })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.userId).toBe(USER3_ID);
    });
  });
});
