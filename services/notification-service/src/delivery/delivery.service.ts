import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PushService, NotificationPayload } from '../push/push.service';

/**
 * Delivery service - routes notifications to the correct channel.
 * Subscribes to Redis pub/sub for notification events from other services.
 */
@Injectable()
export class DeliveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryService.name);
  private redisSubscriber: Awaited<ReturnType<typeof import('redis')['createClient']>> | null = null;

  constructor(private pushService: PushService) {}

  async onModuleInit() {
    await this.subscribeToEvents();
  }

  async onModuleDestroy() {
    if (this.redisSubscriber) {
      try {
        await this.redisSubscriber.quit();
        this.logger.log('Redis subscriber disconnected');
      } catch (err) {
        this.logger.warn(`Error disconnecting Redis subscriber: ${err.message}`);
      }
    }
  }

  /**
   * Check whether the Redis subscriber connection is alive.
   */
  isSubscriberConnected(): boolean {
    return this.redisSubscriber?.isOpen ?? false;
  }

  private async subscribeToEvents() {
    const redisUrl = process.env.REDIS_URI || 'redis://redis:6379';
    try {
      const { createClient } = await import('redis');
      const subscriber = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries: number) => {
            const delay = Math.min(retries * 500, 10_000);
            this.logger.warn(`Redis subscriber reconnecting (attempt ${retries}), next retry in ${delay}ms`);
            return delay;
          },
        },
      });

      subscriber.on('error', (err) => {
        this.logger.error(`Redis subscriber error: ${err.message}`, err.stack);
      });

      subscriber.on('reconnecting', () => {
        this.logger.warn('Redis subscriber is reconnecting...');
      });

      await subscriber.connect();
      this.redisSubscriber = subscriber;

      await subscriber.subscribe('notifications', (message) => {
        try {
          const payload = JSON.parse(message) as NotificationPayload;
          this.deliver(payload).catch(err =>
            this.logger.error(`Notification delivery failed: ${err.message}`, err.stack)
          );
        } catch (err) {
          this.logger.warn(`Failed to parse notification event: ${err.message}`);
        }
      });

      this.logger.log('Subscribed to Redis notification events');
    } catch (err) {
      this.logger.warn(`Redis subscription failed: ${err.message}. Notifications will only work via direct API calls.`);
    }
  }

  async deliver(payload: NotificationPayload): Promise<void> {
    this.logger.debug(`Delivering notification: ${payload.type} to ${payload.userId}`);
    await this.pushService.sendToUser(payload);
  }

  async deliverToMany(userIds: string[], payload: Omit<NotificationPayload, 'userId'>): Promise<void> {
    await this.pushService.sendToUsers(userIds, payload);
  }
}
