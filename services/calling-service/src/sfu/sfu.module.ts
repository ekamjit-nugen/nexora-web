import { Module } from '@nestjs/common';
import { SfuService } from './sfu.service';
import { SfuGateway } from './sfu.gateway';

@Module({
  providers: [SfuService, SfuGateway],
  exports: [SfuService],
})
export class SfuModule {}
