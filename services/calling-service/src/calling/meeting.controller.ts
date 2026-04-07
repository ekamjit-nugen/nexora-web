import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { MeetingService } from './meeting.service';
import { MeetingGateway } from './meeting.gateway';
import { CaptionsService } from '../meetings/captions/captions.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles, RolesGuard } from './guards/roles.guard';
import {
  ScheduleMeetingDto,
  UpdateMeetingDto,
  AddTranscriptDto,
  MeetingQueryDto,
} from './dto/index';

@Controller('meetings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MeetingController {
  private readonly logger = new Logger(MeetingController.name);

  constructor(
    private meetingService: MeetingService,
    private meetingGateway: MeetingGateway,
    private captionsService: CaptionsService,
  ) {}

  /** Schedule a new meeting */
  @Post()
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async scheduleMeeting(@Body() dto: ScheduleMeetingDto, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const organizationId = req.user.organizationId || req.headers['x-organization-id'] || 'default-org';
      const hostName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || req.user.email || userId;
      const meeting = await this.meetingService.scheduleMeeting(userId, hostName, organizationId, dto);
      return { success: true, message: 'Meeting scheduled', data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** List meetings for current user */
  @Get()
  @UseGuards(JwtAuthGuard)
  async listMeetings(@Query() query: MeetingQueryDto, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const organizationId = req.user.organizationId || req.headers['x-organization-id'] || 'default-org';
      const result = await this.meetingService.listMeetings(userId, organizationId, query);
      return { success: true, message: 'Meetings retrieved', data: result.meetings, pagination: result.pagination };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Get meetings for a sprint */
  @Get('sprint/:sprintId')
  @UseGuards(JwtAuthGuard)
  async getMeetingsBySprint(@Param('sprintId') sprintId: string) {
    try {
      const meetings = await this.meetingService.getMeetingsBySprint(sprintId);
      return { success: true, message: 'Sprint meetings retrieved', data: meetings };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Public endpoint — get just enough info to render the join page (no auth required) */
  @Get(':meetingId/public')
  async getPublicInfo(@Param('meetingId') meetingId: string) {
    try {
      const info = await this.meetingService.getPublicMeetingInfo(meetingId);
      return { success: true, data: info };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Get full meeting details (authenticated) */
  @Get(':meetingId')
  @UseGuards(JwtAuthGuard)
  async getMeeting(@Param('meetingId') meetingId: string, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.getMeetingForUser(meetingId, userId);
      return { success: true, data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Update meeting details */
  @Put(':meetingId')
  @UseGuards(JwtAuthGuard)
  async updateMeeting(
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateMeetingDto,
    @Req() req: any,
  ) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.updateMeeting(meetingId, userId, dto);
      return { success: true, message: 'Meeting updated', data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Host starts the meeting — notifies all invited participants via WebSocket */
  @Post(':meetingId/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startMeeting(@Param('meetingId') meetingId: string, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.startMeeting(meetingId, userId);

      // Notify all invited participants
      meeting.participantIds.forEach((pid) => {
        if (pid !== userId) {
          this.meetingGateway.notifyUser(pid, 'meeting:started', {
            meetingId: meeting.meetingId,
            title: meeting.title,
            hostName: meeting.hostName,
            startedAt: meeting.startedAt,
          });
        }
      });

      return { success: true, message: 'Meeting started', data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** End the meeting */
  @Post(':meetingId/end')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async endMeeting(@Param('meetingId') meetingId: string, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.endMeeting(meetingId, userId);

      this.meetingGateway.emitToRoom(meetingId, 'meeting:ended', {
        meetingId,
        endedBy: userId,
        endedAt: meeting.endedAt,
      });

      return { success: true, message: 'Meeting ended', data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Cancel meeting */
  @Delete(':meetingId')
  @UseGuards(JwtAuthGuard)
  async cancelMeeting(@Param('meetingId') meetingId: string, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.cancelMeeting(meetingId, userId);
      return { success: true, message: 'Meeting cancelled', data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Get meeting transcript */
  @Get(':meetingId/transcript')
  @UseGuards(JwtAuthGuard)
  async getTranscript(@Param('meetingId') meetingId: string, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const transcript = await this.meetingService.getTranscript(meetingId, userId);
      return { success: true, data: transcript };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Toggle recording */
  @Post(':meetingId/recording')
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async toggleRecording(
    @Param('meetingId') meetingId: string,
    @Body() body: { start: boolean },
    @Req() req: any,
  ) {
    try {
      const userId = req.user.sub || req.user.userId;
      const meeting = await this.meetingService.toggleRecording(meetingId, userId, body.start);

      this.meetingGateway.emitToRoom(meetingId, 'meeting:recording-toggled', {
        meetingId,
        isRecording: meeting.isRecording,
        toggledBy: userId,
      });

      return { success: true, message: `Recording ${body.start ? 'started' : 'stopped'}`, data: meeting };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Toggle captions for a user */
  @Post(':meetingId/captions/toggle')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async toggleCaptions(
    @Param('meetingId') meetingId: string,
    @Body() body: { enabled: boolean },
    @Req() req: any,
  ) {
    const userId = req.user.sub || req.user.userId;
    if (body.enabled) {
      this.captionsService.enableCaptions(meetingId, userId);
    } else {
      this.captionsService.disableCaptions(meetingId, userId);
    }
    return {
      success: true,
      data: {
        enabled: body.enabled,
        serverTranscriptionAvailable: this.captionsService.isServerTranscriptionAvailable(),
      },
    };
  }

  /** Submit an audio chunk for server-side transcription */
  @Post(':meetingId/captions/chunk')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async submitCaptionChunk(
    @Param('meetingId') meetingId: string,
    @Body() body: { audioData: string; language?: string; speakerName?: string },
    @Req() req: any,
  ) {
    try {
      const userId = req.user.sub || req.user.userId;
      const speakerName = body.speakerName || [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Unknown';

      // Decode base64 audio data
      const audioBuffer = Buffer.from(body.audioData, 'base64');

      const segment = await this.captionsService.processAudioChunk(
        meetingId, userId, speakerName, audioBuffer, body.language || 'en',
      );

      if (segment) {
        // Broadcast caption to all users in the meeting who have captions enabled
        const captionUsers = this.captionsService.getCaptionUsers(meetingId);
        captionUsers.forEach(uid => {
          this.meetingGateway.notifyUser(uid, 'meeting:caption', segment);
        });
      }

      return { success: true, data: segment };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /** Check if server-side captions are available */
  @Get(':meetingId/captions/status')
  @UseGuards(JwtAuthGuard)
  async getCaptionsStatus(@Param('meetingId') meetingId: string, @Req() req: any) {
    const userId = req.user.sub || req.user.userId;
    return {
      success: true,
      data: {
        enabled: this.captionsService.isCaptionsEnabled(meetingId, userId),
        serverTranscriptionAvailable: this.captionsService.isServerTranscriptionAvailable(),
        captionUsers: this.captionsService.getCaptionUsers(meetingId),
      },
    };
  }

  /** Item 24: ICS calendar export */
  @Get(':meetingId/ics')
  async getIcs(@Param('meetingId') meetingId: string, @Res() res: any) {
    const meeting = await this.meetingService.getMeeting(meetingId);
    if (!meeting) throw new NotFoundException('Meeting not found');

    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nexora//Meetings//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${meeting.title}`,
      meeting.description ? `DESCRIPTION:${meeting.description.replace(/\n/g, '\\n')}` : '',
      `UID:${meeting.meetingId}@nexora.io`,
      `ORGANIZER:${meeting.hostName || 'Host'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${meeting.title || 'meeting'}.ics"`);
    return res.send(ics);
  }
}
