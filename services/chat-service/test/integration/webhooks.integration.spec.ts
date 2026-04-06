import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { MessagesModule } from '../../src/messages/messages.module';
import { WebhooksModule } from '../../src/webhooks/webhooks.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Webhooks Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let adminToken: string;
  let channelId: string;

  const ADMIN_ID = '660000000000000000000001';
  const USER2_ID = '660000000000000000000002';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([ConversationsModule, MessagesModule, WebhooksModule]));
    jwtService = module.get(JwtService);
    adminToken = generateTestToken(jwtService, { sub: ADMIN_ID, email: 'admin@test.com', orgRole: 'admin' });
  });

  afterAll(async () => {
    await clearAllCollections(module);
    await app.close();
  });

  beforeEach(async () => {
    await clearAllCollections(module);
    // Create a channel for webhooks
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/conversations/channel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'deploy-notifications', channelType: 'public' });
    channelId = res.body.data._id;
  });

  describe('Incoming webhook lifecycle', () => {
    it('should create an incoming webhook and post messages via it', async () => {
      // Create webhook
      const webhookRes = await request(app.getHttpServer())
        .post('/api/v1/chat/webhooks/incoming')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conversationId: channelId, name: 'GitHub Bot' })
        .expect(201);

      const webhookUrl = webhookRes.body.data.webhookUrl;
      expect(webhookUrl).toBeTruthy();
      expect(webhookRes.body.data.secretKey).toBeTruthy();

      // Post via webhook (no auth — public endpoint)
      const ingestRes = await request(app.getHttpServer())
        .post(`/api/v1/hooks/${webhookUrl}`)
        .send({
          text: 'Build #142 deployed to production',
          username: 'Deploy Bot',
        })
        .expect(200);

      expect(ingestRes.body.data.messageId).toBeTruthy();

      // Verify message appears in channel
      const messages = await request(app.getHttpServer())
        .get(`/api/v1/chat/conversations/${channelId}/messages`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(messages.body.data).toHaveLength(1);
      expect(messages.body.data[0].content).toBe('Build #142 deployed to production');
      expect(messages.body.data[0].senderName).toBe('Deploy Bot');
      expect(messages.body.data[0].webhookId).toBeTruthy();
    });

    it('should reject posts to inactive webhook', async () => {
      const webhookRes = await request(app.getHttpServer())
        .post('/api/v1/chat/webhooks/incoming')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conversationId: channelId, name: 'Test Bot' });

      // Disable webhook
      await request(app.getHttpServer())
        .post(`/api/v1/chat/webhooks/${webhookRes.body.data._id}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Try to post — should fail
      await request(app.getHttpServer())
        .post(`/api/v1/hooks/${webhookRes.body.data.webhookUrl}`)
        .send({ text: 'Should fail' })
        .expect(404);
    });
  });

  describe('Webhook management', () => {
    it('should list and delete webhooks', async () => {
      // Create two webhooks
      await request(app.getHttpServer())
        .post('/api/v1/chat/webhooks/incoming')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conversationId: channelId, name: 'Bot 1' });

      await request(app.getHttpServer())
        .post('/api/v1/chat/webhooks/incoming')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ conversationId: channelId, name: 'Bot 2' });

      // List
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/chat/webhooks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(listRes.body.data).toHaveLength(2);

      // Delete one
      await request(app.getHttpServer())
        .delete(`/api/v1/chat/webhooks/${listRes.body.data[0]._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const afterDelete = await request(app.getHttpServer())
        .get('/api/v1/chat/webhooks')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(afterDelete.body.data).toHaveLength(1);
    });
  });
});
