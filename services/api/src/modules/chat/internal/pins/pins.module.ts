import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PinsController } from './pins.controller';
import { PinsService } from './pins.service';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ], "nexora_chat"),
  ],
  controllers: [PinsController],
  providers: [PinsService],
  exports: [PinsService],
})
export class PinsModule {}
