import { IsString, IsOptional, IsEnum, IsNumber, Min, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export enum CallType { AUDIO = 'audio', VIDEO = 'video' }

export class InitiateCallDto {
  @IsString() recipientId: string;
  @IsEnum(CallType) type: CallType;
  @IsOptional() @IsString() conversationId?: string;
}

export class InitiateGroupCallDto {
  @IsArray() @IsString({ each: true }) participantIds: string[];
  @IsEnum(CallType) type: CallType;
  @IsOptional() @IsString() conversationId?: string;
}

export class AnswerCallDto {
  @IsOptional() @IsString() callId?: string;
  @IsOptional() @IsBoolean() audioEnabled?: boolean;
  @IsOptional() @IsBoolean() videoEnabled?: boolean;
}

export class RejectCallDto {
  @IsOptional() @IsString() callId?: string;
  @IsOptional() @IsString() reason?: string;
}

export class EndCallDto {
  @IsString() callId: string;
}

export class IceCandidateDto {
  @IsString() callId: string;
  @IsString() candidate: string;
  @IsOptional() @IsNumber() sdpMLineIndex?: number;
  @IsOptional() @IsString() sdpMid?: string;
}

export class MediaNegotiationDto {
  @IsString() callId: string;
  @IsString() sdp: string;
  @IsEnum(['offer', 'answer']) type: string;
}

export class CallHistoryQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsEnum(CallType) type?: CallType;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number = 20;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number = 1;
}

export class TransferCallDto {
  @IsString() callId: string;
  @IsString() targetUserId: string;
  @IsEnum(['cold', 'warm']) transferType: string;
}
