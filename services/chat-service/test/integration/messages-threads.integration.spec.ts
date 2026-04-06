import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { ThreadsModule } from '../../src/threads/threads.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Messages & Threads Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;
  let conversationId: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, MessagesModule, ThreadsModule]));
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
    // Create a conversation for each test
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = res.body.data._id;
  });

  describe('Message lifecycle', () => {
    it('should send, retrieve, edit, and delete a message', async () => {
      // Send
      const sendRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Hello world', type: 'text' })
        .expect(201);

      const messageId = sendRes.body.data._id;
      expect(sendRes.body.data.content).toBe('Hello world');
      expect(sendRes.body.data.senderId).toBe(USER1_ID);

      // Retrieve
      const getRes = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(getRes.body.data).toHaveLength(1);

      // Edit
      const editRes = await request(app.getHttpServer())
        .put(`/api/v1/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Hello world edited' })
        .expect(200);

      expect(editRes.body.data.content).toBe('Hello world edited');
      expect(editRes.body.data.isEdited).toBe(true);
      expect(editRes.body.data.editHistory).toHaveLength(1);

      // Delete
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/messages/${messageId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Verify deleted (should not appear in results)
      const afterDelete = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(afterDelete.body.data).toHaveLength(0);
    });

    it('should reject edit by non-sender', async () => {
      const sendRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'My message' });

      await request(app.getHttpServer())
        .put(`/api/v1/chat/messages/${sendRes.body.data._id}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Hijacked' })
        .expect(403);
    });

    it('should track read receipts', async () => {
      // User1 sends message
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Read me' });

      // User2 marks as read
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/read`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      // Verify unread count for user2 is now 0
      const unread = await request(app.getHttpServer())
        .get('/api/v1/chat/unread')
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(unread.body.data.count).toBe(0);
    });
  });

  describe('Thread lifecycle', () => {
    it('should create a thread, reply, and follow/unfollow', async () => {
      // Send root message
      const rootRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Thread root message' });

      const rootMessageId = rootRes.body.data._id;

      // Reply in thread
      const replyRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/threads/${rootMessageId}/reply`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ content: 'Thread reply from user2' })
        .expect(201);

      expect(replyRes.body.data.threadId).toBe(rootMessageId);
      expect(replyRes.body.data.content).toBe('Thread reply from user2');

      // Get thread replies
      const threadRes = await request(app.getHttpServer())
        .get(`/api/v1/chat/threads/${rootMessageId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(threadRes.body.data.data).toHaveLength(1);
      expect(threadRes.body.data.rootMessage.threadInfo.replyCount).toBe(1);
      expect(threadRes.body.data.rootMessage.threadInfo.followers).toContain(USER2_ID);

      // Follow thread
      await request(app.getHttpServer())
        .post(`/api/v1/chat/threads/${rootMessageId}/follow`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Unfollow thread
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/threads/${rootMessageId}/follow`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });

  describe('Message forwarding', () => {
    it('should forward a message to another conversation', async () => {
      // Create second conversation
      const group = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/group')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Forward Target', memberIds: [USER2_ID] });

      // Send original message
      const original = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Forward me!' });

      // Forward it
      const fwdRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/messages/${original.body.data._id}/forward`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetConversationId: group.body.data._id })
        .expect(200);

      expect(fwdRes.body.data.type).toBe('forwarded');
      expect(fwdRes.body.data.forwardedFrom.messageId).toBe(original.body.data._id);
      expect(fwdRes.body.data.conversationId).toBe(group.body.data._id);
    });
  });
});
