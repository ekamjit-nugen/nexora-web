import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatbotController } from './internal/chatbot.controller';
import { ChatbotService } from './internal/chatbot.service';
import { OllamaClient } from './internal/ollama.client';
import { ConversationSchema } from './internal/schemas/conversation.schema';
import { CHATBOT_PUBLIC_API } from './public-api';
import { ChatbotPublicApiImpl } from './public-api/chatbot-public-api.impl';
import { CHATBOT_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'Conversation', schema: ConversationSchema }],
      CHATBOT_DB,
    ),
  ],
  controllers: [ChatbotController],
  providers: [
    ChatbotService,
    OllamaClient,
    { provide: CHATBOT_PUBLIC_API, useClass: ChatbotPublicApiImpl },
  ],
  exports: [CHATBOT_PUBLIC_API, ChatbotService, OllamaClient],
})
export class ChatbotModule {}
