import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ChatSettingsSchema } from './schemas/chat-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ChatSettings', schema: ChatSettingsSchema },
    ], "nexora_chat"),
  ],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
