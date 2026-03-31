import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthService } from './health.service';
import { HealthController } from './health.controller';
import { ProductHealthSchema } from './health.model';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'ProductHealth', schema: ProductHealthSchema }])],
  providers: [HealthService],
  controllers: [HealthController],
  exports: [HealthService],
})
export class HealthModule {}
