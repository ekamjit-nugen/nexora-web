import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';
import { ChannelCategorySchema } from './schemas/channel-category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchema },
      { name: 'ChannelCategory', schema: ChannelCategorySchema },
    ], "nexora_chat"),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
  exports: [ChannelsService],
})
export class ChannelsModule {}
