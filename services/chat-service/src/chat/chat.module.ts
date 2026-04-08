import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { ModerationService } from './moderation.service';
import { ConversationSchema } from './schemas/conversation.schema';
import { MessageSchema } from './schemas/message.schema';
import { ChatSettingsSchema } from './schemas/chat-settings.schema';
import { FlaggedMessageSchema } from './schemas/flagged-message.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CommandsModule } from '../commands/commands.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'Message', schema: MessageSchema },
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
    CommandsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, ModerationService, JwtAuthGuard],
  exports: [ChatService, ChatGateway, ModerationService],
})
export class ChatModule {}
