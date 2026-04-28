import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

export interface SyncDelta {
  conversations: any[];
  messages: any[];
  presenceChanges: any[];
  timestamp: string;
  nextCursor: string | null;
}

/**
 * Sync-on-reconnect service.
 * Returns all changes since a given timestamp for offline/reconnect scenarios.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
  ) {}

  async getSyncDelta(userId: string, since: Date, cursor?: string, batchSize: number = 200): Promise<SyncDelta> {
    // Get conversations updated since timestamp
    const conversations = await this.conversationModel.find({
      'participants.userId': userId,
      isDeleted: false,
      updatedAt: { $gt: since },
    }).lean();

    const conversationIds = conversations.map(c => c._id.toString());

    // Get all user's conversation IDs (for message fetch)
    const allConvos = await this.conversationModel.find({
      'participants.userId': userId,
      isDeleted: false,
    }).select('_id').lean();
    const allConvoIds = allConvos.map(c => c._id.toString());

    // Build message query with cursor-based pagination
    const messageQuery: any = {
      conversationId: { $in: allConvoIds },
      createdAt: { $gt: since },
    };

    // If cursor is provided, paginate from after that _id
    if (cursor) {
      messageQuery._id = { $gt: cursor };
    }

    // Get new messages using cursor-based pagination (ascending _id order)
    const messages = await this.messageModel.find(messageQuery)
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean();

    // Calculate nextCursor: if we got a full batch, there may be more
    const nextCursor = messages.length === batchSize
      ? messages[messages.length - 1]._id.toString()
      : null;

    return {
      conversations,
      messages,
      presenceChanges: [], // Populated by presence module via Redis
      timestamp: new Date().toISOString(),
      nextCursor,
    };
  }
}
