import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { TenantSchema } from './tenant.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Tenant', schema: TenantSchema },
    ]),
  ],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}
