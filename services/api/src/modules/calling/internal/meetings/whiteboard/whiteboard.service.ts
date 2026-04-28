import { Injectable, Logger } from '@nestjs/common';

/**
 * Whiteboard Service — collaborative drawing surface during meetings.
 *
 * Production implementation:
 * - Embed Excalidraw or tldraw as the whiteboard engine
 * - Use CRDT (Conflict-free Replicated Data Type) for real-time sync via Y.js
 * - WebSocket events for cursor positions, drawing operations
 * - Export as PNG/PDF
 * - Persist whiteboard state after meeting ends
 *
 * This stub provides the interface and state management.
 */
@Injectable()
export class WhiteboardService {
  private readonly logger = new Logger(WhiteboardService.name);

  // In-memory whiteboard state per meeting (production: persist to DB/Redis)
  private whiteboards = new Map<string, WhiteboardState>();

  createWhiteboard(meetingId: string): WhiteboardState {
    if (this.whiteboards.has(meetingId)) {
      return this.whiteboards.get(meetingId)!;
    }

    const state: WhiteboardState = {
      meetingId,
      elements: [],
      cursors: new Map(),
      createdAt: new Date(),
    };
    this.whiteboards.set(meetingId, state);
    this.logger.log(`Whiteboard created for meeting ${meetingId}`);
    return state;
  }

  addElement(meetingId: string, element: WhiteboardElement): void {
    const state = this.whiteboards.get(meetingId);
    if (!state) return;
    state.elements.push(element);
  }

  updateElement(meetingId: string, elementId: string, updates: Partial<WhiteboardElement>): void {
    const state = this.whiteboards.get(meetingId);
    if (!state) return;
    const idx = state.elements.findIndex(e => e.id === elementId);
    if (idx >= 0) {
      state.elements[idx] = { ...state.elements[idx], ...updates };
    }
  }

  removeElement(meetingId: string, elementId: string): void {
    const state = this.whiteboards.get(meetingId);
    if (!state) return;
    state.elements = state.elements.filter(e => e.id !== elementId);
  }

  updateCursor(meetingId: string, userId: string, x: number, y: number): void {
    const state = this.whiteboards.get(meetingId);
    if (!state) return;
    state.cursors.set(userId, { x, y, updatedAt: new Date() });
  }

  getState(meetingId: string): WhiteboardState | null {
    return this.whiteboards.get(meetingId) || null;
  }

  closeWhiteboard(meetingId: string): WhiteboardState | null {
    const state = this.whiteboards.get(meetingId);
    this.whiteboards.delete(meetingId);
    return state || null;
  }
}

export interface WhiteboardElement {
  id: string;
  type: 'freehand' | 'rectangle' | 'circle' | 'arrow' | 'line' | 'text' | 'sticky' | 'image';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  color: string;
  strokeWidth: number;
  createdBy: string;
  createdAt: Date;
}

export interface WhiteboardState {
  meetingId: string;
  elements: WhiteboardElement[];
  cursors: Map<string, { x: number; y: number; updatedAt: Date }>;
  createdAt: Date;
}
