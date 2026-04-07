import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'crypto';
import { IMeeting } from './schemas/meeting.schema';
import {
  ScheduleMeetingDto,
  UpdateMeetingDto,
  AddTranscriptDto,
  MeetingQueryDto,
} from './dto/index';
import { hashMeetingPassword } from '../meetings/meeting-permissions';

@Injectable()
export class MeetingService {
  private readonly logger = new Logger(MeetingService.name);

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  async scheduleMeeting(
    hostId: string,
    hostName: string,
    organizationId: string,
    dto: ScheduleMeetingDto,
  ) {
    const meetingId = randomUUID();

    // Hash the join password if provided
    let hashedPassword: string | null = null;
    if (dto.joinPassword) {
      hashedPassword = await hashMeetingPassword(dto.joinPassword);
    }

    const meeting = await this.meetingModel.create({
      organizationId,
      meetingId,
      title: dto.title,
      description: dto.description,
      scheduledAt: new Date(dto.scheduledAt),
      durationMinutes: dto.durationMinutes || 60,
      hostId,
      hostName,
      participantIds: dto.participantIds || [],
      participants: [],
      status: 'scheduled',
      recordingEnabled: dto.recordingEnabled || false,
      isRecording: false,
      transcript: [],
      sprintId: dto.sprintId,
      joinPassword: hashedPassword,
    });

    this.logger.log(`Meeting scheduled: ${meetingId} by ${hostId}`);

    // Strip hashed password from response
    const result = meeting.toObject();
    delete result.joinPassword;
    return result;
  }

  async getMeeting(meetingId: string) {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`);
    return meeting;
  }

  async getMeetingForUser(meetingId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId);
    const isParticipant =
      meeting.hostId === userId || meeting.participantIds.includes(userId);
    if (!isParticipant) {
      throw new ForbiddenException('You are not invited to this meeting');
    }
    // Strip hashed password from response
    const result = meeting.toObject();
    delete result.joinPassword;
    return result;
  }

  async getPublicMeetingInfo(meetingId: string) {
    const meeting = await this.meetingModel
      .findOne({ meetingId })
      .select('meetingId title hostName scheduledAt durationMinutes status organizationId');
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`);
    return meeting;
  }

  async listMeetings(
    userId: string,
    organizationId: string,
    query: MeetingQueryDto,
  ) {
    const limit = Math.min(query.limit || 50, 100);
    const page = Math.max(query.page || 1, 1);
    const skip = (page - 1) * limit;

    const filter: any = {
      organizationId,
      $or: [{ hostId: userId }, { participantIds: userId }],
    };

    if (query.status) filter.status = query.status;
    if (query.sprintId) filter.sprintId = query.sprintId;

    const [meetings, total] = await Promise.all([
      this.meetingModel.find(filter).sort({ scheduledAt: 1 }).skip(skip).limit(limit).lean(),
      this.meetingModel.countDocuments(filter),
    ]);

    // Strip hashed passwords from response
    const sanitized = meetings.map(({ joinPassword, ...rest }) => rest);

    return {
      meetings: sanitized,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getMeetingsBySprint(sprintId: string) {
    return this.meetingModel.find({ sprintId }).sort({ scheduledAt: 1 }).lean();
  }

  async updateMeeting(meetingId: string, userId: string, dto: UpdateMeetingDto) {
    const meeting = await this.getMeeting(meetingId);
    if (meeting.hostId !== userId)
      throw new ForbiddenException('Only the host can update this meeting');

    // Hash new password if provided
    if (dto.joinPassword) {
      dto.joinPassword = await hashMeetingPassword(dto.joinPassword);
    }

    Object.assign(meeting, dto);
    await meeting.save();

    // Strip hashed password from response
    const result = meeting.toObject();
    delete result.joinPassword;
    return result;
  }

  async startMeeting(meetingId: string, hostId: string) {
    const meeting = await this.getMeeting(meetingId);
    if (meeting.hostId !== hostId)
      throw new ForbiddenException('Only the host can start this meeting');
    if (meeting.status === 'ended' || meeting.status === 'cancelled')
      throw new BadRequestException(`Cannot start a ${meeting.status} meeting`);

    meeting.status = 'active';
    meeting.startedAt = new Date();
    await meeting.save();

    this.logger.log(`Meeting started: ${meetingId}`);
    return meeting;
  }

  async endMeeting(meetingId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId);
    if (meeting.hostId !== userId)
      throw new ForbiddenException('Only the host can end this meeting');
    if (meeting.status === 'ended') return meeting;

    meeting.status = 'ended';
    meeting.endedAt = new Date();
    meeting.isRecording = false;
    await meeting.save();

    this.logger.log(`Meeting ended: ${meetingId}`);
    return meeting;
  }

  async cancelMeeting(meetingId: string, userId: string) {
    const meeting = await this.getMeeting(meetingId);
    if (meeting.hostId !== userId)
      throw new ForbiddenException('Only the host can cancel this meeting');

    meeting.status = 'cancelled';
    await meeting.save();
    return meeting;
  }

  async joinMeeting(
    meetingId: string,
    userId?: string,
    displayName?: string,
    isAnonymous = false,
  ) {
    const meeting = await this.getMeeting(meetingId);

    if (meeting.status === 'ended' || meeting.status === 'cancelled')
      throw new BadRequestException(`Meeting is ${meeting.status}`);

    // Check if already in participants
    const alreadyJoined = meeting.participants.find(
      (p) => (userId && p.userId === userId) || (!userId && p.displayName === displayName),
    );

    if (!alreadyJoined) {
      meeting.participants.push({
        userId,
        displayName: displayName || 'Unknown',
        isAnonymous,
        joinedAt: new Date(),
        audioEnabled: true,
        videoEnabled: false,
      });
      await meeting.save();
    }

    return meeting;
  }

  async leaveMeeting(meetingId: string, userId?: string, displayName?: string) {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) return;

    const participant = meeting.participants.find(
      (p) => (userId && p.userId === userId) || (!userId && p.displayName === displayName),
    );
    if (participant) {
      participant.leftAt = new Date();
      await meeting.save();
    }
    return meeting;
  }

  async toggleRecording(meetingId: string, hostId: string, start: boolean) {
    const meeting = await this.getMeeting(meetingId);
    if (meeting.hostId !== hostId)
      throw new ForbiddenException('Only the host can toggle recording');

    meeting.isRecording = start;
    if (start && !meeting.recordingStartedAt) {
      meeting.recordingStartedAt = new Date();
    }
    await meeting.save();
    return meeting;
  }

  async addTranscript(
    meetingId: string,
    speakerId: string,
    dto: AddTranscriptDto,
  ) {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) return;

    meeting.transcript.push({
      speakerId,
      speakerName: dto.speakerName,
      text: dto.text,
      timestamp: new Date(),
    });
    await meeting.save();
  }

  async getTranscript(meetingId: string, userId: string) {
    const meeting = await this.getMeetingForUser(meetingId, userId);
    return meeting.transcript;
  }
}
