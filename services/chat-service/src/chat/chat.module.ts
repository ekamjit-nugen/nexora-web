import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MessagesModule } from '../messages/messages.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ModerationService } from './moderation.service';
import { ConversationSchema } from './schemas/conversation.schema';
import { ChatSettingsSchema } from './schemas/chat-settings.schema';
import { FlaggedMessageSchema } from './schemas/flagged-message.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'ChatSettings', schema: ChatSettingsSchema },
      { name: 'FlaggedMessage', schema: FlaggedMessageSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
    forwardRef(() => MessagesModule),
  ],
  controllers: [ChatController],
  providers: [ChatService, ModerationService, JwtAuthGuard, RolesGuard],
  exports: [ChatService, ModerationService],
})
export class ChatModule {}
