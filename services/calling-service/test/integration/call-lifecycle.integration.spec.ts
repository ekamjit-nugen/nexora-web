import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { CallingModule } from '../../src/calling/calling.module';
import { createTestApp, generateTestToken } from '../helpers/test-app.helper';

describe('Call Lifecycle Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let callModel: Model<any>;
  let userAToken: string;
  let userBToken: string;
  let adminToken: string;

  const USER_A = 'user-a-call-lifecycle';
  const USER_B = 'user-b-call-lifecycle';
  const ADMIN_USER = 'admin-call-lifecycle';
  const ORG_ID = 'test-org-id';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([CallingModule]));
    jwtService = module.get(JwtService);
    callModel = module.get(getModelToken('Call'));

    userAToken = generateTestToken(jwtService, {
      sub: USER_A,
      email: 'userA@test.com',
      firstName: 'Alice',
      lastName: 'Caller',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    userBToken = generateTestToken(jwtService, {
      sub: USER_B,
      email: 'userB@test.com',
      firstName: 'Bob',
      lastName: 'Recipient',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    adminToken = generateTestToken(jwtService, {
      sub: ADMIN_USER,
      email: 'admin@test.com',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
  });

  afterAll(async () => {
    await callModel.deleteMany({});
    await app.close();
  });

  afterEach(async () => {
    await callModel.deleteMany({});
  });

  // ── POST /calls ──

  describe('POST /calls — initiate call', () => {
    it('should create a call record and return it', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.callId).toBeDefined();
      expect(res.body.data.callId).toContain('nxr-call-');
      expect(res.body.data.initiatorId).toBe(USER_A);
      expect(res.body.data.participantIds).toContain(USER_A);
      expect(res.body.data.participantIds).toContain(USER_B);
      expect(res.body.data.status).toBe('initiated');
      expect(res.body.data.type).toBe('audio');

      // Verify persisted in DB
      const dbCall = await callModel.findOne({ callId: res.body.data.callId });
      expect(dbCall).toBeDefined();
      expect(dbCall.organizationId).toBe(ORG_ID);
    });

    it('should create a video call with correct type', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'video' })
        .expect(201);

      expect(res.body.data.type).toBe('video');
    });

    it('should reject without auth', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/calls')
        .send({ recipientId: USER_B, type: 'audio' })
        .expect(401);
    });
  });

  // ── POST /calls/:id/answer ──

  describe('POST /calls/:id/answer — answer call', () => {
    it('should transition status from initiated to connected', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const callId = create.body.data.callId;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/answer`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ audioEnabled: true, videoEnabled: false })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('connected');
      expect(res.body.data.startTime).toBeDefined();

      // Verify participant was added
      const answererParticipant = res.body.data.participants.find(
        (p: any) => p.userId === USER_B,
      );
      expect(answererParticipant).toBeDefined();
      expect(answererParticipant.audioEnabled).toBe(true);
    });

    it('should reject answering a non-initiated call', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const callId = create.body.data.callId;

      // Answer once
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/answer`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});

      // End the call
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`);

      // Try to answer an ended call
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/answer`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({})
        .expect(400);
    });
  });

  // ── POST /calls/:id/reject ──

  describe('POST /calls/:id/reject — reject call', () => {
    it('should reject with reason and update status', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const callId = create.body.data.callId;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/reject`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ reason: 'busy' })
        .expect(200);

      expect(res.body.data.status).toBe('rejected');
      expect(res.body.data.rejectionReason).toBe('busy');
      expect(res.body.data.endTime).toBeDefined();
    });

    it('should reject without a reason', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/reject`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({})
        .expect(200);

      expect(res.body.data.status).toBe('rejected');
    });

    it('should not reject an already connected call', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      // Answer first
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/answer`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});

      // Try to reject
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/reject`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ reason: 'busy' })
        .expect(400);
    });
  });

  // ── POST /calls/:id/end ──

  describe('POST /calls/:id/end — end call', () => {
    it('should end a connected call and calculate duration', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const callId = create.body.data.callId;

      // Answer the call
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/answer`)
        .set('Authorization', `Bearer ${userBToken}`)
        .send({});

      // End the call
      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ended');
      expect(res.body.data.endTime).toBeDefined();
      expect(res.body.data.duration).toBeDefined();
      expect(res.body.data.duration).toBeGreaterThanOrEqual(0);
    });

    it('should mark initiated (unanswered) call as missed when ended', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('missed');
    });

    it('should be idempotent — ending an ended call returns the call', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      // End once
      await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`);

      // End again — should succeed without error
      const res = await request(app.getHttpServer())
        .post(`/api/v1/calls/${create.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });
  });

  // ── GET /calls/history ──

  describe('GET /calls/history — paginated, filtered', () => {
    beforeEach(async () => {
      // Create several calls for the user
      for (let i = 0; i < 5; i++) {
        const create = await request(app.getHttpServer())
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ recipientId: USER_B, type: i % 2 === 0 ? 'audio' : 'video' });

        if (i < 2) {
          // Answer and end the first 2 calls
          await request(app.getHttpServer())
            .post(`/api/v1/calls/${create.body.data.callId}/answer`)
            .set('Authorization', `Bearer ${userBToken}`)
            .send({});
          await request(app.getHttpServer())
            .post(`/api/v1/calls/${create.body.data.callId}/end`)
            .set('Authorization', `Bearer ${userAToken}`);
        }
      }
    });

    it('should return paginated call history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/history?limit=3&page=1')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(3);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(5);
      expect(res.body.pagination.pages).toBe(2);
    });

    it('should filter by status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/history?status=ended')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      res.body.data.forEach((call: any) => {
        expect(call.status).toBe('ended');
      });
    });

    it('should filter by type', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/history?type=video')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      res.body.data.forEach((call: any) => {
        expect(call.type).toBe('video');
      });
    });
  });

  // ── GET /calls/missed ──

  describe('GET /calls/missed — missed calls', () => {
    it('should return only missed calls not initiated by the user', async () => {
      // User A calls User B, then ends without answer -> missed for B
      const create1 = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      await request(app.getHttpServer())
        .post(`/api/v1/calls/${create1.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userAToken}`);

      // User B calls User A, then ends without answer -> missed for A
      const create2 = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ recipientId: USER_A, type: 'audio' });

      await request(app.getHttpServer())
        .post(`/api/v1/calls/${create2.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userBToken}`);

      // User B checks missed calls — should only see the one A initiated
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/missed')
        .set('Authorization', `Bearer ${userBToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].initiatorId).toBe(USER_A);

      // User A checks missed calls — should only see the one B initiated
      const resA = await request(app.getHttpServer())
        .get('/api/v1/calls/missed')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(resA.body.data.length).toBe(1);
      expect(resA.body.data[0].initiatorId).toBe(USER_B);
    });
  });

  // ── GET /calls/stats ──

  describe('GET /calls/stats — call statistics', () => {
    it('should return correct counts for today', async () => {
      // Create and complete 2 calls
      for (let i = 0; i < 2; i++) {
        const c = await request(app.getHttpServer())
          .post('/api/v1/calls')
          .set('Authorization', `Bearer ${userAToken}`)
          .send({ recipientId: USER_B, type: 'audio' });

        await request(app.getHttpServer())
          .post(`/api/v1/calls/${c.body.data.callId}/answer`)
          .set('Authorization', `Bearer ${userBToken}`)
          .send({});

        await request(app.getHttpServer())
          .post(`/api/v1/calls/${c.body.data.callId}/end`)
          .set('Authorization', `Bearer ${userAToken}`);
      }

      // Create 1 missed call (B calls A, no answer)
      const missed = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ recipientId: USER_A, type: 'audio' });

      await request(app.getHttpServer())
        .post(`/api/v1/calls/${missed.body.data.callId}/end`)
        .set('Authorization', `Bearer ${userBToken}`);

      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/stats')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.totalToday).toBe(3);
      expect(res.body.data.completedToday).toBe(2);
      expect(res.body.data.missedToday).toBe(1);
      expect(typeof res.body.data.avgDuration).toBe('number');
    });
  });

  // ── GET /calls/ice-servers ──

  describe('GET /calls/ice-servers — STUN/TURN config', () => {
    it('should return STUN servers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/calls/ice-servers')
        .set('Authorization', `Bearer ${userAToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.iceServers).toBeDefined();
      expect(Array.isArray(res.body.data.iceServers)).toBe(true);
      expect(res.body.data.iceServers.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.iceServers[0].urls).toContain('stun:');
    });
  });

  // ── PUT /calls/:id/notes ──

  describe('PUT /calls/:id/notes — update call notes', () => {
    it('should update notes on a call', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      const callId = create.body.data.callId;

      const res = await request(app.getHttpServer())
        .put(`/api/v1/calls/${callId}/notes`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ notes: 'Discussed project timeline' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.notes).toBe('Discussed project timeline');

      // Verify persisted
      const dbCall = await callModel.findOne({ callId });
      expect(dbCall.notes).toBe('Discussed project timeline');
    });

    it('should reject notes update by non-participant', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      await request(app.getHttpServer())
        .put(`/api/v1/calls/${create.body.data.callId}/notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Unauthorized notes' })
        .expect(400); // Wrapped as BadRequestException in controller
    });
  });
});
