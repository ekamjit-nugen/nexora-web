import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiSummaryController } from './ai-summary.controller';
import { AiSummaryService } from './ai-summary.service';
import { SmartRepliesService } from './smart-replies.service';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ], "nexora_chat"),
  ],
  controllers: [AiSummaryController],
  providers: [AiSummaryService, SmartRepliesService],
  exports: [AiSummaryService, SmartRepliesService],
})
export class AiSummaryModule {}
