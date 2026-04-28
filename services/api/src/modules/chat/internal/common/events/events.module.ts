import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingChatListener } from './meeting-chat.listener';
import { FileDeletedListener } from './file-deleted.listener';
import { InviteAcceptedListener } from './invite-accepted.listener';
import { ConversationsModule } from '../../conversations/conversations.module';
import { MessageSchema } from '../../messages/schemas/message.schema';

@Module({
  imports: [
    ConversationsModule,
    MongooseModule.forFeature([
      { name: 'Message', schema: MessageSchema },
    ], "nexora_chat"),
  ],
  providers: [MeetingChatListener, FileDeletedListener, InviteAcceptedListener],
  exports: [MeetingChatListener, FileDeletedListener, InviteAcceptedListener],
})
export class EventsModule {}
