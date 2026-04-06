import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UploadModule } from './upload/upload.module';
import { ProcessingModule } from './processing/processing.module';
import { DeliveryModule } from './delivery/delivery.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nexora_media',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    UploadModule,
    ProcessingModule,
    DeliveryModule,
    HealthModule,
  ],
})
export class AppModule {}
