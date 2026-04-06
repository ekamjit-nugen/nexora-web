import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IMeeting } from './schemas/meeting.schema';

@Injectable()
export class BreakoutService {
  private readonly logger = new Logger(BreakoutService.name);

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  async createBreakoutRooms(
    meetingId: string,
    hostId: string,
    rooms: Array<{ name: string; participants: string[] }>,
    settings?: { autoAssign?: boolean; allowReturn?: boolean; timer?: number; hostCanJoinAny?: boolean },
  ): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId, status: 'active' });
    if (!meeting) throw new NotFoundException('Active meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host or co-host can create breakout rooms');
    }

    if (rooms.length < 2 || rooms.length > 50) {
      throw new BadRequestException('Breakout rooms must be between 2 and 50');
    }

    meeting.breakoutRooms = rooms.map(r => ({
      id: uuidv4().split('-')[0],
      name: r.name,
      participants: r.participants,
      status: 'pending',
    })) as any;

    meeting.breakoutSettings = {
      autoAssign: settings?.autoAssign || false,
      allowReturn: settings?.allowReturn ?? true,
      timer: settings?.timer || null,
      hostCanJoinAny: settings?.hostCanJoinAny ?? true,
    } as any;

    await meeting.save();
    this.logger.log(`Breakout rooms created for meeting ${meetingId}: ${rooms.length} rooms`);
    return meeting;
  }

  async autoAssignBreakoutRooms(meetingId: string, hostId: string, roomCount: number): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId, status: 'active' });
    if (!meeting) throw new NotFoundException('Active meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host can auto-assign');
    }

    // Get active participants (excluding host)
    const activeParticipants = meeting.participants
      .filter(p => !p.leftAt && p.userId !== hostId)
      .map(p => p.userId)
      .filter(Boolean) as string[];

    // Distribute evenly across rooms
    const rooms: Array<{ name: string; participants: string[] }> = [];
    for (let i = 0; i < roomCount; i++) {
      rooms.push({ name: `Room ${i + 1}`, participants: [] });
    }

    activeParticipants.forEach((userId, idx) => {
      rooms[idx % roomCount].participants.push(userId);
    });

    return this.createBreakoutRooms(meetingId, hostId, rooms);
  }

  async openBreakoutRooms(meetingId: string, hostId: string): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host can open breakout rooms');
    }

    for (const room of meeting.breakoutRooms) {
      room.status = 'active';
    }
    await meeting.save();

    this.logger.log(`Breakout rooms opened for meeting ${meetingId}`);
    return meeting;
  }

  async closeBreakoutRooms(meetingId: string, hostId: string): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host can close breakout rooms');
    }

    for (const room of meeting.breakoutRooms) {
      room.status = 'closed';
    }
    await meeting.save();

    this.logger.log(`Breakout rooms closed for meeting ${meetingId}`);
    return meeting;
  }

  async moveParticipant(meetingId: string, hostId: string, userId: string, targetRoomId: string): Promise<IMeeting> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId && !meeting.coHostIds?.includes(hostId)) {
      throw new ForbiddenException('Only host can move participants');
    }

    // Remove from all rooms
    for (const room of meeting.breakoutRooms) {
      room.participants = room.participants.filter(p => p !== userId);
    }

    // Add to target room
    const targetRoom = meeting.breakoutRooms.find(r => r.id === targetRoomId);
    if (!targetRoom) throw new NotFoundException('Target room not found');
    targetRoom.participants.push(userId);

    await meeting.save();
    return meeting;
  }

  async broadcastToAllRooms(meetingId: string, hostId: string, message: string): Promise<void> {
    const meeting = await this.meetingModel.findOne({ meetingId });
    if (!meeting) throw new NotFoundException('Meeting not found');
    if (meeting.hostId !== hostId) {
      throw new ForbiddenException('Only host can broadcast');
    }

    // The actual broadcast happens via WebSocket gateway
    // This method validates permissions and returns the room data
    this.logger.log(`Host broadcast to all breakout rooms in meeting ${meetingId}`);
  }
}
