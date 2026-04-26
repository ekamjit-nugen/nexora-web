import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { PolicyClientService } from './policy-client.service';
import { LeaveSchema } from './schemas/leave.schema';
import { LeaveBalanceSchema } from './schemas/leave-balance.schema';
import { LeavePolicySchema } from './schemas/leave-policy.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Leave', schema: LeaveSchema },
      { name: 'LeaveBalance', schema: LeaveBalanceSchema },
      { name: 'LeavePolicy', schema: LeavePolicySchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [LeaveController],
  providers: [LeaveService, PolicyClientService, JwtAuthGuard],
  exports: [LeaveService],
})
export class LeaveModule {}
