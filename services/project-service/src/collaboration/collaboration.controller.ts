import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';

@Controller('api/v1/collaboration')
export class CollaborationController {
  constructor(private readonly collaborationService: CollaborationService) {}

  /**
   * Create collaboration session
   */
  @Post('sessions')
  async createSession(@Body() body: any) {
    return this.collaborationService.createSession(
      body.productId,
      body.resourceType,
      body.resourceId,
      body.userId,
    );
  }

  /**
   * Get session
   */
  @Get('sessions/:sessionId')
  async getSession(@Param('sessionId') sessionId: string) {
    return this.collaborationService.getSession(sessionId);
  }

  /**
   * Join session
   */
  @Post('sessions/:sessionId/join')
  async joinSession(@Param('sessionId') sessionId: string, @Body() body: any) {
    return this.collaborationService.joinSession(sessionId, body.userId);
  }

  /**
   * Leave session
   */
  @Post('sessions/:sessionId/leave')
  async leaveSession(@Param('sessionId') sessionId: string, @Body() body: any) {
    return this.collaborationService.leaveSession(sessionId, body.userId);
  }

  /**
   * Record collaborative edit
   */
  @Post('sessions/:sessionId/edits')
  async recordEdit(@Param('sessionId') sessionId: string, @Body() body: any) {
    return this.collaborationService.recordEdit(sessionId, body.userId, {
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      operation: body.operation,
      path: body.path,
      value: body.value,
      clientId: body.clientId,
      version: body.version,
    });
  }

  /**
   * Get session edits
   */
  @Get('sessions/:sessionId/edits')
  async getSessionEdits(@Param('sessionId') sessionId: string) {
    return this.collaborationService.getSessionEdits(sessionId);
  }

  /**
   * Detect conflicts
   */
  @Get('sessions/:sessionId/conflicts')
  async detectConflicts(@Param('sessionId') sessionId: string) {
    return this.collaborationService.detectConflicts(sessionId);
  }

  /**
   * Resolve conflict
   */
  @Post('conflicts/resolve')
  async resolveConflict(@Body() body: any) {
    return this.collaborationService.resolveConflict(
      body.productId,
      body.sessionId,
      body.conflictEdits,
      body.strategy,
      body.resolution,
      body.resolvedBy,
    );
  }

  /**
   * Update cursor position
   */
  @Post('sessions/:sessionId/cursors')
  async updateCursorPosition(@Param('sessionId') sessionId: string, @Body() body: any) {
    this.collaborationService.updateCursorPosition(
      sessionId,
      body.userId,
      body.username,
      body.position,
      body.color,
    );
    return { success: true };
  }

  /**
   * Get active cursors
   */
  @Get('sessions/:sessionId/cursors')
  async getActiveCursors(@Param('sessionId') sessionId: string) {
    return {
      cursors: this.collaborationService.getActiveCursors(sessionId),
    };
  }

  /**
   * Get collaboration activity
   */
  @Get('activity/product/:productId/resource/:resourceId')
  async getCollaborationActivity(
    @Param('productId') productId: string,
    @Param('resourceId') resourceId: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.collaborationService.getCollaborationActivity(productId, resourceId, limit);
  }

  /**
   * Get session participants
   */
  @Get('sessions/:sessionId/participants')
  async getSessionParticipants(@Param('sessionId') sessionId: string) {
    return this.collaborationService.getSessionParticipants(sessionId);
  }

  /**
   * Get merge status
   */
  @Get('sessions/:sessionId/merge-status')
  async getSessionMergeStatus(@Param('sessionId') sessionId: string) {
    return this.collaborationService.getSessionMergeStatus(sessionId);
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'collaboration' };
  }
}
