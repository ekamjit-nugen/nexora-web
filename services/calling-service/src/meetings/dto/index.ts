import { IsString, IsOptional, IsNumber, IsArray, IsBoolean, IsEnum, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ScheduleMeetingDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsDateString() scheduledAt: string;
  @IsOptional() @IsNumber() durationMinutes?: number = 60;
  @IsOptional() @IsArray() @IsString({ each: true }) participantIds?: string[] = [];
  @IsOptional() @IsBoolean() recordingEnabled?: boolean = false;
  @IsOptional() @IsString() sprintId?: string;
  @IsOptional() @IsEnum(['instant', 'scheduled', 'recurring']) type?: string;
  @IsOptional() @IsString() timeZone?: string;
  @IsOptional() lobbySettings?: { enabled?: boolean; autoAdmit?: string; message?: string };
  @IsOptional() recurrence?: {
    frequency?: string; interval?: number; daysOfWeek?: string[];
    dayOfMonth?: number; endType?: string; endAfterOccurrences?: number;
    endDate?: string; timeZone?: string;
  };
}

export class UpdateMeetingDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsNumber() durationMinutes?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) participantIds?: string[];
  @IsOptional() @IsBoolean() recordingEnabled?: boolean;
}

export class JoinMeetingAnonymousDto {
  @IsString() displayName: string;
}

export class AddTranscriptDto {
  @IsString() text: string;
  @IsString() speakerName: string;
}

export class MeetingQueryDto {
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() sprintId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) page?: number;
}

export class LobbyAdmitDto {
  @IsString() userId: string;
}
