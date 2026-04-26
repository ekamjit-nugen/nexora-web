import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { PolicyClientService } from './policy-client.service';
import { AttendanceSchema } from './schemas/attendance.schema';
import { ShiftSchema } from './schemas/shift.schema';
import { PolicySchema } from './schemas/policy.schema';
import { AlertSchema } from './schemas/alert.schema';
import { HolidaySchema } from './schemas/holiday.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Attendance', schema: AttendanceSchema },
      { name: 'Shift', schema: ShiftSchema },
      { name: 'Policy', schema: PolicySchema },
      { name: 'Alert', schema: AlertSchema },
      { name: 'Holiday', schema: HolidaySchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService, PolicyClientService, JwtAuthGuard],
  exports: [AttendanceService],
})
export class AttendanceModule {}
