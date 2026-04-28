import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

/**
 * Global S3 module. Any feature module gets `S3Service` injected
 * without an explicit import. Keep it global because storage,
 * media, asset, knowledge, and chatbot all need it.
 */
@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3BootstrapModule {}
