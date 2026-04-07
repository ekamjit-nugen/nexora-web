import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import axios from 'axios';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { AiSummaryModule } from '../../src/ai-summary/ai-summary.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('AI Summary Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;
  let conversationId: string;
  let axiosPostSpy: jest.SpyInstance;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';
  const USER3_ID = '660000000000000000000003';

  function mockLLMResponse(content: string) {
    axiosPostSpy.mockResolvedValueOnce({
      data: { choices: [{ message: { content } }] },
    });
  }

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, MessagesModule, AiSummaryModule]));
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
    axiosPostSpy = jest.spyOn(axios, 'post');

    // Create a conversation and seed some messages
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = convRes.body.data._id;

    // Seed messages for summarization
    await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Let us discuss the Q3 roadmap', type: 'text' });

    await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ content: 'Sure, I think we should prioritize the mobile app', type: 'text' });

    await request(app.getHttpServer())
      .post(`/api/v1/chat/conversations/${conversationId}/messages`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'Agreed. I will create the Jira tickets by Friday.', type: 'text' });
  });

  afterEach(() => {
    axiosPostSpy.mockRestore();
  });

  describe('GET /chat/ai/conversations/:id/summary — conversation summary', () => {
    it('should return a conversation summary from the mocked LLM', async () => {
      mockLLMResponse('The team discussed the Q3 roadmap and agreed to prioritize the mobile app. Action: create Jira tickets by Friday.');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/conversations/${conversationId}/summary`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.summary).toContain('Q3 roadmap');
      expect(axiosPostSpy).toHaveBeenCalledTimes(1);
    });

    it('should return a graceful fallback when LLM call fails', async () => {
      axiosPostSpy.mockRejectedValueOnce(new Error('LLM unavailable'));

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/conversations/${conversationId}/summary`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.summary).toBe('string');
      // Should contain the fallback message
      expect(res.body.data.summary).toContain('unavailable');
    });

    it('should reject access for non-participants', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });

      await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/conversations/${conversationId}/summary`)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(403);
    });
  });

  describe('GET /chat/ai/threads/:messageId/summary — thread summary', () => {
    let rootMessageId: string;

    beforeEach(async () => {
      // Create a root message for thread testing
      const rootRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Thread root: design review', type: 'text' });
      rootMessageId = rootRes.body.data._id;
    });

    it('should return a thread summary', async () => {
      mockLLMResponse('The thread discussed design review feedback.');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/threads/${rootMessageId}/summary`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(typeof res.body.data.summary).toBe('string');
    });

    it('should return 404 for non-existent message', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/ai/threads/660000000000000000009999/summary')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);
    });
  });

  describe('GET /chat/ai/conversations/:id/action-items — extract action items', () => {
    it('should return action items from the mocked LLM', async () => {
      mockLLMResponse('["Create Jira tickets by Friday", "Prioritize mobile app development"]');

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/conversations/${conversationId}/action-items`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.actionItems)).toBe(true);
      expect(res.body.data.actionItems).toHaveLength(2);
      expect(res.body.data.actionItems[0]).toContain('Jira');
    });

    it('should return empty array when no messages exist', async () => {
      // Create a new empty conversation
      await clearAllCollections(module);
      const convRes = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID });
      const emptyConvId = convRes.body.data._id;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/conversations/${emptyConvId}/action-items`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.actionItems).toEqual([]);
    });
  });

  describe('GET /chat/ai/smart-replies/:conversationId — smart reply suggestions', () => {
    it('should return smart reply suggestions', async () => {
      mockLLMResponse('["Sounds good!", "I\'ll get started on that", "Let me check my calendar"]');

      // The last message is from USER1, so USER2 should request smart replies
      // (smart replies are skipped if the last message is from the requesting user)
      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/smart-replies/${conversationId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.replies)).toBe(true);
      expect(res.body.data.replies.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array when last message is from the requesting user', async () => {
      // USER1 sent the last message, so smart replies for USER1 should be empty
      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/smart-replies/${conversationId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.replies).toEqual([]);
    });

    it('should reject access for non-participants', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });

      await request(app.getHttpServer())
        .get(`/api/v1/chat/ai/smart-replies/${conversationId}`)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(403);
    });
  });
});
