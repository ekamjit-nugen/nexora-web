import { INestApplication } from '@nestjs/common';
import { TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as request from 'supertest';
import { CallingModule } from '../../src/calling/calling.module';
import { CallRecordingService } from '../../src/calls/call-recording.service';
import { VoicemailService } from '../../src/calls/voicemail/voicemail.service';
import { createTestApp, generateTestToken } from '../helpers/test-app.helper';

describe('Recording & Voicemail Integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let jwtService: JwtService;
  let callModel: Model<any>;
  let recordingService: CallRecordingService;
  let voicemailService: VoicemailService;
  let userAToken: string;
  let userBToken: string;
  let outsiderToken: string;

  const USER_A = 'user-a-recording';
  const USER_B = 'user-b-recording';
  const OUTSIDER = 'outsider-recording';
  const ORG_ID = 'test-org-id';

  beforeAll(async () => {
    ({ app, module } = await createTestApp([CallingModule]));
    jwtService = module.get(JwtService);
    callModel = module.get(getModelToken('Call'));
    recordingService = module.get(CallRecordingService);
    voicemailService = module.get(VoicemailService);

    userAToken = generateTestToken(jwtService, {
      sub: USER_A,
      email: 'userA@test.com',
      firstName: 'Alice',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    userBToken = generateTestToken(jwtService, {
      sub: USER_B,
      email: 'userB@test.com',
      firstName: 'Bob',
      organizationId: ORG_ID,
      orgRole: 'admin',
    });
    outsiderToken = generateTestToken(jwtService, {
      sub: OUTSIDER,
      email: 'outsider@test.com',
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

  /**
   * Helper: create a connected call between USER_A and USER_B.
   */
  async function createConnectedCall(): Promise<string> {
    const create = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ recipientId: USER_B, type: 'audio' });

    const callId = create.body.data.callId;

    await request(app.getHttpServer())
      .post(`/api/v1/calls/${callId}/answer`)
      .set('Authorization', `Bearer ${userBToken}`)
      .send({});

    return callId;
  }

  /**
   * Helper: create a missed call (USER_A calls USER_B, no answer).
   */
  async function createMissedCall(): Promise<string> {
    const create = await request(app.getHttpServer())
      .post('/api/v1/calls')
      .set('Authorization', `Bearer ${userAToken}`)
      .send({ recipientId: USER_B, type: 'audio' });

    const callId = create.body.data.callId;

    await request(app.getHttpServer())
      .post(`/api/v1/calls/${callId}/end`)
      .set('Authorization', `Bearer ${userAToken}`);

    return callId;
  }

  // ── Call Recording ──

  describe('Start recording', () => {
    it('should start recording atomically (prevents race condition)', async () => {
      const callId = await createConnectedCall();

      const call = await recordingService.startRecording(callId, USER_A);

      expect(call.recording.enabled).toBe(true);
      expect(call.recording.startedBy).toBe(USER_A);
      expect(call.recording.startedAt).toBeDefined();

      // Second call to startRecording should return existing state (no-op)
      const call2 = await recordingService.startRecording(callId, USER_B);
      expect(call2.recording.enabled).toBe(true);
      // startedBy should still be USER_A (first to start)
      expect(call2.recording.startedBy).toBe(USER_A);
    });

    it('should reject start recording by non-participant', async () => {
      const callId = await createConnectedCall();

      await expect(
        recordingService.startRecording(callId, OUTSIDER),
      ).rejects.toThrow();
    });

    it('should reject start recording on non-connected call', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/calls')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ recipientId: USER_B, type: 'audio' });

      // Call is still 'initiated', not 'connected'
      await expect(
        recordingService.startRecording(create.body.data.callId, USER_A),
      ).rejects.toThrow();
    });
  });

  describe('Stop recording', () => {
    it('should stop recording — permission check (participant)', async () => {
      const callId = await createConnectedCall();

      // Start recording
      await recordingService.startRecording(callId, USER_A);

      // Stop recording by participant B
      const call = await recordingService.stopRecording(callId, USER_B);

      expect(call.recording.enabled).toBe(false);
      expect(call.recording.endedAt).toBeDefined();
      expect(call.recording.duration).toBeDefined();
      expect(call.recording.duration).toBeGreaterThanOrEqual(0);
    });

    it('should stop recording — permission check (startedBy user)', async () => {
      const callId = await createConnectedCall();

      await recordingService.startRecording(callId, USER_A);

      const call = await recordingService.stopRecording(callId, USER_A);
      expect(call.recording.enabled).toBe(false);
    });

    it('should reject stop recording by non-participant', async () => {
      const callId = await createConnectedCall();

      await recordingService.startRecording(callId, USER_A);

      await expect(
        recordingService.stopRecording(callId, OUTSIDER),
      ).rejects.toThrow();
    });

    it('should be idempotent — stopping when not recording returns call', async () => {
      const callId = await createConnectedCall();

      // Not recording, stop should return the call without error
      const call = await recordingService.stopRecording(callId, USER_A);
      expect(call.recording.enabled).toBeFalsy();
    });
  });

  // ── Voicemail ──

  describe('Leave voicemail', () => {
    it('should store audio URL on a missed call', async () => {
      const callId = await createMissedCall();

      const call = await voicemailService.leaveVoicemail(
        callId,
        USER_A,
        'https://media.nexora.io/voicemail/abc123.webm',
        15,
      );

      expect((call.metadata as any).voicemail).toBeDefined();
      expect((call.metadata as any).voicemail.audioUrl).toBe('https://media.nexora.io/voicemail/abc123.webm');
      expect((call.metadata as any).voicemail.duration).toBe(15);
      expect((call.metadata as any).voicemail.leftBy).toBe(USER_A);
      expect((call.metadata as any).voicemail.listened).toBe(false);
    });

    it('should reject voicemail on non-missed call', async () => {
      const callId = await createConnectedCall();

      await expect(
        voicemailService.leaveVoicemail(callId, USER_A, 'https://media.nexora.io/vm.webm', 10),
      ).rejects.toThrow();
    });
  });

  describe('Get voicemails', () => {
    it('should return voicemails for the user', async () => {
      // Create 2 missed calls with voicemails
      const callId1 = await createMissedCall();
      const callId2 = await createMissedCall();

      await voicemailService.leaveVoicemail(callId1, USER_A, 'https://media.nexora.io/vm1.webm', 10);
      await voicemailService.leaveVoicemail(callId2, USER_A, 'https://media.nexora.io/vm2.webm', 20);

      // USER_B should see these voicemails (they were the recipient)
      const voicemails = await voicemailService.getVoicemails(USER_B, ORG_ID);

      expect(voicemails.length).toBe(2);
      expect(voicemails[0].voicemail).toBeDefined();
      expect(voicemails[0].from).toBe(USER_A);
    });

    it('should not return calls without voicemails', async () => {
      await createMissedCall(); // No voicemail left

      const voicemails = await voicemailService.getVoicemails(USER_B, ORG_ID);
      expect(voicemails.length).toBe(0);
    });
  });

  describe('Mark voicemail as listened', () => {
    it('should mark voicemail as listened', async () => {
      const callId = await createMissedCall();
      await voicemailService.leaveVoicemail(callId, USER_A, 'https://media.nexora.io/vm.webm', 10);

      await voicemailService.markAsListened(callId, USER_B);

      const dbCall = await callModel.findOne({ callId });
      expect((dbCall.metadata as any).voicemail.listened).toBe(true);
      expect((dbCall.metadata as any).voicemail.listenedAt).toBeDefined();
    });

    it('should reject marking by non-participant', async () => {
      const callId = await createMissedCall();
      await voicemailService.leaveVoicemail(callId, USER_A, 'https://media.nexora.io/vm.webm', 10);

      await expect(
        voicemailService.markAsListened(callId, OUTSIDER),
      ).rejects.toThrow();
    });
  });

  describe('Delete voicemail', () => {
    it('should delete voicemail from call record', async () => {
      const callId = await createMissedCall();
      await voicemailService.leaveVoicemail(callId, USER_A, 'https://media.nexora.io/vm.webm', 10);

      await voicemailService.deleteVoicemail(callId, USER_B);

      const dbCall = await callModel.findOne({ callId });
      expect((dbCall.metadata as any).voicemail).toBeUndefined();
    });

    it('should reject deletion by non-participant', async () => {
      const callId = await createMissedCall();
      await voicemailService.leaveVoicemail(callId, USER_A, 'https://media.nexora.io/vm.webm', 10);

      await expect(
        voicemailService.deleteVoicemail(callId, OUTSIDER),
      ).rejects.toThrow();
    });
  });
});
