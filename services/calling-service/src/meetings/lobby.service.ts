import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  async joinWithLobby(meetingId: string, userId: string, displayName: string, email?: string): Promise<{ admitted: boolean; meeting: IMeeting }> {
    const meeting = await this.meetingModel.findOne({ meetingId, status: { $in: ['scheduled', 'lobby_open', 'active'] } });
    if (!meeting) throw new NotFoundException('Meeting not found');

    // Check if lobby is enabled
    if (!meeting.settings?.lobby?.enabled) {
      return { admitted: true, meeting };
    }

    // Check auto-admit rules
    const autoAdmit = meeting.settings.lobby.autoAdmit || 'org_members';
    if (autoAdmit === 'everyone') {
      return { admitted: true, meeting };
    }

    // If user is host or co-host, always admit
    if (userId === meeting.hostId || meeting.coHostIds?.includes(userId)) {
      return { admitted: true, meeting };
    }

    // If auto-admit org members and user is in participantIds (invited)
    if (autoAdmit === 'org_members' && meeting.participantIds.includes(userId)) {
      return { admitted: true, meeting };
    }

    // Add to lobby queue
    const alreadyInQueue = meeting.lobbyQueue.some(e => e.userId === userId);
    if (!alreadyInQueue) {
      meeting.lobbyQueue.push({
        userId,
        name: displayName,
        email: email || null,
        requestedAt: new Date(),
      } as any);

      if (meeting.status === 'scheduled') {
        meeting.status = 'lobby_open';
      }

      await meeting.save();
    }

    this.logger.log(`User ${userId} placed in lobby for meeting ${meetingId}`);
    return { admitted: false, meeting };
  }

  async admitFromLobby(meetingId: string, hostId: string, userId: string): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host or co-host can admit from lobby');
    }

    meeting.lobbyQueue = meeting.lobbyQueue.filter(e => e.userId !== userId) as any;
    await meeting.save();

    this.logger.log(`User ${userId} admitted from lobby for meeting ${meetingId}`);
    return meeting;
  }

  async admitAll(meetingId: string, hostId: string): Promise<{ admittedUserIds: string[] }> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host or co-host can admit all');
    }

    const admittedUserIds = meeting.lobbyQueue.map(e => e.userId).filter(Boolean) as string[];
    meeting.lobbyQueue = [] as any;
    await meeting.save();

    this.logger.log(`All lobby users admitted for meeting ${meetingId}`);
    return { admittedUserIds };
  }

  async denyFromLobby(meetingId: string, hostId: string, userId: string): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host or co-host can deny from lobby');
    }

    meeting.lobbyQueue = meeting.lobbyQueue.filter(e => e.userId !== userId) as any;
    await meeting.save();

    this.logger.log(`User ${userId} denied from lobby for meeting ${meetingId}`);
    return meeting;
  }

  async getLobbyQueue(meetingId: string) {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting.lobbyQueue;
  }
}
