import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PushService } from './push.service';
import { FcmService } from './fcm.service';
import { PreferencesModule } from '../preferences/preferences.module';
import { DeviceTokenSchema } from '../preferences/schemas/device-token.schema';

@Module({
  imports: [
    PreferencesModule,
    MongooseModule.forFeature([
      { name: 'DeviceToken', schema: DeviceTokenSchema },
    ]),
  ],
  providers: [PushService, FcmService],
  exports: [PushService, FcmService],
})
export class PushModule {}
