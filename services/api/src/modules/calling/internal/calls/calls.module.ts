import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CallSchema } from './schemas/call.schema';
import { GroupCallService } from './group-call.service';
import { CallTransferService } from './call-transfer.service';
import { CallRecordingService } from './call-recording.service';
import { VoicemailService } from './voicemail/voicemail.service';
import { VoiceHuddleService } from './voice-huddle.service';
import { SfuModule } from '../sfu/sfu.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Call', schema: CallSchema },
    ], "nexora_calling"),
    SfuModule,
  ],
  providers: [GroupCallService, CallTransferService, CallRecordingService, VoicemailService, VoiceHuddleService],
  exports: [GroupCallService, CallTransferService, CallRecordingService, VoicemailService, VoiceHuddleService, MongooseModule],
})
export class CallsModule {}
