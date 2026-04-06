import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IConversation } from '../conversations/schemas/conversation.schema';
import { IChannelCategory } from './schemas/channel-category.schema';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);

  constructor(
    @InjectModel('Conversation') private conversationModel: Model<IConversation>,
    @InjectModel('ChannelCategory') private categoryModel: Model<IChannelCategory>,
  ) {}

  async browsePublicChannels(organizationId: string, userId: string) {
    return this.conversationModel.find({
      organizationId,
      type: 'channel',
      channelType: { $in: ['public', 'announcement'] },
      isDeleted: false,
    }).sort({ name: 1 }).lean();
  }

  async joinChannel(channelId: string, userId: string) {
    const channel = await this.conversationModel.findOne({
      _id: channelId, type: 'channel', channelType: 'public', isDeleted: false,
    });
    if (!channel) throw new NotFoundException('Public channel not found');

    const isAlready = channel.participants.some(p => p.userId === userId);
    if (isAlready) return channel;

    return this.conversationModel.findByIdAndUpdate(channelId, {
      $push: { participants: { userId, role: 'member', joinedAt: new Date(), lastReadAt: new Date(), muted: false } },
    }, { new: true });
  }

  // ── Channel Categories ──

  async listCategories(organizationId: string) {
    return this.categoryModel.find({ organizationId }).sort({ order: 1 }).lean();
  }

  async createCategory(organizationId: string, name: string, createdBy: string) {
    const maxOrder = await this.categoryModel.findOne({ organizationId }).sort({ order: -1 });
    const order = maxOrder ? maxOrder.order + 1 : 0;

    const category = new this.categoryModel({ organizationId, name, order, createdBy });
    await category.save();
    return category;
  }

  async updateCategory(categoryId: string, name: string) {
    const category = await this.categoryModel.findByIdAndUpdate(categoryId, { name }, { new: true });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async deleteCategory(categoryId: string) {
    const category = await this.categoryModel.findByIdAndDelete(categoryId);
    if (!category) throw new NotFoundException('Category not found');
    // Unlink channels from this category
    await this.conversationModel.updateMany({ categoryId }, { $set: { categoryId: null } });
    return { deleted: true };
  }

  async reorderCategories(organizationId: string, orderedIds: string[]) {
    const updates = orderedIds.map((id, index) =>
      this.categoryModel.findByIdAndUpdate(id, { order: index }),
    );
    await Promise.all(updates);
    return this.listCategories(organizationId);
  }
}
