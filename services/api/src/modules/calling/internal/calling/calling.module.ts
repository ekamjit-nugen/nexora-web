import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CallingController } from './calling.controller';
import { CallingService } from './calling.service';
import { CallingGateway } from './calling.gateway';
import { VoiceHuddleService } from './voice-huddle.service';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { MeetingGateway } from './meeting.gateway';
import { CallSchema } from './schemas/call.schema';
import { MeetingSchema } from './schemas/meeting.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CallsModule } from '../calls/calls.module';
import { MeetingsModule } from '../meetings/meetings.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Call', schema: CallSchema },
      { name: 'Meeting', schema: MeetingSchema },
    ], "nexora_calling"),
    CallsModule,
    MeetingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start calling-service without a JWT secret.');
        }
        return { secret };
      },
    }),
  ],
  controllers: [CallingController, MeetingController],
  providers: [CallingService, CallingGateway, VoiceHuddleService, MeetingService, MeetingGateway, JwtAuthGuard],
  exports: [CallingService, CallingGateway, VoiceHuddleService, MeetingService, MeetingGateway],
})
export class CallingModule {}
