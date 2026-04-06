import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CallingController } from './calling.controller';
import { CallingService } from './calling.service';
import { CallingGateway } from './calling.gateway';
import { MeetingController } from './meeting.controller';
import { MeetingService } from './meeting.service';
import { MeetingGateway } from './meeting.gateway';
import { CallSchema } from './schemas/call.schema';
import { MeetingSchema } from './schemas/meeting.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Call', schema: CallSchema },
      { name: 'Meeting', schema: MeetingSchema },
    ]),
    CallsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [CallingController, MeetingController],
  providers: [CallingService, CallingGateway, MeetingService, MeetingGateway, JwtAuthGuard],
  exports: [CallingService, CallingGateway, MeetingService, MeetingGateway],
})
export class CallingModule {}
