import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Infrastructure (cache, queue, events) — chat-service had these as
// per-service modules; in the monolith they continue to live in the
// chat module's scope.
import { QueueModule } from './internal/common/queue/queue.module';
import { CacheModule } from './internal/common/cache/cache.module';
import { EventsModule } from './internal/common/events/events.module';

// Domain modules (preserved as-is from chat-service)
import { ChatModule as InternalChatModule } from './internal/chat/chat.module';
import { ConversationsModule } from './internal/conversations/conversations.module';
import { MessagesModule } from './internal/messages/messages.module';
import { ThreadsModule } from './internal/threads/threads.module';
import { ChannelsModule } from './internal/channels/channels.module';
import { MentionsModule } from './internal/mentions/mentions.module';
import { PresenceModule } from './internal/presence/presence.module';
import { SettingsModule } from './internal/settings/settings.module';
import { ModerationModule } from './internal/moderation/moderation.module';
import { SearchModule } from './internal/search/search.module';
import { PinsModule } from './internal/pins/pins.module';
import { BookmarksModule } from './internal/bookmarks/bookmarks.module';
import { PollsModule } from './internal/polls/polls.module';
import { ComplianceModule } from './internal/compliance/compliance.module';
import { WebhooksModule } from './internal/webhooks/webhooks.module';
import { CommandsModule } from './internal/commands/commands.module';
import { ScheduledMessagesModule } from './internal/scheduled/scheduled-messages.module';
import { SyncModule } from './internal/sync/sync.module';
import { VoiceMessagesModule } from './internal/voice-messages/voice-messages.module';
import { AiSummaryModule } from './internal/ai-summary/ai-summary.module';
import { RemindersModule } from './internal/reminders/reminders.module';
import { AnalyticsModule } from './internal/analytics/analytics.module';
import { MetricsModule } from './internal/common/metrics/metrics.module';
import { CustomEmojiModule } from './internal/custom-emoji/custom-emoji.module';
import { ClipsModule } from './internal/clips/clips.module';
import { HealthController } from './internal/health/health.controller';

import { ConversationSchema } from './internal/conversations/schemas/conversation.schema';
import { CHAT_PUBLIC_API } from './public-api';
import { ChatPublicApiImpl } from './public-api/chat-public-api.impl';
import { CHAT_DB } from '../../bootstrap/database/database.tokens';

/**
 * ChatModule wrapper.
 *
 * The legacy chat-service has 30+ feature modules — Conversations,
 * Messages, Threads, Channels, Mentions, Presence, etc. We import
 * them all wholesale from internal/. Each had its forFeature calls
 * bulk-patched to the CHAT_DB named connection so reads/writes hit
 * the same nexora_chat DB the legacy service uses.
 *
 * Note: chat is the monolith's first heavy WebSocket consumer
 * (PresenceModule + MessagesModule both use Socket.IO gateways).
 * The single-process monolith handles WS natively — no extra setup
 * needed compared to the legacy split.
 */
@Module({
  imports: [
    QueueModule,
    CacheModule,
    EventsModule,
    InternalChatModule,
    ConversationsModule,
    MessagesModule,
    ThreadsModule,
    ChannelsModule,
    MentionsModule,
    PresenceModule,
    SettingsModule,
    ModerationModule,
    SearchModule,
    PinsModule,
    BookmarksModule,
    PollsModule,
    ComplianceModule,
    WebhooksModule,
    CommandsModule,
    ScheduledMessagesModule,
    SyncModule,
    VoiceMessagesModule,
    AiSummaryModule,
    RemindersModule,
    AnalyticsModule,
    MetricsModule,
    CustomEmojiModule,
    ClipsModule,
    // Schema reg for the public-API impl (wrapper-scoped).
    MongooseModule.forFeature(
      [{ name: 'Conversation', schema: ConversationSchema }],
      CHAT_DB,
    ),
  ],
  controllers: [HealthController],
  providers: [
    { provide: CHAT_PUBLIC_API, useClass: ChatPublicApiImpl },
  ],
  exports: [CHAT_PUBLIC_API],
})
export class ChatModule {}
