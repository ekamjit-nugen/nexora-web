import { IsString, IsOptional, IsArray, IsEnum, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDirectConversationDto {
  @IsString()
  targetUserId: string;
}

export class CreateGroupDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  memberIds: string[];
}

export class CreateChannelDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  memberIds?: string[];
}

export class ConvertToGroupDto {
  @IsArray()
  @IsString({ each: true })
  memberIds: string[];

  @IsOptional()
  @IsString()
  groupName?: string;
}

export class AddParticipantsDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(['text', 'file', 'image', 'system'])
  type?: string;

  @IsOptional()
  @IsString()
  replyTo?: string;
}

export class EditMessageDto {
  @IsString()
  content: string;
}

export class MessageQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class SearchMessageDto {
  @IsString()
  q: string;
}

// ── Chat Settings DTOs ──

export class UpdateChatSettingsDto {
  @IsOptional()
  readReceipts?: {
    showMyReadStatus?: boolean;
    showOthersReadStatus?: boolean;
  };

  @IsOptional()
  appearance?: {
    chatBgColor?: string;
    myBubbleColor?: string;
    myTextColor?: string;
    otherBubbleColor?: string;
    otherTextColor?: string;
    fontSize?: string;
  };

  @IsOptional()
  notifications?: {
    sound?: boolean;
    desktop?: boolean;
    muteAll?: boolean;
  };
}

// ── Moderation DTOs ──

export class ReviewFlaggedMessageDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  action?: string;
}
