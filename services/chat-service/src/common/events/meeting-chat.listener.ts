import { Injectable, Logger, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { ConversationsService } from '../../conversations/conversations.service';

/**
 * Listens for `meeting:created` events from calling-service via Redis pub/sub.
 * Auto-creates a meeting_chat conversation in the chat database.
 */
@Injectable()
export class MeetingChatListener implements OnModuleInit {
  private readonly logger = new Logger(MeetingChatListener.name);

  constructor(
    @Optional() @Inject('REDIS_CLIENT') private readonly redis: any,
    private readonly conversationsService: ConversationsService,
  ) {}

  async onModuleInit() {
    if (!this.redis) {
      this.logger.warn('Redis not available — meeting chat listener disabled');
      return;
    }

    try {
      // Create a separate subscriber connection (Redis requires it)
      const subscriber = this.redis.duplicate();
      await subscriber.subscribe('meeting:created');

      subscriber.on('message', async (channel: string, message: string) => {
        if (channel !== 'meeting:created') return;

        try {
          const data = JSON.parse(message);
          await this.handleMeetingCreated(data);
        } catch (err) {
          this.logger.error(`Failed to process meeting:created event: ${err.message}`);
        }
      });

      this.logger.log('Meeting chat listener subscribed to meeting:created');
    } catch (err) {
      this.logger.warn(`Meeting chat listener failed to start: ${err.message}`);
    }
  }

  private async handleMeetingCreated(data: {
    meetingId: string;
    title: string;
    hostId: string;
    participantIds: string[];
    organizationId: string;
  }) {
    try {
      const conversation = await this.conversationsService.createGroup(
        `Chat: ${data.title}`,
        `Meeting chat for: ${data.title}`,
        data.participantIds,
        data.hostId,
      );

      // Notify calling-service of the chatConversationId
      if (this.redis) {
        await this.redis.publish('meeting:chat-created', JSON.stringify({
          meetingId: data.meetingId,
          chatConversationId: conversation._id.toString(),
        }));
      }

      this.logger.log(`Meeting chat created for meeting ${data.meetingId}: conversation ${conversation._id}`);
    } catch (err) {
      this.logger.error(`Failed to create meeting chat: ${err.message}`);
    }
  }
}
