import {
  isHost, isCoHost, canPerformHostAction, canAdmitFromLobby,
  canMuteParticipant, canStartRecording, canEndMeeting, canManageBreakout,
  verifyMeetingPassword, requireHostAction, requireHost,
} from './meeting-permissions';
import { ForbiddenException } from '@nestjs/common';

describe('Meeting Permissions', () => {
  const meeting = {
    hostId: 'host-123',
    coHostIds: ['cohost-456'],
    settings: { recording: { allowParticipantStart: false } },
    joinPassword: 'secret123',
  };

  describe('isHost', () => {
    it('should return true for host', () => {
      expect(isHost(meeting, 'host-123')).toBe(true);
    });
    it('should return false for co-host', () => {
      expect(isHost(meeting, 'cohost-456')).toBe(false);
    });
    it('should return false for random user', () => {
      expect(isHost(meeting, 'random-789')).toBe(false);
    });
  });

  describe('isCoHost', () => {
    it('should return true for co-host', () => {
      expect(isCoHost(meeting, 'cohost-456')).toBe(true);
    });
    it('should return false for host', () => {
      expect(isCoHost(meeting, 'host-123')).toBe(false);
    });
  });

  describe('canPerformHostAction', () => {
    it('should allow host', () => {
      expect(canPerformHostAction(meeting, 'host-123')).toBe(true);
    });
    it('should allow co-host', () => {
      expect(canPerformHostAction(meeting, 'cohost-456')).toBe(true);
    });
    it('should deny participant', () => {
      expect(canPerformHostAction(meeting, 'random-789')).toBe(false);
    });
  });

  describe('canStartRecording', () => {
    it('should allow host', () => {
      expect(canStartRecording(meeting, 'host-123')).toBe(true);
    });
    it('should deny participant when allowParticipantStart is false', () => {
      expect(canStartRecording(meeting, 'random-789')).toBe(false);
    });
    it('should allow participant when allowParticipantStart is true', () => {
      const m = { ...meeting, settings: { recording: { allowParticipantStart: true } } };
      expect(canStartRecording(m, 'random-789')).toBe(true);
    });
  });

  describe('canEndMeeting', () => {
    it('should only allow host (not co-host)', () => {
      expect(canEndMeeting(meeting, 'host-123')).toBe(true);
      expect(canEndMeeting(meeting, 'cohost-456')).toBe(false);
    });
  });

  describe('verifyMeetingPassword', () => {
    it('should pass with correct password', () => {
      expect(() => verifyMeetingPassword(meeting, 'secret123')).not.toThrow();
    });
    it('should throw with wrong password', () => {
      expect(() => verifyMeetingPassword(meeting, 'wrong')).toThrow(ForbiddenException);
    });
    it('should pass when no password set', () => {
      expect(() => verifyMeetingPassword({ joinPassword: null }, undefined)).not.toThrow();
    });
  });

  describe('requireHostAction', () => {
    it('should not throw for host', () => {
      expect(() => requireHostAction(meeting, 'host-123')).not.toThrow();
    });
    it('should throw for participant', () => {
      expect(() => requireHostAction(meeting, 'random-789')).toThrow(ForbiddenException);
    });
  });

  describe('requireHost', () => {
    it('should not throw for host', () => {
      expect(() => requireHost(meeting, 'host-123')).not.toThrow();
    });
    it('should throw for co-host', () => {
      expect(() => requireHost(meeting, 'cohost-456')).toThrow(ForbiddenException);
    });
  });
});
