import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BookmarksController } from './bookmarks.controller';
import { BookmarksService } from './bookmarks.service';
import { BookmarkSchema } from './schemas/bookmark.schema';
import { MessageSchema } from '../messages/schemas/message.schema';
import { ConversationSchema } from '../conversations/schemas/conversation.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Bookmark', schema: BookmarkSchema },
      { name: 'Message', schema: MessageSchema },
      { name: 'Conversation', schema: ConversationSchema },
    ]),
  ],
  controllers: [BookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
