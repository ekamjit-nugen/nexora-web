import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { IWebhook } from './schemas/webhook.schema';
import { IMessage } from '../messages/schemas/message.schema';
import { IConversation } from '../conversations/schemas/conversation.schema';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel('Webhook', 'nexora_chat') private webhookModel: Model<IWebhook>,
    @InjectModel('Message', 'nexora_chat') private messageModel: Model<IMessage>,
    @InjectModel('Conversation', 'nexora_chat') private conversationModel: Model<IConversation>,
  ) {}

  async createIncomingWebhook(organizationId: string, conversationId: string, name: string, createdBy: string, avatarUrl?: string): Promise<IWebhook> {
    const webhookId = uuidv4();
    const secretKey = crypto.randomBytes(32).toString('hex');

    const webhook = new this.webhookModel({
      organizationId,
      conversationId,
      type: 'incoming',
      name,
      avatarUrl,
      webhookUrl: webhookId, // The route will be /hooks/{webhookId}
      secretKey,
      isActive: true,
      createdBy,
    });

    await webhook.save();
    this.logger.log(`Incoming webhook created: ${name} for conversation ${conversationId}`);
    return webhook;
  }

  async createOutgoingWebhook(organizationId: string, conversationId: string, name: string, targetUrl: string, events: string[], createdBy: string): Promise<IWebhook> {
    // SSRF validation — block internal/private network URLs
    this.validateWebhookUrl(targetUrl);
    const secretKey = crypto.randomBytes(32).toString('hex');

    const webhook = new this.webhookModel({
      organizationId,
      conversationId,
      type: 'outgoing',
      name,
      webhookUrl: targetUrl,
      secretKey,
      events,
      isActive: true,
      createdBy,
    });

    await webhook.save();
    this.logger.log(`Outgoing webhook created: ${name} -> ${targetUrl}`);
    return webhook;
  }

  /**
   * Process an incoming webhook POST - creates a message in the target channel.
   */
  async processIncomingWebhook(webhookId: string, payload: { text: string; username?: string; icon_url?: string }): Promise<IMessage> {
    const webhook = await this.webhookModel.findOne({ webhookUrl: webhookId, type: 'incoming', isActive: true });
    if (!webhook) throw new NotFoundException('Webhook not found or inactive');

    // Sanitize webhook message content — strip all HTML tags to prevent stored XSS
    const sanitizedText = payload.text.replace(/<[^>]*>/g, '');

    const message = new this.messageModel({
      conversationId: webhook.conversationId,
      senderId: `webhook:${webhook._id}`,
      senderName: payload.username || webhook.name,
      content: sanitizedText,
      contentPlainText: sanitizedText,
      type: 'text',
      webhookId: webhook._id.toString(),
      readBy: [],
    });
    await message.save();

    // Update conversation lastMessage
    await this.conversationModel.findByIdAndUpdate(webhook.conversationId, {
      lastMessage: {
        _id: message._id.toString(),
        content: sanitizedText.substring(0, 100),
        senderId: `webhook:${webhook._id}`,
        senderName: payload.username || webhook.name,
        type: 'text',
        sentAt: new Date(),
      },
      $inc: { messageCount: 1 },
    });

    webhook.lastUsedAt = new Date();
    await webhook.save();

    this.logger.log(`Incoming webhook message posted: ${webhook.name}`);
    return message;
  }

  /**
   * Fire outgoing webhooks for an event.
   */
  async fireOutgoingWebhooks(organizationId: string, conversationId: string, event: string, data: any): Promise<void> {
    const webhooks = await this.webhookModel.find({
      organizationId,
      conversationId,
      type: 'outgoing',
      isActive: true,
      events: event,
    });

    for (const webhook of webhooks) {
      try {
        const timestamp = Date.now().toString();
        const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
        // Include timestamp in HMAC to prevent replay attacks
        const signPayload = `${timestamp}.${payload}`;
        const signature = crypto.createHmac('sha256', webhook.secretKey).update(signPayload).digest('hex');

        await fetch(webhook.webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Nexora-Signature': signature,
            'X-Nexora-Timestamp': timestamp,
            'X-Nexora-Event': event,
          },
          body: payload,
        });

        webhook.lastUsedAt = new Date();
        await webhook.save();
      } catch (err) {
        this.logger.warn(`Outgoing webhook ${webhook.name} failed: ${err.message}`);
      }
    }
  }

  /**
   * Validate webhook URL to prevent SSRF attacks.
   * Blocks internal/private network addresses.
   */
  private validateWebhookUrl(url: string): void {
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new NotFoundException('Invalid URL'); }

    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      'localhost', '127.0.0.1', '0.0.0.0', '::1',
      '169.254.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
      '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
    ];

    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern)) {
        throw new NotFoundException('Internal/private network URLs are not allowed for webhooks');
      }
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new NotFoundException('Only HTTP/HTTPS URLs are allowed');
    }
  }

  async getWebhooks(organizationId: string) {
    // Exclude secretKey from responses to prevent credential leakage
    return this.webhookModel.find({ organizationId })
      .select('-secretKey')
      .sort({ createdAt: -1 }).lean();
  }

  async verifyIncomingSignature(webhookId: string, payload: string, signature: string): Promise<boolean> {
    const webhook = await this.webhookModel.findOne({ webhookUrl: webhookId, type: 'incoming' });
    if (!webhook) return false;

    const expected = crypto.createHmac('sha256', webhook.secretKey).update(payload).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }

  async deleteWebhook(webhookId: string, organizationId: string) {
    const webhook = await this.webhookModel.findOneAndDelete({ _id: webhookId, organizationId });
    if (!webhook) throw new NotFoundException('Webhook not found');
  }

  async toggleWebhook(webhookId: string, organizationId: string) {
    const webhook = await this.webhookModel.findOne({ _id: webhookId, organizationId });
    if (!webhook) throw new NotFoundException('Webhook not found');
    webhook.isActive = !webhook.isActive;
    await webhook.save();
    return webhook;
  }
}
