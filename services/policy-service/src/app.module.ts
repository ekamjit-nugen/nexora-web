import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PolicyModule } from './policy/policy.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://root:nexora_dev_password@mongodb:27017/nexora_policies?authSource=admin',
        retryAttempts: 5,
        retryDelay: 5000,
      }),
    }),
    PolicyModule,
    HealthModule,
  ],
})
export class AppModule {}
