import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IChatSettings } from './schemas/chat-settings.schema';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectModel('ChatSettings', 'nexora_chat') private chatSettingsModel: Model<IChatSettings>,
  ) {}

  async getSettings(userId: string) {
    let settings = await this.chatSettingsModel.findOne({ userId });
    if (!settings) {
      settings = new this.chatSettingsModel({ userId });
      await settings.save();
    }
    return settings;
  }

  async updateSettings(userId: string, dto: any) {
    let settings = await this.chatSettingsModel.findOne({ userId });
    if (!settings) {
      settings = new this.chatSettingsModel({ userId, ...dto });
    } else {
      if (dto.readReceipts) Object.assign(settings.readReceipts, dto.readReceipts);
      if (dto.appearance) Object.assign(settings.appearance, dto.appearance);
      if (dto.notifications) Object.assign(settings.notifications, dto.notifications);
    }
    await settings.save();
    return settings;
  }

  async adminOverrideSettings(targetUserId: string, dto: any, _adminUserId: string) {
    return this.updateSettings(targetUserId, dto);
  }
}
