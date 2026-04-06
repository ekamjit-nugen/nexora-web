import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { CallingService } from './calling.service';
import { CallingGateway } from './calling.gateway';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles, RolesGuard } from './guards/roles.guard';
import {
  InitiateCallDto,
  AnswerCallDto,
  RejectCallDto,
  EndCallDto,
  CallHistoryQueryDto,
} from './dto/index';

@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallingController {
  private readonly logger = new Logger(CallingController.name);

  constructor(
    private callingService: CallingService,
    private callingGateway: CallingGateway,
  ) {}

  /**
   * Initiate a new call
   */
  @Post()
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async initiateCall(@Body() dto: InitiateCallDto, @Req() req: any) {
    try {
      const orgId = req.user?.organizationId || req.headers?.['x-organization-id'] || 'default-org';
      const call = await this.callingService.initiateCall(req.user.sub || req.user.userId, orgId, dto);
      return { success: true, message: 'Call initiated', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Answer an incoming call
   */
  @Post(':callId/answer')
  @HttpCode(HttpStatus.OK)
  async answerCall(@Param('callId') callId: string, @Body() dto: AnswerCallDto, @Req() req: any) {
    try {
      const call = await this.callingService.answerCall(
        callId,
        req.user.sub || req.user.userId,
        dto.audioEnabled ?? true,
        dto.videoEnabled ?? false,
      );
      return { success: true, message: 'Call answered', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Reject an incoming call
   */
  @Post(':callId/reject')
  @HttpCode(HttpStatus.OK)
  async rejectCall(@Param('callId') callId: string, @Body() dto: RejectCallDto, @Req() req: any) {
    try {
      const call = await this.callingService.rejectCall(callId, req.user.sub || req.user.userId, dto.reason);
      return { success: true, message: 'Call rejected', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * End an active call
   */
  @Post(':callId/end')
  @HttpCode(HttpStatus.OK)
  async endCall(@Param('callId') callId: string, @Req() req: any) {
    try {
      const call = await this.callingService.endCall(callId, req.user.sub || req.user.userId);
      return { success: true, message: 'Call ended', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get call history for current user
   */
  @Get('history')
  @Roles('member', 'manager', 'admin', 'owner')
  async getCallHistory(@Query() query: CallHistoryQueryDto, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const orgId = req.user?.organizationId || req.headers?.['x-organization-id'] || 'default-org';
      const result = await this.callingService.getCallHistory(userId, orgId, query);
      return { success: true, message: 'Call history retrieved', data: result.calls, pagination: result.pagination };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get missed calls
   */
  @Get('missed')
  async getMissedCalls(@Query('limit') limit: number = 10, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const orgId = req.user?.organizationId || req.headers?.['x-organization-id'] || 'default-org';
      const missedCalls = await this.callingService.getMissedCalls(userId, orgId, limit);
      return { success: true, message: 'Missed calls retrieved', data: missedCalls };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get recent calls for current user
   */
  @Get('recent')
  async getRecentCalls(@Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const orgId = req.user?.organizationId || req.headers?.['x-organization-id'] || 'default-org';
      const result = await this.callingService.getCallHistory(userId, orgId, { limit: 20, page: 1 });
      return { success: true, message: 'Recent calls retrieved', data: result.calls };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get call stats for current user
   */
  @Get('stats')
  @Roles('manager', 'admin', 'owner')
  async getCallStats(@Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const orgId = req.user?.organizationId || req.headers?.['x-organization-id'] || 'default-org';
      const stats = await this.callingService.getCallStats(userId, orgId);
      return { success: true, message: 'Call stats retrieved', data: stats };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get ICE servers for WebRTC
   */
  @Get('ice-servers')
  getIceServers(@Req() req: any) {
    const stunServers = (process.env.STUN_SERVERS || 'stun:stun.l.google.com:19302').split(',');
    const iceServers: any[] = stunServers.map((s: string) => ({ urls: s.trim() }));

    const turnServer = process.env.TURN_SERVER_URL;
    const turnSecret = process.env.TURN_SECRET;

    if (turnServer && turnSecret) {
      // Item 22: Time-limited HMAC-SHA1 TURN credentials (12-hour validity)
      const crypto = require('crypto');
      const userId = req.user?.userId || 'anon';
      const timestamp = Math.floor(Date.now() / 1000) + 43200;
      const username = `${timestamp}:${userId}`;
      const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
      iceServers.push({ urls: turnServer, username, credential });
    } else if (turnServer) {
      iceServers.push({
        urls: turnServer,
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_CREDENTIAL || '',
      });
    }

    return { success: true, data: { iceServers } };
  }

  /**
   * Health check
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  health() {
    return { success: true, message: 'Calling service is running', timestamp: new Date() };
  }

  /**
   * Update call notes
   */
  @Put(':id/notes')
  async updateCallNotes(@Param('id') id: string, @Body() body: { notes: string }, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const call = await this.callingService.updateCallNotes(id, userId, body.notes || '');
      return { success: true, message: 'Notes updated', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get call details — MUST be after all specific GET routes
   */
  @Get(':callId')
  async getCallDetails(@Param('callId') callId: string, @Req() req: any) {
    try {
      const call = await this.callingService.getCallDetails(callId, req.user.sub || req.user.userId);
      return { success: true, message: 'Call details retrieved', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }
}
