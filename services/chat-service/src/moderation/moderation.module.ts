import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ModerationController } from './moderation.controller';
import { ModerationService } from './moderation.service';
import { FlaggedMessageSchema } from './schemas/flagged-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'FlaggedMessage', schema: FlaggedMessageSchema },
    ]),
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
