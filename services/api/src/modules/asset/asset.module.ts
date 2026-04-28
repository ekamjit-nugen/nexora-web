import { Module } from '@nestjs/common';
import { AssetModule as InternalAssetModule } from './internal/asset/asset.module';

@Module({ imports: [InternalAssetModule] })
export class AssetModule {}
