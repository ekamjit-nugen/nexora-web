import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { ComplianceModule } from '../../src/compliance/compliance.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Compliance Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let ownerToken: string;
  let conversationId: string;

  const OWNER_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, MessagesModule, ComplianceModule]));
    jwtService = module.get(JwtService);
    ownerToken = generateTestToken(jwtService, { sub: OWNER_ID, email: 'owner@test.com', orgRole: 'owner' });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  beforeEach(async () => {
    await clearAllCollections(module);
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/direct')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ targetUserId: USER2_ID });
    conversationId = res.body.data._id;
  });

  describe('DLP rules', () => {
    it('should create and list DLP rules', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/chat/compliance/dlp')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Credit Card Detection',
          pattern: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
          action: 'flag',
          scope: 'all',
          message: 'Credit card numbers are not allowed',
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/compliance/dlp')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].name).toBe('Credit Card Detection');
    });

    it('should return built-in patterns', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/compliance/dlp/patterns')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.credit_card).toBeDefined();
      expect(res.body.data.pan).toBeDefined();
      expect(res.body.data.aadhaar).toBeDefined();
    });
  });

  describe('Legal holds', () => {
    it('should create and release a legal hold', async () => {
      const holdRes = await request(app.getHttpServer())
        .post('/api/v1/chat/compliance/legal-holds')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Case #2026-42',
          scope: 'conversation',
          targetConversationIds: [conversationId],
        })
        .expect(201);

      expect(holdRes.body.data.isActive).toBe(true);

      // List holds
      const list = await request(app.getHttpServer())
        .get('/api/v1/chat/compliance/legal-holds')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(list.body.data).toHaveLength(1);

      // Release
      await request(app.getHttpServer())
        .post(`/api/v1/chat/compliance/legal-holds/${holdRes.body.data._id}/release`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);
    });
  });

  describe('eDiscovery', () => {
    it('should search across all org conversations', async () => {
      // Send some messages
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Sensitive quarterly report numbers' });

      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Regular chat message' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/chat/compliance/ediscovery/search?q=quarterly')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].content).toContain('quarterly');
    });

    it('should export search results', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ content: 'Export this message' });

      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/compliance/ediscovery/export')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ q: 'Export' })
        .expect(200);

      expect(res.body.data.count).toBe(1);
      expect(res.body.data.exportedAt).toBeTruthy();
      expect(res.body.data.data[0].content).toContain('Export');
    });
  });

  describe('Retention policies', () => {
    it('should create a retention policy', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/compliance/retention')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: '90-day retention',
          retentionDays: 90,
          scope: 'all',
        })
        .expect(201);

      expect(res.body.data.retentionDays).toBe(90);
    });
  });
});
