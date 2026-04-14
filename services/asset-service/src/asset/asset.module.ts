import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { AssetSchema } from './schemas/asset.schema';
import { AssetCategorySchema } from './schemas/asset-category.schema';
import { AssetAssignmentSchema } from './schemas/asset-assignment.schema';
import { AssetMaintenanceSchema } from './schemas/asset-maintenance.schema';
import { AssetCounterSchema } from './schemas/counter.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Asset', schema: AssetSchema },
      { name: 'AssetCategory', schema: AssetCategorySchema },
      { name: 'AssetAssignment', schema: AssetAssignmentSchema },
      { name: 'AssetMaintenance', schema: AssetMaintenanceSchema },
      { name: 'AssetCounter', schema: AssetCounterSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [AssetController],
  providers: [AssetService, JwtAuthGuard],
  exports: [AssetService],
})
export class AssetModule {}
