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
import {
  InitiateCallDto,
  AnswerCallDto,
  RejectCallDto,
  EndCallDto,
  CallHistoryQueryDto,
} from './dto/index';

@Controller('calls')
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
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async initiateCall(@Body() dto: InitiateCallDto, @Req() req: any) {
    try {
      const call = await this.callingService.initiateCall(req.user.sub || req.user.userId, 'default-org', dto);
      return { success: true, message: 'Call initiated', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Answer an incoming call
   */
  @Post(':callId/answer')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getCallHistory(@Query() query: CallHistoryQueryDto, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const result = await this.callingService.getCallHistory(userId, 'default-org', query);
      return { success: true, message: 'Call history retrieved', data: result.calls, pagination: result.pagination };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get missed calls
   */
  @Get('missed')
  @UseGuards(JwtAuthGuard)
  async getMissedCalls(@Query('limit') limit: number = 10, @Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const missedCalls = await this.callingService.getMissedCalls(userId, 'default-org', limit);
      return { success: true, message: 'Missed calls retrieved', data: missedCalls };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get recent calls for current user
   */
  @Get('recent')
  @UseGuards(JwtAuthGuard)
  async getRecentCalls(@Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const result = await this.callingService.getCallHistory(userId, 'default-org', { limit: 20, page: 1 });
      return { success: true, message: 'Recent calls retrieved', data: result.calls };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }

  /**
   * Get call stats for current user
   */
  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getCallStats(@Req() req: any) {
    try {
      const userId = req.user.sub || req.user.userId;
      const stats = await this.callingService.getCallStats(userId, 'default-org');
      return { success: true, message: 'Call stats retrieved', data: stats };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  async getCallDetails(@Param('callId') callId: string, @Req() req: any) {
    try {
      const call = await this.callingService.getCallDetails(callId, req.user.sub || req.user.userId);
      return { success: true, message: 'Call details retrieved', data: call };
    } catch (err) {
      throw new BadRequestException(err.message);
    }
  }
}
