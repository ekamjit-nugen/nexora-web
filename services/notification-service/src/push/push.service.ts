import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PreferencesService } from '../preferences/preferences.service';
import { FcmService } from './fcm.service';
import { IDeviceToken } from '../preferences/schemas/device-token.schema';

export interface NotificationPayload {
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  userId: string;
  organizationId: string;
  conversationId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  senderId?: string;
  messageType?: string;
  fileName?: string;
}

/**
 * O-001: DEPRECATED / DEAD CODE — the messages gateway now formats previews
 * before publishing to Redis, so this function is no longer called.
 * Retained temporarily for reference; safe to remove.
 *
 * @deprecated Use the formatNotificationPreview in messages.gateway.ts instead.
 */
export function formatMessagePreview(messageType?: string, body?: string, fileName?: string): string {
  switch (messageType) {
    case 'image': return '📷 sent a photo';
    case 'video': return '🎬 sent a video';
    case 'file': return `📎 sent ${fileName || 'a file'}`;
    case 'audio': return '🎤 Voice message';
    case 'poll': return `📊 Poll: ${(body || '').substring(0, 60)}`;
    case 'code': return '💻 shared a code snippet';
    case 'call': return '📞 Missed call';
    case 'meeting': return `📅 Meeting invite`;
    case 'forwarded': return `↩️ Forwarded: ${(body || '').substring(0, 60)}`;
    default: return (body || '').replace(/<[^>]*>/g, '').substring(0, 100); // Strip HTML, truncate
  }
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private webPush: typeof import('web-push') | null = null;
  private webPushConfigured = false;

  constructor(
    private preferencesService: PreferencesService,
    private fcmService: FcmService,
    @InjectModel('DeviceToken') private deviceTokenModel: Model<IDeviceToken>,
  ) {}

  async onModuleInit() {
    // Initialize Web Push with VAPID keys
    const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@nexora.app';

    if (!vapidPublicKey || !vapidPrivateKey) {
      this.logger.warn('VAPID keys not configured — Web Push notifications disabled');
      return;
    }

    try {
      this.webPush = await import('web-push');
      this.webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      this.webPushConfigured = true;
      this.logger.log('Web Push initialized with VAPID keys');
    } catch (err) {
      this.logger.warn(`Web Push initialization failed: ${err.message}`);
    }
  }

  /**
   * Send a push notification to a user across all their devices.
   */
  async sendToUser(payload: NotificationPayload): Promise<void> {
    const { userId, organizationId, conversationId, priority } = payload;

    // Check user preferences
    const prefs = await this.preferencesService.getPreferences(userId, organizationId);

    // Check DND
    // NS-003: Incoming calls always bypass DND (treated as critical priority)
    const effectivePriority = payload.type === 'incoming_call' ? 'critical' : priority;
    if (prefs.dnd?.enabled && effectivePriority !== 'critical') {
      if (!prefs.dnd.allowUrgent || effectivePriority !== 'high') {
        this.logger.debug(`Notification suppressed for ${userId}: DND active`);
        return;
      }
    }

    // Check per-conversation override
    if (conversationId) {
      const override = prefs.overrides?.find(o => o.conversationId === conversationId);
      if (override) {
        if (override.notify === 'nothing') return;
        if (override.mutedUntil && new Date() < override.mutedUntil) return;
      }
    }

    // Get device tokens
    const devices = await this.preferencesService.getDeviceTokens(userId);

    for (const device of devices) {
      try {
        let success = false;
        switch (device.platform) {
          case 'web':
            success = await this.sendWebPush(device.token, payload);
            break;
          case 'android':
            success = await this.sendFCM(device.token, payload);
            break;
          case 'ios':
            success = await this.sendAPNS(device.token, payload);
            break;
        }

        if (!success) {
          await this.handleTokenFailure(device);
        } else {
          // Reset fail count on success
          if (device.failCount > 0) {
            await this.deviceTokenModel.updateOne(
              { _id: device._id },
              { $set: { failCount: 0, lastUsedAt: new Date() } },
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Push delivery failed for device ${device.deviceId}: ${err.message}`);
        await this.handleTokenFailure(device);
      }
    }
  }

  /**
   * Send to multiple users.
   */
  async sendToUsers(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
    await Promise.allSettled(
      userIds.map(userId => this.sendToUser({ ...payload, userId })),
    );
  }

  /**
   * Handle a failed push delivery: increment failCount and remove after 3 failures.
   */
  private async handleTokenFailure(device: IDeviceToken): Promise<void> {
    try {
      const newFailCount = (device.failCount || 0) + 1;
      if (newFailCount >= 3) {
        await this.deviceTokenModel.deleteOne({ _id: device._id });
        this.logger.log(`Removed stale device token ${device.deviceId} after ${newFailCount} failures`);
      } else {
        await this.deviceTokenModel.updateOne(
          { _id: device._id },
          { $set: { failCount: newFailCount } },
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to update device token fail count: ${err.message}`);
    }
  }

  /**
   * Validate that a push subscription endpoint points to a known push service,
   * preventing SSRF attacks via crafted subscription endpoints.
   */
  private isValidPushEndpoint(endpoint: string): boolean {
    try {
      const url = new URL(endpoint);
      const allowed = [
        'fcm.googleapis.com',
        'push.services.mozilla.com',
        'notify.windows.com',
        'push.apple.com',
      ];
      return allowed.some(domain =>
        url.hostname === domain || url.hostname.endsWith('.' + domain),
      );
    } catch {
      return false;
    }
  }

  /**
   * Send Web Push notification using the web-push library.
   * Returns true on success, false on failure.
   */
  private async sendWebPush(subscriptionJson: string, payload: NotificationPayload): Promise<boolean> {
    if (!this.webPushConfigured || !this.webPush) {
      this.logger.debug(`Web Push stub: would send "${payload.title}" (not configured)`);
      return false;
    }

    try {
      // The token for web push is a JSON-encoded PushSubscription object
      const subscription = JSON.parse(subscriptionJson);

      // Validate endpoint to prevent SSRF via crafted subscription
      if (!subscription.endpoint || !this.isValidPushEndpoint(subscription.endpoint)) {
        this.logger.warn(`Blocked push to untrusted endpoint: ${(subscription.endpoint || '').slice(0, 80)}`);
        return false;
      }

      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/badge-72.png',
        tag: payload.conversationId || payload.type,
        data: {
          type: payload.type,
          conversationId: payload.conversationId || '',
          senderId: payload.senderId || '',
          ...payload.data,
        },
        requireInteraction: payload.priority === 'critical' || payload.type === 'incoming_call',
      });

      await this.webPush.sendNotification(subscription, pushPayload, {
        TTL: payload.type === 'incoming_call' ? 30 : 86400, // Short TTL for calls
        urgency: (
          payload.priority === 'critical' ? 'high' :
          payload.priority === 'high' ? 'high' :
          payload.priority === 'low' ? 'very-low' : 'normal'
        ) as any,
      });

      return true;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or no longer valid
        this.logger.debug(`Web Push subscription expired: ${subscriptionJson.slice(0, 40)}...`);
        return false;
      }
      this.logger.warn(`Web Push send failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Send FCM push notification using firebase-admin SDK (via FcmService).
   * Returns true on success, false on failure.
   */
  private async sendFCM(token: string, payload: NotificationPayload): Promise<boolean> {
    return this.fcmService.sendPush(token, {
      title: payload.title,
      body: payload.body,
      type: payload.type,
      conversationId: payload.conversationId,
      messageId: payload.data?.messageId,
      clickUrl: payload.data?.clickUrl,
      priority: payload.priority,
      sound: true,
    });
  }

  /**
   * Send Apple Push Notification.
   * Currently a stub — falls back to FCM for iOS if configured.
   */
  private async sendAPNS(token: string, payload: NotificationPayload): Promise<boolean> {
    // APNs: attempt via FCM for iOS tokens (FCM supports both Android and iOS)
    if (this.fcmService.isAvailable()) {
      return this.sendFCM(token, payload);
    }
    this.logger.debug(`APNs stub: would send "${payload.title}" to token ${token.slice(0, 20)}...`);
    return false;
  }
}
