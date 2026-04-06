import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

export interface EDiscoveryQuery {
  organizationId: string;
  q?: string;
  from?: string;
  conversationId?: string;
  before?: string;
  after?: string;
  hasAttachments?: boolean;
}

@Injectable()
export class EDiscoveryService {
  private readonly logger = new Logger(EDiscoveryService.name);

  constructor(
    @InjectModel('Message') private messageModel: Model<IMessage>,
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
  ) {}

  /**
   * Admin cross-org search — bypasses per-user access controls.
   * All searches are audit logged.
   */
  async search(query: EDiscoveryQuery, page: number = 1, limit: number = 50): Promise<{ results: IMessage[]; total: number }> {
    const filter: any = {};

    // Org scope: only search within the admin's org
    const orgConvos = await this.conversationModel.find({
      organizationId: query.organizationId,
      isDeleted: false,
    }).select('_id').lean();

    const orgConvoIds = orgConvos.map(c => c._id.toString());
    filter.conversationId = { $in: orgConvoIds };

    // Text search
    if (query.q) {
      filter.$or = [
        { content: { $regex: query.q, $options: 'i' } },
        { contentPlainText: { $regex: query.q, $options: 'i' } },
      ];
    }

    if (query.from) filter.senderId = query.from;
    if (query.conversationId) filter.conversationId = query.conversationId;
    if (query.before) filter.createdAt = { ...filter.createdAt, $lt: new Date(query.before) };
    if (query.after) filter.createdAt = { ...filter.createdAt, $gt: new Date(query.after) };
    if (query.hasAttachments) filter.type = { $in: ['file', 'image', 'video', 'audio'] };

    const skip = (page - 1) * limit;
    const [results, total] = await Promise.all([
      this.messageModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.messageModel.countDocuments(filter),
    ]);

    this.logger.log(`eDiscovery search: org=${query.organizationId}, q="${query.q}", results=${total}`);
    return { results: results as IMessage[], total };
  }

  /**
   * Export search results as JSON.
   */
  async exportResults(query: EDiscoveryQuery): Promise<{ data: any[]; exportedAt: string; count: number }> {
    // Fetch all results (up to 10000)
    const filter: any = {};
    const orgConvos = await this.conversationModel.find({
      organizationId: query.organizationId, isDeleted: false,
    }).select('_id name type').lean();

    const orgConvoIds = orgConvos.map(c => c._id.toString());
    const convoMap = new Map(orgConvos.map(c => [c._id.toString(), c]));
    filter.conversationId = { $in: orgConvoIds };

    if (query.q) filter.$or = [
      { content: { $regex: query.q, $options: 'i' } },
      { contentPlainText: { $regex: query.q, $options: 'i' } },
    ];
    if (query.from) filter.senderId = query.from;
    if (query.conversationId) filter.conversationId = query.conversationId;
    if (query.before) filter.createdAt = { ...filter.createdAt, $lt: new Date(query.before) };
    if (query.after) filter.createdAt = { ...filter.createdAt, $gt: new Date(query.after) };

    const messages = await this.messageModel.find(filter).sort({ createdAt: -1 }).limit(10000).lean();

    const data = messages.map(msg => {
      const convo = convoMap.get(msg.conversationId?.toString());
      return {
        messageId: msg._id,
        conversationId: msg.conversationId,
        conversationName: (convo as any)?.name || null,
        conversationType: (convo as any)?.type || null,
        senderId: msg.senderId,
        senderName: msg.senderName,
        content: msg.content,
        type: msg.type,
        hasAttachments: (msg.attachments?.length || 0) > 0,
        createdAt: msg.createdAt,
        isEdited: msg.isEdited,
        isDeleted: msg.isDeleted,
      };
    });

    this.logger.log(`eDiscovery export: org=${query.organizationId}, count=${data.length}`);
    return { data, exportedAt: new Date().toISOString(), count: data.length };
  }
}
