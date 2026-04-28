import { IsString, IsEnum, IsArray, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export class InitiateCallDto {
  @IsString()
  recipientId: string;

  @IsEnum(CallType)
  type: CallType;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

export class AnswerCallDto {
  @IsOptional()
  @IsString()
  callId?: string;

  @IsBoolean()
  @IsOptional()
  audioEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  videoEnabled?: boolean;
}

export class RejectCallDto {
  @IsOptional()
  @IsString()
  callId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class EndCallDto {
  @IsString()
  callId: string;
}

export class IceCandidateDto {
  @IsString()
  callId: string;

  @IsString()
  candidate: string;

  @IsOptional()
  @IsNumber()
  sdpMLineIndex?: number;

  @IsOptional()
  @IsString()
  sdpMid?: string;
}

export class MediaNegotiationDto {
  @IsString()
  callId: string;

  @IsString()
  sdp: string;

  @IsEnum(['offer', 'answer'])
  type: 'offer' | 'answer';
}

export class CallHistoryQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  type?: CallType;

  @IsOptional()
  limit: number = 20;

  @IsOptional()
  page: number = 1;
}

// ── Meeting DTOs ──

export class ScheduleMeetingDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  scheduledAt: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number = 60;

  @IsOptional()
  @IsArray()
  participantIds?: string[] = [];

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean = false;

  @IsOptional()
  @IsString()
  joinPassword?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;
}

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  scheduledAt?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  participantIds?: string[];

  @IsOptional()
  @IsBoolean()
  recordingEnabled?: boolean;

  @IsOptional()
  @IsString()
  joinPassword?: string;
}

export class JoinMeetingAnonymousDto {
  @IsString()
  displayName: string;
}

export class AddTranscriptDto {
  @IsString()
  text: string;

  @IsString()
  speakerName: string;
}

export class MeetingQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  limit?: number;

  @IsOptional()
  page?: number;
}
