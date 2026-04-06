import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { SearchModule } from '../../src/search/search.module';
import { PinsModule } from '../../src/pins/pins.module';
import { BookmarksModule } from '../../src/bookmarks/bookmarks.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Search, Pins & Bookmarks Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let userToken: string;
  let conversationId: string;

  const USER1_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([
      ConversationsModule, MessagesModule, SearchModule, PinsModule, BookmarksModule,
    ]));
    jwtService = module.get(JwtService);
    userToken = generateTestToken(jwtService, { sub: USER1_ID, email: 'user1@test.com' });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  beforeEach(async () => {
    await clearAllCollections(module);
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = res.body.data._id;
  });

  describe('Global search', () => {
    it('should search messages across conversations', async () => {
      // Send messages
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'The deployment pipeline is broken' });

      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Fixed the database migration' });

      // Search
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/search?q=deployment')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].message.content).toContain('deployment');
    });

    it('should filter by sender', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Message from user1' });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/search?q=Message&from=${USER1_ID}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });
  });

  describe('Pinned messages', () => {
    it('should pin and unpin a message', async () => {
      const msg = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Pin this message' });

      // Pin
      const pinRes = await request(app.getHttpServer())
        .post(`/api/v1/chat/messages/${msg.body.data._id}/pin`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(pinRes.body.data.isPinned).toBe(true);
      expect(pinRes.body.data.pinnedBy).toBe(USER1_ID);

      // List pinned
      const pinnedRes = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${conversationId}/pins`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(pinnedRes.body.data).toHaveLength(1);

      // Unpin
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/messages/${msg.body.data._id}/pin`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const afterUnpin = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${conversationId}/pins`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(afterUnpin.body.data).toHaveLength(0);
    });
  });

  describe('Bookmarks', () => {
    it('should save and remove a bookmark', async () => {
      const msg = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Save this for later' });

      // Save bookmark
      const bmRes = await request(app.getHttpServer())
        .post('/api/v1/chat/bookmarks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId: msg.body.data._id, label: 'important', note: 'Review later' })
        .expect(201);

      expect(bmRes.body.data.label).toBe('important');

      // List bookmarks
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/chat/bookmarks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(listRes.body.data).toHaveLength(1);
      expect(listRes.body.data[0].message).toBeTruthy();

      // Remove
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/bookmarks/${bmRes.body.data._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });

    it('should reject duplicate bookmark', async () => {
      const msg = await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ content: 'Bookmark me' });

      await request(app.getHttpServer())
        .post('/api/v1/chat/bookmarks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId: msg.body.data._id })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/chat/bookmarks')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ messageId: msg.body.data._id })
        .expect(409);
    });
  });
});
