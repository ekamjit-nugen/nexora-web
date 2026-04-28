import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatPublicApi, ConversationSummary } from './chat-public-api';
import { CHAT_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class ChatPublicApiImpl implements ChatPublicApi {
  constructor(
    @InjectModel('Conversation', CHAT_DB) private readonly conversationModel: Model<any>,
  ) {}

  async getConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<ConversationSummary | null> {
    const c: any = await this.conversationModel.findOne({
      _id: conversationId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    if (!c) return null;
    return {
      _id: String(c._id),
      organizationId: String(c.organizationId),
      type: c.type || 'direct',
      participantIds: (c.participantIds || []).map(String),
      lastMessageAt: c.lastMessageAt || null,
    };
  }

  async countUnreadForUser(_organizationId: string, _userId: string): Promise<number> {
    // Scaffold — the legacy service computes unread by joining
    // messages + read-receipts; replicate when actually needed by a
    // consumer. Returning 0 is a safe default.
    return 0;
  }
}
