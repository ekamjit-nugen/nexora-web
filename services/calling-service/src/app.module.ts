import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

// Legacy module (existing routes still work)
import { CallingModule } from './calling/calling.module';

// New domain modules (Phase 2 enhancements)
import { CallsModule } from './calls/calls.module';
import { MeetingsModule } from './meetings/meetings.module';
import { SfuModule } from './sfu/sfu.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://root:nexora_dev_password@localhost:27017/nexora_calling?authSource=admin',
        authSource: 'admin',
      }),
    }),

    // Legacy module
    CallingModule,

    // New domain modules
    CallsModule,
    MeetingsModule,
    SfuModule,
  ],
})
export class AppModule {}
