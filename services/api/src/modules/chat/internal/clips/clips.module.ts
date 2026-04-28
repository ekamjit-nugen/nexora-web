import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClipsController } from './clips.controller';
import { ClipsService } from './clips.service';
import { ClipSchema } from './clips.schema';
import { JwtAuthGuard } from '../chat/guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Clip', schema: ClipSchema },
    ], "nexora_chat"),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [ClipsController],
  providers: [ClipsService, JwtAuthGuard],
  exports: [ClipsService],
})
export class ClipsModule {}
