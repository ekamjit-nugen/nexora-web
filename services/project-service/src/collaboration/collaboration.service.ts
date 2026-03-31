import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ICollaborationSession,
  ICollaborativeEdit,
  IConflictResolution,
  ICursorPosition,
} from './collaboration.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CollaborationService {
  private activeSessions = new Map<string, ICursorPosition[]>();

  constructor(
    @InjectModel('CollaborationSession') private sessionModel: Model<ICollaborationSession>,
    @InjectModel('CollaborativeEdit') private editModel: Model<ICollaborativeEdit>,
    @InjectModel('ConflictResolution') private conflictModel: Model<IConflictResolution>,
  ) {}

  /**
   * Create collaboration session
   */
  async createSession(
    productId: string,
    resourceType: string,
    resourceId: string,
    userId: string,
  ): Promise<ICollaborationSession> {
    const sessionId = uuidv4();

    const session = new this.sessionModel({
      productId,
      sessionId,
      resourceType,
      resourceId,
      activeUsers: [userId],
    });

    this.activeSessions.set(sessionId, []);
    return session.save();
  }

  /**
   * Get session
   */
  async getSession(sessionId: string): Promise<ICollaborationSession> {
    const session = await this.sessionModel.findOne({ sessionId });
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  /**
   * Join session
   */
  async joinSession(sessionId: string, userId: string): Promise<ICollaborationSession> {
    const session = await this.getSession(sessionId);

    if (!session.activeUsers.includes(userId)) {
      session.activeUsers.push(userId);
      await session.save();
    }

    return session;
  }

  /**
   * Leave session
   */
  async leaveSession(sessionId: string, userId: string): Promise<ICollaborationSession> {
    const session = await this.getSession(sessionId);

    session.activeUsers = session.activeUsers.filter(id => id !== userId);

    // Clean up cursor positions
    const cursors = this.activeSessions.get(sessionId) || [];
    const updatedCursors = cursors.filter(c => c.userId !== userId);
    this.activeSessions.set(sessionId, updatedCursors);

    if (session.activeUsers.length === 0) {
      await this.sessionModel.deleteOne({ sessionId });
      this.activeSessions.delete(sessionId);
    } else {
      await session.save();
    }

    return session;
  }

  /**
   * Record collaborative edit
   */
  async recordEdit(
    sessionId: string,
    userId: string,
    editData: {
      resourceType: string;
      resourceId: string;
      operation: 'insert' | 'delete' | 'update' | 'move';
      path: string;
      value: any;
      clientId: string;
      version: number;
    },
  ): Promise<ICollaborativeEdit> {
    const session = await this.getSession(sessionId);

    const edit = new this.editModel({
      sessionId,
      productId: session.productId,
      userId,
      resourceType: editData.resourceType,
      resourceId: editData.resourceId,
      operation: editData.operation,
      path: editData.path,
      value: editData.value,
      timestamp: new Date(),
      clientId: editData.clientId,
      version: editData.version,
    });

    return edit.save();
  }

  /**
   * Get session edits
   */
  async getSessionEdits(sessionId: string): Promise<ICollaborativeEdit[]> {
    return this.editModel
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .exec();
  }

  /**
   * Detect conflicts in edits
   */
  async detectConflicts(sessionId: string): Promise<any[]> {
    const edits = await this.getSessionEdits(sessionId);
    const conflicts: any[] = [];

    for (let i = 0; i < edits.length - 1; i++) {
      for (let j = i + 1; j < edits.length; j++) {
        const edit1 = edits[i];
        const edit2 = edits[j];

        if (this.editsConflict(edit1, edit2)) {
          conflicts.push({
            edit1: edit1._id,
            edit2: edit2._id,
            path: edit1.path,
            user1: edit1.userId,
            user2: edit2.userId,
            operation1: edit1.operation,
            operation2: edit2.operation,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two edits conflict
   */
  private editsConflict(edit1: ICollaborativeEdit, edit2: ICollaborativeEdit): boolean {
    // Same path and overlapping operations
    if (edit1.path === edit2.path && edit1.userId !== edit2.userId) {
      // Concurrent edits on same path
      if (
        (edit1.operation === 'update' && edit2.operation === 'update') ||
        (edit1.operation === 'delete' && edit2.operation === 'update') ||
        (edit1.operation === 'update' && edit2.operation === 'delete')
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolve conflict
   */
  async resolveConflict(
    productId: string,
    sessionId: string,
    conflictEdits: any[],
    strategy: 'last-write-wins' | 'first-write-wins' | 'merge' | 'manual',
    resolution: Record<string, any>,
    resolvedBy: string,
  ): Promise<IConflictResolution> {
    const conflictId = uuidv4();

    const conflict = new this.conflictModel({
      productId,
      conflictId,
      sessionId,
      edits: conflictEdits,
      strategy,
      resolution,
      resolvedBy,
      resolvedAt: new Date(),
    });

    return conflict.save();
  }

  /**
   * Update cursor position
   */
  updateCursorPosition(
    sessionId: string,
    userId: string,
    username: string,
    position: { line: number; column: number },
    color: string,
  ): void {
    const cursors = this.activeSessions.get(sessionId) || [];
    const existingCursor = cursors.find(c => c.userId === userId);

    if (existingCursor) {
      existingCursor.position = position;
      existingCursor.timestamp = new Date();
    } else {
      cursors.push({
        userId,
        username,
        position,
        timestamp: new Date(),
        color,
      });
    }

    this.activeSessions.set(sessionId, cursors);
  }

  /**
   * Get active cursor positions
   */
  getActiveCursors(sessionId: string): ICursorPosition[] {
    return this.activeSessions.get(sessionId) || [];
  }

  /**
   * Get collaboration activity
   */
  async getCollaborationActivity(
    productId: string,
    resourceId: string,
    limit: number = 50,
  ): Promise<any[]> {
    const edits = await this.editModel
      .find({ productId, resourceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();

    return edits.map(edit => ({
      userId: edit.userId,
      operation: edit.operation,
      path: edit.path,
      timestamp: edit.timestamp,
      version: edit.version,
    }));
  }

  /**
   * Get session participants
   */
  async getSessionParticipants(sessionId: string): Promise<any[]> {
    const session = await this.getSession(sessionId);
    const edits = await this.getSessionEdits(sessionId);

    const participants = new Map<string, { count: number; lastEdit: Date }>();

    for (const edit of edits) {
      if (participants.has(edit.userId)) {
        const p = participants.get(edit.userId)!;
        p.count += 1;
        p.lastEdit = edit.timestamp;
      } else {
        participants.set(edit.userId, {
          count: 1,
          lastEdit: edit.timestamp,
        });
      }
    }

    return Array.from(participants.entries()).map(([userId, data]) => ({
      userId,
      isActive: session.activeUsers.includes(userId),
      editsCount: data.count,
      lastEdit: data.lastEdit,
    }));
  }

  /**
   * Apply operational transformation
   */
  applyOT(edit1: ICollaborativeEdit, edit2: ICollaborativeEdit): ICollaborativeEdit {
    // Transform edit2 based on edit1 if they conflict
    if (edit1.path === edit2.path && edit1.operation !== 'delete') {
      if (edit2.operation === 'insert') {
        // Adjust position if necessary
        edit2.path = `${edit2.path}-adjusted`;
      }
    }
    return edit2;
  }

  /**
   * Get session merge status
   */
  async getSessionMergeStatus(sessionId: string): Promise<any> {
    const edits = await this.getSessionEdits(sessionId);
    const conflicts = await this.detectConflicts(sessionId);
    const resolutions = await this.conflictModel.find({ sessionId }).exec();

    return {
      totalEdits: edits.length,
      conflictDetected: conflicts.length > 0,
      conflictCount: conflicts.length,
      resolutionCount: resolutions.length,
      unresolved: conflicts.length - resolutions.length,
      isReadyToMerge: conflicts.length === resolutions.length,
    };
  }
}
