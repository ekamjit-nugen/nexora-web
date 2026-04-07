import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { CallingModule } from '../../src/calling/calling.module';
import { createTestApp, generateTestToken } from '../helpers/test-app.helper';

describe('Meeting Lifecycle Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let meetingModel: Model<any>;
  let hostToken: string;
  let participantToken: string;
  let outsiderToken: string;

  const HOST_ID = 'host-meeting-lifecycle';
  const PARTICIPANT_ID = 'participant-meeting-lifecycle';
  const OUTSIDER_ID = 'outsider-meeting-lifecycle';
  const ORG_ID = 'test-org-id';

  const futureDate = () =>
    new Date(Date.now() + 3600_000).toISOString();

  beforeAll(async () => {
    ({ app, module } = await createTestApp([CallingModule]));
    jwtService = module.get(JwtService);
    meetingModel = module.get(getModelToken('Meeting'));

    hostToken = generateTestToken(jwtService, {
      sub: HOST_ID,
      email: 'host@test.com',
      firstName: 'Host',
      lastName: 'User',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    participantToken = generateTestToken(jwtService, {
      sub: PARTICIPANT_ID,
      email: 'participant@test.com',
      firstName: 'Part',
      lastName: 'User',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    outsiderToken = generateTestToken(jwtService, {
      sub: OUTSIDER_ID,
      email: 'outsider@test.com',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
  });

  afterAll(async () => {
    await meetingModel.deleteMany({});
    await app.close();
  });

  afterEach(async () => {
    await meetingModel.deleteMany({});
  });

  // Helper to schedule a basic meeting
  async function scheduleMeeting(overrides: any = {}) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/meetings')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Test Meeting',
        scheduledAt: futureDate(),
        durationMinutes: 30,
        participantIds: [PARTICIPANT_ID],
        ...overrides,
      });
    return res;
  }

  // ── POST /meetings ──

  describe('POST /meetings — schedule meeting', () => {
    it('should create a meeting and return a meetingId', async () => {
      const res = await scheduleMeeting();

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.meetingId).toBeDefined();
      expect(res.body.data.title).toBe('Test Meeting');
      expect(res.body.data.hostId).toBe(HOST_ID);
      expect(res.body.data.hostName).toBe('Host User');
      expect(res.body.data.status).toBe('scheduled');
      expect(res.body.data.durationMinutes).toBe(30);
      expect(res.body.data.participantIds).toContain(PARTICIPANT_ID);
    });

    it('should not return hashed password in response', async () => {
      const res = await scheduleMeeting({ joinPassword: 'secret123' });

      expect(res.status).toBe(201);
      expect(res.body.data.joinPassword).toBeUndefined();

      // But it should be stored in DB
      const dbMeeting = await meetingModel.findOne({ meetingId: res.body.data.meetingId });
      expect(dbMeeting.joinPassword).toBeDefined();
      expect(dbMeeting.joinPassword).not.toBe('secret123'); // It should be hashed
    });
  });

  // ── GET /meetings ──

  describe('GET /meetings — list meetings', () => {
    it('should list meetings for the current user', async () => {
      await scheduleMeeting({ title: 'Meeting 1' });
      await scheduleMeeting({ title: 'Meeting 2' });

      const res = await request(app.getHttpServer())
        .get('/api/v1/meetings')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(2);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.total).toBe(2);
    });

    it('should list meetings where user is a participant', async () => {
      await scheduleMeeting({ participantIds: [PARTICIPANT_ID] });

      const res = await request(app.getHttpServer())
        .get('/api/v1/meetings')
        .set('Authorization', `Bearer ${participantToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
    });

    it('should filter by status', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      // Start the meeting
      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      const res = await request(app.getHttpServer())
        .get('/api/v1/meetings?status=active')
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('active');
    });
  });

  // ── GET /meetings/:id ──

  describe('GET /meetings/:id — get meeting details', () => {
    it('should return meeting details for participant', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .expect(200);

      expect(res.body.data.meetingId).toBe(meetingId);
      expect(res.body.data.title).toBe('Test Meeting');
      expect(res.body.data.joinPassword).toBeUndefined(); // Stripped
    });

    it('should deny access to non-participant', async () => {
      const meeting = await scheduleMeeting({ participantIds: [] });
      const meetingId = meeting.body.data.meetingId;

      await request(app.getHttpServer())
        .get(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(400); // Wrapped as BadRequestException
    });
  });

  // ── PUT /meetings/:id ──

  describe('PUT /meetings/:id — update meeting', () => {
    it('should update whitelisted fields only', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .put(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({
          title: 'Updated Title',
          description: 'Added description',
          durationMinutes: 45,
        })
        .expect(200);

      expect(res.body.data.title).toBe('Updated Title');
      expect(res.body.data.description).toBe('Added description');
      expect(res.body.data.durationMinutes).toBe(45);
      expect(res.body.data.hostId).toBe(HOST_ID); // Not overridden
    });

    it('should reject update by non-host', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      await request(app.getHttpServer())
        .put(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .send({ title: 'Hacked Title' })
        .expect(400); // ForbiddenException wrapped in BadRequest
    });
  });

  // ── POST /meetings/:id/start ──

  describe('POST /meetings/:id/start — start meeting', () => {
    it('should start the meeting and set startedAt', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('active');
      expect(res.body.data.startedAt).toBeDefined();
    });

    it('should reject start by non-host', async () => {
      const meeting = await scheduleMeeting();

      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meeting.body.data.meetingId}/start`)
        .set('Authorization', `Bearer ${participantToken}`)
        .expect(400);
    });
  });

  // ── POST /meetings/:id/end ──

  describe('POST /meetings/:id/end — end meeting (host only)', () => {
    it('should end the meeting and set endedAt', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      // Start first
      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      const res = await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/end`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('ended');
      expect(res.body.data.endedAt).toBeDefined();
      expect(res.body.data.isRecording).toBe(false);
    });

    it('should reject end by non-host', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/start`)
        .set('Authorization', `Bearer ${hostToken}`);

      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/end`)
        .set('Authorization', `Bearer ${participantToken}`)
        .expect(400);
    });
  });

  // ── DELETE /meetings/:id ──

  describe('DELETE /meetings/:id — cancel meeting', () => {
    it('should cancel the meeting', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.body.data.status).toBe('cancelled');
    });

    it('should reject cancellation by non-host', async () => {
      const meeting = await scheduleMeeting();

      await request(app.getHttpServer())
        .delete(`/api/v1/meetings/${meeting.body.data.meetingId}`)
        .set('Authorization', `Bearer ${participantToken}`)
        .expect(400);
    });
  });

  // ── GET /meetings/:id/ics ──

  describe('GET /meetings/:id/ics — ICS calendar export', () => {
    it('should return valid ICS format', async () => {
      const meeting = await scheduleMeeting({ title: 'Calendar Test' });
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/meetings/${meetingId}/ics`)
        .set('Authorization', `Bearer ${hostToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/calendar');
      expect(res.text).toContain('BEGIN:VCALENDAR');
      expect(res.text).toContain('END:VCALENDAR');
      expect(res.text).toContain('BEGIN:VEVENT');
      expect(res.text).toContain('SUMMARY:Calendar Test');
      expect(res.text).toContain('DTSTART:');
      expect(res.text).toContain('DTEND:');
      expect(res.text).toContain(`UID:${meetingId}@nexora.io`);
    });
  });

  // ── GET /meetings/:id/public ──

  describe('GET /meetings/:id/public — public info without auth', () => {
    it('should return limited public info', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/meetings/${meetingId}/public`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(200);

      expect(res.body.data.meetingId).toBe(meetingId);
      expect(res.body.data.title).toBe('Test Meeting');
      expect(res.body.data.hostName).toBeDefined();
      // Should not include sensitive fields
      expect(res.body.data.participants).toBeUndefined();
      expect(res.body.data.transcript).toBeUndefined();
    });
  });

  // ── POST /meetings/:id/recording ──

  describe('POST /meetings/:id/recording — toggle recording', () => {
    it('should toggle recording on', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      const res = await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/recording`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ start: true })
        .expect(200);

      expect(res.body.data.isRecording).toBe(true);
    });

    it('should toggle recording off', async () => {
      const meeting = await scheduleMeeting();
      const meetingId = meeting.body.data.meetingId;

      // Start recording
      await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/recording`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ start: true });

      // Stop recording
      const res = await request(app.getHttpServer())
        .post(`/api/v1/meetings/${meetingId}/recording`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ start: false })
        .expect(200);

      expect(res.body.data.isRecording).toBe(false);
    });
  });

  // ── Meeting with password ──

  describe('Meeting with password', () => {
    it('should store hashed password and verify it works', async () => {
      const res = await scheduleMeeting({ joinPassword: 'mySecret42' });
      expect(res.status).toBe(201);

      const meetingId = res.body.data.meetingId;
      const dbMeeting = await meetingModel.findOne({ meetingId });

      // Password should be stored as bcrypt hash
      expect(dbMeeting.joinPassword).toBeDefined();
      expect(dbMeeting.joinPassword.length).toBeGreaterThan(30);
      expect(dbMeeting.joinPassword).toMatch(/^\$2[aby]?\$/);
    });

    it('should update the hashed password on PUT', async () => {
      const meeting = await scheduleMeeting({ joinPassword: 'initial' });
      const meetingId = meeting.body.data.meetingId;

      const dbBefore = await meetingModel.findOne({ meetingId });
      const hashBefore = dbBefore.joinPassword;

      await request(app.getHttpServer())
        .put(`/api/v1/meetings/${meetingId}`)
        .set('Authorization', `Bearer ${hostToken}`)
        .send({ joinPassword: 'newPassword' })
        .expect(200);

      const dbAfter = await meetingModel.findOne({ meetingId });
      expect(dbAfter.joinPassword).not.toBe(hashBefore);
      expect(dbAfter.joinPassword).toMatch(/^\$2[aby]?\$/);
    });
  });
});
