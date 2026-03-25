import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PolicyController } from './policy.controller';
import { PolicyService } from './policy.service';
import { PolicySchema } from './schemas/policy.schema';
import { PolicyAcknowledgementSchema } from './schemas/policy-acknowledgement.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Policy', schema: PolicySchema },
      { name: 'PolicyAcknowledgement', schema: PolicyAcknowledgementSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [PolicyController],
  providers: [PolicyService, JwtAuthGuard],
  exports: [PolicyService],
})
export class PolicyModule {}
