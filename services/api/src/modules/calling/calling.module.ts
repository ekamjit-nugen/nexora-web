import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CallingModule as InternalCallingModule } from './internal/calling/calling.module';
import { CallsModule } from './internal/calls/calls.module';
import { MeetingsModule } from './internal/meetings/meetings.module';
import { SfuModule } from './internal/sfu/sfu.module';

import { CallSchema } from './internal/calling/schemas/call.schema';
import { CALLING_PUBLIC_API } from './public-api';
import { CallingPublicApiImpl } from './public-api/calling-public-api.impl';
import { CALLING_DB } from '../../bootstrap/database/database.tokens';

@Module({
  imports: [
    InternalCallingModule,
    CallsModule,
    MeetingsModule,
    SfuModule,
    MongooseModule.forFeature(
      [{ name: 'Call', schema: CallSchema }],
      CALLING_DB,
    ),
  ],
  providers: [
    { provide: CALLING_PUBLIC_API, useClass: CallingPublicApiImpl },
  ],
  exports: [CALLING_PUBLIC_API],
})
export class CallingModule {}
