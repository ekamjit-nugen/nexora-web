import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VersionService } from './version.service';
import { VersionController } from './version.controller';
import { ProductVersionSchema, VersionHistorySchema } from './version.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ProductVersion', schema: ProductVersionSchema },
      { name: 'VersionHistory', schema: VersionHistorySchema },
    ]),
  ],
  providers: [VersionService],
  controllers: [VersionController],
  exports: [VersionService],
})
export class VersionModule {}
