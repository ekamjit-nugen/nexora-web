import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import * as request from 'supertest';
import { ConversationsModule } from '../../src/conversations/conversations.module';
import { VoiceMessagesModule } from '../../src/voice-messages/voice-messages.module';
import { createTestApp, generateTestToken, clearAllCollections } from '../helpers/test-app.helper';

describe('Voice Messages Integration', () => {
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
    ({ app, module } = await createTestApp([ConversationsModule, VoiceMessagesModule]));
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

  describe('POST /chat/voice — send voice message', () => {
    it('should send a voice message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/voice')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          conversationId,
          audioUrl: 'https://media.nexora.test/audio/voice-123.webm',
          duration: 15,
          fileSize: 48000,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.type).toBe('audio');
      expect(res.body.data.senderId).toBe(USER1_ID);
      expect(res.body.data.conversationId).toBe(conversationId);
      expect(res.body.data.fileUrl).toBe('https://media.nexora.test/audio/voice-123.webm');
      expect(res.body.data.content).toContain('0:15');
    });

    it('should reject sending voice message to a conversation user does not belong to', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });

      await request(app.getHttpServer())
        .post('/api/v1/chat/voice')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          conversationId,
          audioUrl: 'https://media.nexora.test/audio/voice-456.webm',
          duration: 10,
          fileSize: 32000,
        })
        .expect(403);
    });

    it('should reject sending voice message without required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/chat/voice')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ conversationId })
        .expect(400);
    });
  });

  describe('POST /chat/voice/:messageId/transcribe — save transcription', () => {
    let voiceMessageId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/voice')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          conversationId,
          audioUrl: 'https://media.nexora.test/audio/voice-789.webm',
          duration: 5,
          fileSize: 16000,
        });
      voiceMessageId = res.body.data._id;
    });

    it('should save a transcription for a voice message', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/chat/voice/${voiceMessageId}/transcribe`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ transcription: 'Hey, can we meet at 3pm today?' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.transcription).toBe('Hey, can we meet at 3pm today?');
    });

    it('should allow another participant to save transcription', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/chat/voice/${voiceMessageId}/transcribe`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ transcription: 'Transcribed by user2' })
        .expect(200);

      expect(res.body.data.transcription).toBe('Transcribed by user2');
    });

    it('should reject transcription by non-participant', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });

      await request(app.getHttpServer())
        .post(`/api/v1/chat/voice/${voiceMessageId}/transcribe`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({ transcription: 'Unauthorized transcription' })
        .expect(403);
    });
  });

  describe('GET /chat/voice/:messageId/transcription — retrieve transcription', () => {
    let voiceMessageId: string;

    beforeEach(async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/chat/voice')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          conversationId,
          audioUrl: 'https://media.nexora.test/audio/voice-abc.webm',
          duration: 8,
          fileSize: 24000,
        });
      voiceMessageId = res.body.data._id;
    });

    it('should retrieve a saved transcription', async () => {
      // First, save a transcription
      await request(app.getHttpServer())
        .post(`/api/v1/chat/voice/${voiceMessageId}/transcribe`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ transcription: 'This is the transcribed text' });

      // Then retrieve it
      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/voice/${voiceMessageId}/transcription`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.transcription).toBe('This is the transcribed text');
    });

    it('should return null when no transcription exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/chat/voice/${voiceMessageId}/transcription`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.transcription).toBeNull();
    });

    it('should reject retrieval by non-participant', async () => {
      const user3Token = generateTestToken(jwtService, { sub: USER3_ID, email: 'user3@test.com' });

      await request(app.getHttpServer())
        .get(`/api/v1/chat/voice/${voiceMessageId}/transcription`)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(403);
    });
  });
});
