import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PushModule } from './push/push.module';
import { PreferencesModule } from './preferences/preferences.module';
import { DeliveryModule } from './delivery/delivery.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_notifications',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    PushModule,
    PreferencesModule,
    DeliveryModule,
    HealthModule,
  ],
})
export class AppModule {}
