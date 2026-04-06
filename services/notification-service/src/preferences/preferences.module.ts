import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PreferencesService } from './preferences.service';
import { NotificationPreferencesSchema } from './schemas/notification-preferences.schema';
import { DeviceTokenSchema } from './schemas/device-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'NotificationPreferences', schema: NotificationPreferencesSchema },
      { name: 'DeviceToken', schema: DeviceTokenSchema },
    ]),
  ],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
