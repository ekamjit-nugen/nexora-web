import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { ConversationsService } from '../../conversations/conversations.service';

/**
 * Listens for `invite:accepted` events from auth-service via Redis pub/sub.
 * When an invited user accepts their org invite and logs in,
 * activates their memberStatus in all conversations they were pre-added to.
 */
@Injectable()
export class InviteAcceptedListener implements OnModuleInit {
  private readonly logger = new Logger(InviteAcceptedListener.name);

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
    private readonly conversationsService: ConversationsService,
  ) {}

  async onModuleInit() {
    if (!this.redis) {
      this.logger.warn('Redis not available — invite accepted listener disabled');
      return;
    }

    try {
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe('invite:accepted');

      subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== 'invite:accepted') return;

        try {
          const data = JSON.parse(message);
          await this.handleInviteAccepted(data);
        } catch (err) {
          this.logger.error(`Failed to process invite:accepted: ${err.message}`);
        }
      });

      this.logger.log('Invite accepted listener subscribed');
    } catch (err) {
      this.logger.warn(`Invite accepted listener failed: ${err.message}`);
    }
  }

  private async handleInviteAccepted(data: { userId: string }) {
    const count = await this.conversationsService.activateInvitedUser(data.userId);
    if (count > 0) {
      this.logger.log(`Activated user ${data.userId} in ${count} conversations after invite acceptance`);
    }
  }
}
