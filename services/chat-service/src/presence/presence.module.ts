import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';
import { UserPresenceSchema } from './schemas/user-presence.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'UserPresence', schema: UserPresenceSchema },
    ]),
  ],
  controllers: [PresenceController],
  providers: [PresenceService],
  exports: [PresenceService],
})
export class PresenceModule {}
