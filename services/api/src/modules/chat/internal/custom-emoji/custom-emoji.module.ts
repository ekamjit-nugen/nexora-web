import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CustomEmojiController } from './custom-emoji.controller';
import { CustomEmojiService } from './custom-emoji.service';
import { CustomEmojiSchema } from './custom-emoji.schema';
import { JwtAuthGuard } from '../chat/guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'CustomEmoji', schema: CustomEmojiSchema },
    ], "nexora_chat"),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [CustomEmojiController],
  providers: [CustomEmojiService, JwtAuthGuard],
  exports: [CustomEmojiService],
})
export class CustomEmojiModule {}
