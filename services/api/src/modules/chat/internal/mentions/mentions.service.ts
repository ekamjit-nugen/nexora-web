import { Injectable, Logger } from '@nestjs/common';
import { IMention } from '../messages/schemas/message.schema';

@Injectable()
export class MentionsService {
  private readonly logger = new Logger(MentionsService.name);

  /**
   * Parse @mentions from message content.
   * Supports: @userId, @here, @all, @channel
   */
  parseMentions(content: string): IMention[] {
    if (!content) return [];

    const mentions: IMention[] = [];
    // Match @<type>:<id> or @here/@all patterns
    const mentionRegex = /@(here|all|channel|[a-f0-9]{24})/gi;
    let match: RegExpExecArray | null;

    while ((match = mentionRegex.exec(content)) !== null) {
      const value = match[1];
      let type: string;
      let targetId: string;

      if (value === 'here') {
        type = 'here';
        targetId = 'here';
      } else if (value === 'all') {
        type = 'all';
        targetId = 'all';
      } else if (value === 'channel') {
        type = 'channel';
        targetId = 'channel';
      } else {
        type = 'user';
        targetId = value;
      }

      mentions.push({
        type,
        targetId,
        displayName: match[0],
        offset: match.index,
        length: match[0].length,
      });
    }

    return mentions;
  }

  /**
   * Determine which users should be notified based on mentions.
   * Returns array of userIds to notify.
   */
  getMentionedUserIds(
    mentions: IMention[],
    participants: Array<{ userId: string; notifyPreference?: string }>,
    onlineUserIds: string[] = [],
  ): string[] {
    const notifyIds = new Set<string>();

    for (const mention of mentions) {
      switch (mention.type) {
        case 'user':
          notifyIds.add(mention.targetId);
          break;
        case 'here':
          // Notify ALL participants; the client/notification-service will check
          // actual online status. This ensures users on other pods are not missed.
          for (const p of participants) {
            if (p.notifyPreference !== 'nothing') {
              notifyIds.add(p.userId);
            }
          }
          break;
        case 'all':
        case 'channel':
          // Notify all participants (respecting their preferences)
          for (const p of participants) {
            if (p.notifyPreference !== 'nothing') {
              notifyIds.add(p.userId);
            }
          }
          break;
      }
    }

    return Array.from(notifyIds);
  }
}
