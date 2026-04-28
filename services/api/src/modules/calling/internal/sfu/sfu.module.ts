import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SfuService } from './sfu.service';
import { SfuGateway } from './sfu.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start SFU module without a JWT secret.');
        }
        return { secret };
      },
    }),
  ],
  providers: [SfuService, SfuGateway],
  exports: [SfuService],
})
export class SfuModule {}
