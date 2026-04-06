// Backward-compatible barrel export
// New code should import from domain-specific DTOs directly
export { CreateDirectConversationDto } from '../../conversations/dto/create-direct.dto';
export { CreateGroupDto } from '../../conversations/dto/create-group.dto';
export { CreateChannelDto } from '../../conversations/dto/create-channel.dto';
export { AddParticipantsDto, ConvertToGroupDto } from '../../conversations/dto/add-participant.dto';
export { SendMessageDto, EditMessageDto, MessageQueryDto, SearchMessageDto } from '../../messages/dto/send-message.dto';

// Settings and moderation DTOs kept inline for legacy compatibility
import { IsOptional, IsString } from 'class-validator';

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

export class ReviewFlaggedMessageDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  action?: string;
}
