import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { ForwardingService } from './forwarding.service';
import { CreateTaskService } from './create-task.service';
import { LinkPreviewService } from './link-preview.service';
import { MessageSchema } from './schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';
import { ChatSettingsSchema } from '../settings/schemas/chat-settings.schema';
import { FlaggedMessageSchema } from '../moderation/schemas/flagged-message.schema';
import { ModerationService } from '../moderation/moderation.service';
import { MentionsService } from '../mentions/mentions.service';
import { ConversationsModule } from '../conversations/conversations.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { CommandsModule } from '../commands/commands.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'ChatSettings', schema: ChatSettingsSchema },
      { name: 'FlaggedMessage', schema: FlaggedMessageSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start without a JWT secret.');
        }
        return { secret };
      },
    }),
    forwardRef(() => ConversationsModule),
    ComplianceModule,
    CommandsModule,
  ],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesGateway, ModerationService, MentionsService, ForwardingService, CreateTaskService, LinkPreviewService],
  exports: [MessagesService, MessagesGateway, MongooseModule],
})
export class MessagesModule {}
