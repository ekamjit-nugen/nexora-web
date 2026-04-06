import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Conversations Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let user2Token: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';
  const USER3_ID = '660000000000000000000003';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule]));
    jwtService = module.get(JwtService);
    userToken = generateTestToken(jwtService, { sub: USER1_ID, email: 'user1@test.com' });
    user2Token = generateTestToken(jwtService, { sub: USER2_ID, email: 'user2@test.com' });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  afterEach(async () => {
    await clearAllCollections(module);
  });

  describe('POST /chat/conversations/direct', () => {
    it('should create a direct conversation between two users', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('direct');
      expect(res.body.data.participants).toHaveLength(2);
      expect(res.body.data.participants.map((p: any) => p.userId)).toContain(USER1_ID);
      expect(res.body.data.participants.map((p: any) => p.userId)).toContain(USER2_ID);
    });

    it('should return existing conversation if already exists', async () => {
      // Create first
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID })
        .expect(201);

      // Create again — should return same
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID })
        .expect(201);

      expect(res1.body.data._id).toBe(res2.body.data._id);
    });
  });

  describe('POST /chat/conversations/group', () => {
    it('should create a group with creator as owner', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/group')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Test Group', memberIds: [USER2_ID, USER3_ID] })
        .expect(201);

      expect(res.body.data.type).toBe('group');
      expect(res.body.data.name).toBe('Test Group');
      expect(res.body.data.participants).toHaveLength(3);

      const owner = res.body.data.participants.find((p: any) => p.userId === USER1_ID);
      expect(owner.role).toBe('owner');
    });
  });

  describe('POST /chat/conversations/channel', () => {
    it('should create a channel with channelType', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/channel')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'engineering', channelType: 'public', topic: 'Engineering discussions' })
        .expect(201);

      expect(res.body.data.type).toBe('channel');
      expect(res.body.data.channelType).toBe('public');
      expect(res.body.data.topic).toBe('Engineering discussions');
    });
  });

  describe('GET /chat/conversations', () => {
    it('should list user conversations sorted by last message', async () => {
      // Create two conversations
      await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID });

      await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/group')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Group', memberIds: [USER2_ID] });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/conversations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/chat/conversations')
        .expect(401);
    });
  });

  describe('POST /chat/conversations/:id/participants', () => {
    it('should add participants to group', async () => {
      const group = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/group')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Group', memberIds: [USER2_ID] });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${group.body.data._id}/participants`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ userIds: [USER3_ID] })
        .expect(200);

      expect(res.body.data.participants).toHaveLength(3);
    });
  });

  describe('POST /chat/conversations/:id/leave', () => {
    it('should allow user to leave group', async () => {
      const group = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/group')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Group', memberIds: [USER2_ID] });

      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${group.body.data._id}/leave`)
        .set('Authorization', `Bearer ${user2Token}`)
        .expect(200);
    });

    it('should reject leaving a direct conversation', async () => {
      const direct = await request(app.getHttpServer())
        .post('/api/v1/chat/conversations/direct')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ targetUserId: USER2_ID });

      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${direct.body.data._id}/leave`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
