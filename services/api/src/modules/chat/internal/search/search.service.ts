import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';
import { ISearchProvider } from './search-provider.interface';

export interface SearchFilters {
  q: string;
  from?: string;
  in?: string;
  has?: string;         // 'file' | 'image' | 'link' | 'code' | 'poll'
  before?: string;      // ISO date
  after?: string;       // ISO date
  type?: string;        // message type
}

export interface SearchResult {
  message: IMessage;
  conversationName?: string;
  conversationType?: string;
  highlights?: string[];
  score?: number;
}

@Injectable()
export class SearchService implements ISearchProvider {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
  ) {}

  /**
   * ISearchProvider implementation — delegates to globalSearch.
   */
  async search(
    query: SearchFilters,
    userId: string,
    orgId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ results: SearchResult[]; total: number }> {
    return this.globalSearch(userId, query, page, limit);
  }

  /**
   * Global search across all conversations the user has access to.
   */
  async globalSearch(userId: string, filters: SearchFilters, page: number = 1, limit: number = 20): Promise<{ results: SearchResult[]; total: number }> {
    // Get user's conversations
    const userConvos = await this.conversationModel.find({
      'participants.userId': userId,
      isDeleted: false,
    }).select('_id name type').lean();

    const conversationIds = userConvos.map(c => c._id.toString());

    if (conversationIds.length === 0) {
      return { results: [], total: 0 };
    }

    // Build query
    // M-014: Validate that filters.in is a conversation the user belongs to
    if (filters.in && !conversationIds.includes(filters.in)) {
      return { results: [], total: 0 };
    }
    const query: any = {
      conversationId: filters.in ? filters.in : { $in: conversationIds },
      isDeleted: false,
    };

    // Text search — use MongoDB text index for queries with 2+ characters,
    // fall back to $regex for single-character queries (text indexes need 2+ chars)
    let useTextSearch = false;
    if (filters.q) {
      if (filters.q.length >= 2) {
        query.$text = { $search: filters.q };
        useTextSearch = true;
      } else {
        const escaped = filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { content: { $regex: escaped, $options: 'i' } },
          { contentPlainText: { $regex: escaped, $options: 'i' } },
        ];
      }
    }

    // From filter
    if (filters.from) {
      query.senderId = filters.from;
    }

    // Has filter
    if (filters.has) {
      switch (filters.has) {
        case 'file':
          query.type = { $in: ['file', 'image', 'video', 'audio'] };
          break;
        case 'image':
          query.type = 'image';
          break;
        case 'link':
          query['linkPreviews.0'] = { $exists: true };
          break;
        case 'code':
          query.type = 'code';
          break;
        case 'poll':
          query.type = 'poll';
          break;
      }
    }

    // Date filters
    if (filters.before) {
      query.createdAt = { ...query.createdAt, $lt: new Date(filters.before) };
    }
    if (filters.after) {
      query.createdAt = { ...query.createdAt, $gt: new Date(filters.after) };
    }

    // Type filter
    if (filters.type) {
      query.type = filters.type;
    }

    const skip = (page - 1) * limit;
    const sortOrder = useTextSearch
      ? { score: { $meta: 'textScore' as const } }
      : { createdAt: -1 as const };
    const [messages, total] = await Promise.all([
      this.messageModel.find(query).sort(sortOrder).skip(skip).limit(limit).lean(),
      this.messageModel.countDocuments(query),
    ]);

    // Build conversation lookup
    const convoMap = new Map<string, any>();
    for (const c of userConvos) {
      convoMap.set(c._id.toString(), c);
    }

    // Build results with highlights
    const results: SearchResult[] = messages.map(msg => {
      const convo = convoMap.get(msg.conversationId?.toString());
      const highlights: string[] = [];

      if (filters.q && msg.content) {
        const regex = new RegExp(`(.{0,40})(${filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(.{0,40})`, 'gi');
        const match = regex.exec(msg.content);
        if (match) {
          highlights.push(`...${match[1]}**${match[2]}**${match[3]}...`);
        }
      }

      return {
        message: msg as any,
        conversationName: convo?.name || null,
        conversationType: convo?.type || null,
        highlights,
        score: useTextSearch ? (msg as any)._score : undefined,
      };
    });

    return { results, total };
  }
}
