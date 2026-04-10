import { Injectable, Logger, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { IWebhookEndpoint } from './schemas/webhook-endpoint.schema';

@Injectable()
export class WebhookEndpointService {
  private readonly logger = new Logger(WebhookEndpointService.name);

  constructor(
    @InjectModel('WebhookEndpoint') private webhookEndpointModel: Model<IWebhookEndpoint>,
  ) {}

  async createEndpoint(dto: { name: string; url: string; events: string[] }, userId: string, orgId: string): Promise<IWebhookEndpoint> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    // Validate URL
    try {
      const u = new URL(dto.url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Invalid protocol');
    } catch {
      throw new BadRequestException('Invalid webhook URL');
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const endpoint = new this.webhookEndpointModel({
      organizationId: orgId,
      name: dto.name,
      url: dto.url,
      events: dto.events || [],
      secret,
      isActive: true,
      createdBy: userId,
    });
    await endpoint.save();
    return endpoint;
  }

  async listEndpoints(orgId: string): Promise<IWebhookEndpoint[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.webhookEndpointModel.find({ organizationId: orgId, isDeleted: false }).sort({ createdAt: -1 });
  }

  async deleteEndpoint(id: string, orgId: string): Promise<void> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    await this.webhookEndpointModel.updateOne({ _id: id, organizationId: orgId }, { $set: { isDeleted: true, isActive: false } });
  }

  /**
   * Deliver an event to all subscribed endpoints.
   * Called from other services when events occur.
   */
  async deliverEvent(event: string, payload: any, orgId: string): Promise<void> {
    const endpoints = await this.webhookEndpointModel.find({
      organizationId: orgId,
      events: event,
      isActive: true,
      isDeleted: false,
    });

    for (const endpoint of endpoints) {
      this.sendWebhook(endpoint, event, payload).catch(err => {
        this.logger.warn(`Webhook delivery failed to ${endpoint.url}: ${err.message}`);
      });
    }
  }

  private async sendWebhook(endpoint: IWebhookEndpoint, event: string, payload: any): Promise<void> {
    const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
    const signature = crypto.createHmac('sha256', endpoint.secret).update(body).digest('hex');

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nexora-Event': event,
          'X-Nexora-Signature': signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      endpoint.lastTriggeredAt = new Date();
      endpoint.lastStatus = res.status;
      if (res.ok) {
        endpoint.successCount = (endpoint.successCount || 0) + 1;
        endpoint.lastError = undefined;
      } else {
        endpoint.failureCount = (endpoint.failureCount || 0) + 1;
        endpoint.lastError = `HTTP ${res.status}`;
      }
      await endpoint.save();
    } catch (err: any) {
      endpoint.lastTriggeredAt = new Date();
      endpoint.failureCount = (endpoint.failureCount || 0) + 1;
      endpoint.lastError = err.message;
      await endpoint.save();
    }
  }
}
