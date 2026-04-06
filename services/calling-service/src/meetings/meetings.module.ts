import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MeetingSchema } from './schemas/meeting.schema';
import { LobbyService } from './lobby.service';
import { MeetingChatService } from './meeting-chat.service';
import { RecurringService } from './recurring.service';
import { BreakoutService } from './breakout.service';
import { MeetingRecordingService } from './recording.service';
import { CalendarService } from './calendar.service';
import { WhiteboardService } from './whiteboard/whiteboard.service';
import { CaptionsService } from './captions/captions.service';
import { MeetingNotesService } from './meeting-notes.service';
import { SfuModule } from '../sfu/sfu.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Meeting', schema: MeetingSchema },
    ]),
    SfuModule,
  ],
  providers: [LobbyService, MeetingChatService, RecurringService, BreakoutService, MeetingRecordingService, CalendarService, WhiteboardService, CaptionsService, MeetingNotesService],
  exports: [LobbyService, MeetingChatService, RecurringService, BreakoutService, MeetingRecordingService, CalendarService, WhiteboardService, CaptionsService, MeetingNotesService, MongooseModule],
})
export class MeetingsModule {}
