import { Injectable, Logger, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IBookmark } from './schemas/bookmark.schema';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(
    @InjectModel('Bookmark', 'nexora_chat') private bookmarkModel: Model<IBookmark>,
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
  ) {}

  async saveBookmark(userId: string, messageId: string, organizationId?: string, label?: string, note?: string): Promise<IBookmark> {
    const message = await this.messageModel.findOne({ _id: messageId, isDeleted: false });
    if (!message) throw new NotFoundException('Message not found');

    // L-006: Verify user is a participant of the conversation before allowing bookmark
    const conversation = await this.conversationModel.findOne({
      _id: message.conversationId, 'participants.userId': userId, isDeleted: false,
    });
    if (!conversation) throw new ForbiddenException('Not a participant of this conversation');

    const existing = await this.bookmarkModel.findOne({ userId, messageId });
    if (existing) throw new ConflictException('Message already bookmarked');

    const bookmark = new this.bookmarkModel({
      userId,
      organizationId: organizationId || null,
      messageId,
      conversationId: message.conversationId,
      label: label || null,
      note: note || null,
    });
    await bookmark.save();
    this.logger.log(`Bookmark created: ${messageId} by ${userId}`);
    return bookmark;
  }

  async removeBookmark(bookmarkId: string, userId: string): Promise<void> {
    const bookmark = await this.bookmarkModel.findOne({ _id: bookmarkId, userId });
    if (!bookmark) throw new NotFoundException('Bookmark not found');
    await this.bookmarkModel.deleteOne({ _id: bookmarkId });
    this.logger.log(`Bookmark removed: ${bookmarkId} by ${userId}`);
  }

  async getBookmarks(userId: string, organizationId?: string): Promise<any[]> {
    const query: any = { userId };
    if (organizationId) query.organizationId = organizationId;

    const bookmarks = await this.bookmarkModel.find(query).sort({ createdAt: -1 }).lean();

    // Populate message content
    const messageIds = bookmarks.map(b => b.messageId);
    const messages = await this.messageModel.find({ _id: { $in: messageIds } }).lean();
    const messageMap = new Map(messages.map(m => [m._id.toString(), m]));

    return bookmarks.map(b => ({
      ...b,
      message: messageMap.get(b.messageId) || null,
    }));
  }

  async updateBookmark(bookmarkId: string, userId: string, label?: string, note?: string): Promise<IBookmark> {
    const bookmark = await this.bookmarkModel.findOne({ _id: bookmarkId, userId });
    if (!bookmark) throw new NotFoundException('Bookmark not found');

    if (label !== undefined) bookmark.label = label;
    if (note !== undefined) bookmark.note = note;
    await bookmark.save();
    return bookmark;
  }
}
