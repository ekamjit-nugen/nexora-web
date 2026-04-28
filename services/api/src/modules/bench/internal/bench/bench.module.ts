import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BenchController } from './bench.controller';
import { BenchService } from './bench.service';
import { BenchSnapshotSchema } from './schemas/bench-snapshot.schema';
import { ResourceRequestSchema } from './schemas/resource-request.schema';
import { BenchConfigSchema } from './schemas/bench-config.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'BenchSnapshot', schema: BenchSnapshotSchema },
      { name: 'ResourceRequest', schema: ResourceRequestSchema },
      { name: 'BenchConfig', schema: BenchConfigSchema },
    ], "nexora_bench"),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [BenchController],
  providers: [BenchService, JwtAuthGuard],
  exports: [BenchService],
})
export class BenchModule {}
