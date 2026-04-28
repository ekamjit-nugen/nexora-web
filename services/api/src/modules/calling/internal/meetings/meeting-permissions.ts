import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

/**
 * Meeting permission helper functions.
 * Centralized host/co-host authority checks applied across all meeting operations.
 */

export function isHost(meeting: any, userId: string): boolean {
  return meeting.hostId === userId;
}

export function isCoHost(meeting: any, userId: string): boolean {
  return meeting.coHostIds?.includes(userId) || false;
}

export function canPerformHostAction(meeting: any, userId: string): boolean {
  return isHost(meeting, userId) || isCoHost(meeting, userId);
}

export function canAdmitFromLobby(meeting: any, userId: string): boolean {
  return canPerformHostAction(meeting, userId);
}

export function canMuteParticipant(meeting: any, userId: string): boolean {
  return canPerformHostAction(meeting, userId);
}

export function canStartRecording(meeting: any, userId: string): boolean {
  if (canPerformHostAction(meeting, userId)) return true;
  return meeting.settings?.recording?.allowParticipantStart || false;
}

export function canEndMeeting(meeting: any, userId: string): boolean {
  return isHost(meeting, userId); // Only host, not co-host
}

export function canManageBreakout(meeting: any, userId: string): boolean {
  return canPerformHostAction(meeting, userId);
}

export function canRemoveParticipant(meeting: any, userId: string): boolean {
  return canPerformHostAction(meeting, userId);
}

export function canUpdateMeeting(meeting: any, userId: string): boolean {
  return canPerformHostAction(meeting, userId);
}

/**
 * Hash a plain-text meeting password before storing.
 */
export async function hashMeetingPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

/**
 * Verify meeting password if set. Throws ForbiddenException on mismatch.
 * Uses bcrypt.compare for hashed passwords.
 */
export async function verifyMeetingPassword(meeting: any, password?: string): Promise<void> {
  if (!meeting.joinPassword) return;
  if (!password) {
    throw new ForbiddenException({
      code: 'INVALID_MEETING_PASSWORD',
      message: 'Incorrect meeting password',
    });
  }
  const matches = await bcrypt.compare(password, meeting.joinPassword);
  if (!matches) {
    throw new ForbiddenException({
      code: 'INVALID_MEETING_PASSWORD',
      message: 'Incorrect meeting password',
    });
  }
}

/**
 * Assert that userId has host/co-host authority. Throws if not.
 */
export function requireHostAction(meeting: any, userId: string, action: string = 'this action'): void {
  if (!canPerformHostAction(meeting, userId)) {
    throw new ForbiddenException(`Only the host or co-host can perform ${action}`);
  }
}

/**
 * Assert that userId is the host (not co-host). Throws if not.
 */
export function requireHost(meeting: any, userId: string, action: string = 'this action'): void {
  if (!isHost(meeting, userId)) {
    throw new ForbiddenException(`Only the meeting host can perform ${action}`);
  }
}
