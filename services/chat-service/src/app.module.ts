import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatModule } from './chat/chat.module';
import { CustomEmojiModule } from './custom-emoji/custom-emoji.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_chat',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    ChatModule,
    CustomEmojiModule,
    HealthModule,
  ],
})
export class AppModule {}
