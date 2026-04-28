import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { INotificationPreferences } from './schemas/notification-preferences.schema';
import { IDeviceToken } from './schemas/device-token.schema';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @InjectModel('NotificationPreferences', 'nexora_notifications') private prefsModel: Model<INotificationPreferences>,
    @InjectModel('DeviceToken', 'nexora_notifications') private deviceTokenModel: Model<IDeviceToken>,
  ) {}

  async getPreferences(userId: string, organizationId: string) {
    let prefs = await this.prefsModel.findOne({ userId, organizationId });
    if (!prefs) {
      prefs = new this.prefsModel({ userId, organizationId });
      await prefs.save();
    }
    return prefs;
  }

  async updatePreferences(userId: string, organizationId: string, data: any) {
    return this.prefsModel.findOneAndUpdate(
      { userId, organizationId },
      { $set: data },
      { upsert: true, new: true },
    );
  }

  async setConversationOverride(userId: string, organizationId: string, conversationId: string, settings: { notify?: string; sound?: boolean; mutedUntil?: Date }) {
    const prefs = await this.getPreferences(userId, organizationId);
    const idx = prefs.overrides.findIndex(o => o.conversationId === conversationId);
    if (idx >= 0) {
      Object.assign(prefs.overrides[idx], settings);
    } else {
      prefs.overrides.push({ conversationId, notify: 'all', sound: true, ...settings } as any);
    }
    await prefs.save();
    return prefs;
  }

  async registerDevice(userId: string, platform: string, token: string, deviceId: string, appVersion?: string) {
    return this.deviceTokenModel.findOneAndUpdate(
      { token },
      { userId, platform, token, deviceId, appVersion, lastUsedAt: new Date(), failCount: 0 },
      { upsert: true, new: true },
    );
  }

  async unregisterDevice(token: string): Promise<{ deletedCount?: number }> {
    return this.deviceTokenModel.deleteOne({ token });
  }

  async getDeviceTokens(userId: string) {
    return this.deviceTokenModel.find({ userId, failCount: { $lt: 3 } });
  }
}
