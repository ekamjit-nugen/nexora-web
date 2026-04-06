import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';

/**
 * Meeting Chat Service — creates persistent chat for meetings.
 * Uses Redis pub/sub event-driven pattern instead of direct HTTP calls.
 * Chat-service subscribes to 'meeting:created' and creates the conversation.
 */
@Injectable()
export class MeetingChatService {
  private readonly logger = new Logger(MeetingChatService.name);
  private redisClient: any = null;

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {
    this.initRedis();
  }

  private async initRedis() {
    try {
      const IORedis = (await (Function('return import("ioredis")')())).default;
      this.redisClient = new IORedis(process.env.REDIS_URI || 'redis://redis:6379');

      // Listen for chat-created response from chat-service
      const subscriber = this.redisClient.duplicate();
      await subscriber.subscribe('meeting:chat-created');
      subscriber.on('message', async (_channel: string, message: string) => {
        try {
          const { meetingId, chatConversationId } = JSON.parse(message);
          await this.meetingModel.findOneAndUpdate(
            { meetingId },
            { $set: { chatConversationId } },
          );
          this.logger.log(`Meeting ${meetingId} linked to chat ${chatConversationId}`);
        } catch (err) {
          this.logger.warn(`Failed to link meeting chat: ${err.message}`);
        }
      });
    } catch {
      this.logger.warn('Redis not available — meeting chat creation will use fallback');
    }
  }

  /**
   * Request meeting chat creation via Redis pub/sub.
   * Chat-service's MeetingChatListener picks this up and creates the conversation.
   */
  async createMeetingChat(meetingId: string, title: string, hostId: string, participantIds: string[], organizationId: string): Promise<void> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) return;
    if (meeting.chatConversationId) return; // Already created

    if (this.redisClient) {
      await this.redisClient.publish('meeting:created', JSON.stringify({
        meetingId,
        title,
        hostId,
        participantIds,
        organizationId,
      }));
      this.logger.log(`Meeting chat creation requested for ${meetingId} via Redis`);
    } else {
      this.logger.warn(`Cannot create meeting chat for ${meetingId} — Redis unavailable`);
    }
  }

  async getMeetingChatId(meetingId: string): Promise<string | null> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    return meeting?.chatConversationId || null;
  }
}
