import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';

/**
 * Calendar Integration Service.
 *
 * Phase 1 (built-in): Nexora's own meeting calendar view.
 * Phase 2 (external): Google Calendar + Outlook two-way sync via OAuth.
 *
 * This service provides:
 * - Meeting calendar view data (day/week/month)
 * - ICS file generation for export
 * - Stubs for Google Calendar and Outlook integration
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  async getMeetingsForDateRange(userId: string, organizationId: string, start: Date, end: Date) {
    return this.meetingModel.find({
      organizationId,
      $or: [
        { hostId: userId },
        { participantIds: userId },
      ],
      scheduledAt: { $gte: start, $lte: end },
      status: { $ne: 'cancelled' },
    }).sort({ scheduledAt: 1 }).lean();
  }

  async getMeetingsForDay(userId: string, organizationId: string, date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return this.getMeetingsForDateRange(userId, organizationId, start, end);
  }

  async getMeetingsForWeek(userId: string, organizationId: string, weekStart: Date) {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 7);
    return this.getMeetingsForDateRange(userId, organizationId, weekStart, end);
  }

  async getMeetingsForMonth(userId: string, organizationId: string, year: number, month: number) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
    return this.getMeetingsForDateRange(userId, organizationId, start, end);
  }

  /**
   * Generate ICS (iCalendar) content for a meeting.
   */
  generateICS(meeting: IMeeting): string {
    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);

    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Nexora//Meetings//EN',
      'BEGIN:VEVENT',
      `DTSTART:${formatDate(start)}`,
      `DTEND:${formatDate(end)}`,
      `SUMMARY:${meeting.title}`,
      meeting.description ? `DESCRIPTION:${meeting.description.replace(/\n/g, '\\n')}` : '',
      `UID:${meeting.meetingId}@nexora.io`,
      `ORGANIZER:${meeting.hostName || 'Host'}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');
  }

  // ── Google Calendar Stub (Phase 2) ──

  async syncToGoogleCalendar(_meetingId: string, _accessToken: string): Promise<void> {
    this.logger.debug('Google Calendar sync: stub — implement with googleapis');
  }

  // ── Outlook Stub (Phase 2) ──

  async syncToOutlook(_meetingId: string, _accessToken: string): Promise<void> {
    this.logger.debug('Outlook sync: stub — implement with @microsoft/microsoft-graph-client');
  }
}
