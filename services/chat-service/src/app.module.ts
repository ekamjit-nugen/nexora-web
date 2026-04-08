import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Infrastructure
import { QueueModule } from './common/queue/queue.module';
import { CacheModule } from './common/cache/cache.module';
import { EventsModule } from './common/events/events.module';

// Domain modules
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { ThreadsModule } from './threads/threads.module';
import { ChannelsModule } from './channels/channels.module';
import { MentionsModule } from './mentions/mentions.module';
import { PresenceModule } from './presence/presence.module';
import { SettingsModule } from './settings/settings.module';
import { ModerationModule } from './moderation/moderation.module';
import { SearchModule } from './search/search.module';
import { PinsModule } from './pins/pins.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';
import { PollsModule } from './polls/polls.module';
import { ComplianceModule } from './compliance/compliance.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { CommandsModule } from './commands/commands.module';
import { ScheduledMessagesModule } from './scheduled/scheduled-messages.module';
import { SyncModule } from './sync/sync.module';
import { VoiceMessagesModule } from './voice-messages/voice-messages.module';
import { AiSummaryModule } from './ai-summary/ai-summary.module';
import { RemindersModule } from './reminders/reminders.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { MetricsModule } from './common/metrics/metrics.module';

// Legacy — ChatModule provides REST endpoints (gateway consolidated into MessagesModule)
import { ChatModule } from './chat/chat.module';

// Health
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_chat',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start chat-service without a JWT secret.');
        }
        return { secret };
      },
    }),

    // Infrastructure
    QueueModule,
    CacheModule,
    EventsModule,

    // Legacy module (existing routes still work)
    ChatModule,

    // New domain modules (Phase 1 enhancements)
    ConversationsModule,
    MessagesModule,
    ThreadsModule,
    ChannelsModule,
    MentionsModule,
    PresenceModule,
    SettingsModule,
    ModerationModule,

    // Phase 4: Search & Productivity
    SearchModule,
    PinsModule,
    BookmarksModule,
    PollsModule,

    // Phase 6: Compliance & Governance
    ComplianceModule,

    // Phase 7: Integrations
    WebhooksModule,
    CommandsModule,
    ScheduledMessagesModule,

    // Phase 8: Mobile & Offline
    SyncModule,

    // Phase 9: Advanced Features
    VoiceMessagesModule,
    AiSummaryModule,
    RemindersModule,

    // E3: Differentiating features
    AnalyticsModule,
    MetricsModule,

    // Health
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
