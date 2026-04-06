import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

export interface FcmPayload {
  title: string;
  body: string;
  type: string;
  conversationId?: string;
  messageId?: string;
  clickUrl?: string;
  priority?: string;
  sound?: boolean;
}

/**
 * Firebase Cloud Messaging Service.
 * Sends push notifications to Android devices and web browsers via FCM.
 *
 * Requires: firebase-admin SDK + FCM credentials in env vars.
 * Falls back to logging if firebase-admin is not installed.
 */
@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private admin: any = null;
  private initialized = false;

  async onModuleInit() {
    const projectId = process.env.FCM_PROJECT_ID;
    const clientEmail = process.env.FCM_CLIENT_EMAIL;
    const privateKey = process.env.FCM_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('FCM credentials not configured — push notifications disabled');
      return;
    }

    try {
      // B-007: Use standard require() instead of Function() constructor
      // which fails under strict Content Security Policy
      this.admin = require('firebase-admin');

      // B-008: Guard against duplicate initializeApp() calls (e.g. HMR, tests)
      if (!this.admin.apps || this.admin.apps.length === 0) {
        this.admin.initializeApp({
          credential: this.admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
      }
      this.initialized = true;
      this.logger.log('FCM initialized successfully');
    } catch (err) {
      this.logger.warn(`FCM initialization failed: ${err.message}`);
    }
  }

  async sendPush(token: string, payload: FcmPayload): Promise<boolean> {
    if (!this.initialized || !this.admin) {
      this.logger.debug(`FCM stub: would send "${payload.title}" to token ${token.slice(0, 20)}...`);
      return false;
    }

    try {
      await this.admin.messaging().send({
        token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          type: payload.type || 'message',
          conversationId: payload.conversationId || '',
          messageId: payload.messageId || '',
          clickAction: payload.clickUrl || '',
        },
        android: {
          priority: payload.priority === 'critical' ? 'high' : 'normal',
          notification: {
            sound: payload.sound !== false ? 'default' : undefined,
            channelId: ['incoming_call', 'missed_call', 'voicemail', 'call'].includes(payload.type) ? 'calls' : 'messages',
          },
        },
        webpush: {
          notification: {
            icon: '/icon-192.png',
            badge: '/badge-72.png',
            requireInteraction: payload.priority === 'critical' || payload.type === 'incoming_call',
          },
        },
      });
      return true;
    } catch (error: any) {
      if (error.code === 'messaging/registration-token-not-registered') {
        this.logger.debug(`Stale FCM token: ${token.slice(0, 20)}...`);
        return false; // Caller should remove this token
      }
      this.logger.warn(`FCM send failed: ${error.message}`);
      return false;
    }
  }

  isAvailable(): boolean {
    return this.initialized;
  }
}
