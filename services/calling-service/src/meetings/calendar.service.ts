import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting } from './schemas/meeting.schema';

/**
 * Calendar Integration Service.
 *
 * Phase 1 (built-in): Nexora's own meeting calendar view.
 * Phase 2 (external): Google Calendar + Outlook two-way sync via OAuth.
 */
@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectModel('Meeting') private meetingModel: Model<IMeeting>,
  ) {}

  // ── Nexora Calendar Queries ──

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

  // ── Google Calendar Integration ──

  /**
   * Create a Google Calendar event for a meeting.
   * Requires a valid OAuth2 access token from the user.
   */
  async syncToGoogleCalendar(meetingId: string, accessToken: string): Promise<{ eventId: string } | null> {
    const meeting = await this.meetingModel.findOne({ meetingId }).lean();
    if (!meeting) {
      this.logger.warn(`syncToGoogleCalendar: meeting ${meetingId} not found`);
      return null;
    }

    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);

    const event = {
      summary: meeting.title,
      description: this.buildCalendarDescription(meeting),
      start: {
        dateTime: start.toISOString(),
        timeZone: meeting.timeZone || 'UTC',
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: meeting.timeZone || 'UTC',
      },
      conferenceData: {
        conferenceSolution: { key: { type: 'addOn' }, name: 'Nexora Meeting' },
        entryPoints: [{ entryPointType: 'video', uri: `${process.env.FRONTEND_URL || 'https://app.nexora.io'}/meetings/${meeting.meetingId}`, label: 'Join Nexora Meeting' }],
      },
    };

    try {
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Google Calendar API error: ${response.status} ${error}`);
        return null;
      }

      const created = (await response.json()) as { id: string };
      this.logger.log(`Meeting ${meetingId} synced to Google Calendar: eventId=${created.id}`);

      // Store the external event ID for future updates/deletes
      await this.meetingModel.updateOne(
        { meetingId },
        { $set: { 'externalCalendar.google.eventId': created.id } },
      );

      return { eventId: created.id };
    } catch (err: any) {
      this.logger.error(`Google Calendar sync failed for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Update an existing Google Calendar event when a meeting is rescheduled.
   */
  async updateGoogleCalendarEvent(meetingId: string, accessToken: string, googleEventId: string): Promise<boolean> {
    const meeting = await this.meetingModel.findOne({ meetingId }).lean();
    if (!meeting) return false;

    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);

    const event = {
      summary: meeting.title,
      description: this.buildCalendarDescription(meeting),
      start: { dateTime: start.toISOString(), timeZone: meeting.timeZone || 'UTC' },
      end: { dateTime: end.toISOString(), timeZone: meeting.timeZone || 'UTC' },
    };

    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      );

      if (!response.ok) {
        this.logger.error(`Google Calendar update failed: ${response.status}`);
        return false;
      }

      this.logger.log(`Google Calendar event ${googleEventId} updated for meeting ${meetingId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Google Calendar update error: ${err.message}`);
      return false;
    }
  }

  /**
   * Delete a Google Calendar event when a meeting is cancelled.
   */
  async deleteGoogleCalendarEvent(accessToken: string, googleEventId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok && response.status !== 410) {
        this.logger.error(`Google Calendar delete failed: ${response.status}`);
        return false;
      }

      this.logger.log(`Google Calendar event ${googleEventId} deleted`);
      return true;
    } catch (err: any) {
      this.logger.error(`Google Calendar delete error: ${err.message}`);
      return false;
    }
  }

  // ── Microsoft Outlook / Graph API Integration ──

  /**
   * Create an Outlook calendar event for a meeting.
   * Requires a valid Microsoft Graph API access token.
   */
  async syncToOutlook(meetingId: string, accessToken: string): Promise<{ eventId: string } | null> {
    const meeting = await this.meetingModel.findOne({ meetingId }).lean();
    if (!meeting) {
      this.logger.warn(`syncToOutlook: meeting ${meetingId} not found`);
      return null;
    }

    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);

    const event = {
      subject: meeting.title,
      body: {
        contentType: 'HTML',
        content: this.buildCalendarDescriptionHtml(meeting),
      },
      start: {
        dateTime: start.toISOString().replace('Z', ''),
        timeZone: meeting.timeZone || 'UTC',
      },
      end: {
        dateTime: end.toISOString().replace('Z', ''),
        timeZone: meeting.timeZone || 'UTC',
      },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'unknown',
    };

    try {
      const response = await fetch(
        'https://graph.microsoft.com/v1.0/me/events',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`Outlook Calendar API error: ${response.status} ${error}`);
        return null;
      }

      const created = (await response.json()) as { id: string };
      this.logger.log(`Meeting ${meetingId} synced to Outlook: eventId=${created.id}`);

      await this.meetingModel.updateOne(
        { meetingId },
        { $set: { 'externalCalendar.outlook.eventId': created.id } },
      );

      return { eventId: created.id };
    } catch (err: any) {
      this.logger.error(`Outlook sync failed for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Update an existing Outlook calendar event.
   */
  async updateOutlookEvent(meetingId: string, accessToken: string, outlookEventId: string): Promise<boolean> {
    const meeting = await this.meetingModel.findOne({ meetingId }).lean();
    if (!meeting) return false;

    const start = new Date(meeting.scheduledAt);
    const end = new Date(start.getTime() + (meeting.durationMinutes || 60) * 60000);

    const event = {
      subject: meeting.title,
      body: { contentType: 'HTML', content: this.buildCalendarDescriptionHtml(meeting) },
      start: { dateTime: start.toISOString().replace('Z', ''), timeZone: meeting.timeZone || 'UTC' },
      end: { dateTime: end.toISOString().replace('Z', ''), timeZone: meeting.timeZone || 'UTC' },
    };

    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(event),
        },
      );

      if (!response.ok) {
        this.logger.error(`Outlook update failed: ${response.status}`);
        return false;
      }

      this.logger.log(`Outlook event ${outlookEventId} updated for meeting ${meetingId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Outlook update error: ${err.message}`);
      return false;
    }
  }

  /**
   * Delete an Outlook calendar event.
   */
  async deleteOutlookEvent(accessToken: string, outlookEventId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://graph.microsoft.com/v1.0/me/events/${outlookEventId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );

      if (!response.ok && response.status !== 404) {
        this.logger.error(`Outlook delete failed: ${response.status}`);
        return false;
      }

      this.logger.log(`Outlook event ${outlookEventId} deleted`);
      return true;
    } catch (err: any) {
      this.logger.error(`Outlook delete error: ${err.message}`);
      return false;
    }
  }

  // ── Helpers ──

  private buildCalendarDescription(meeting: any): string {
    const meetingUrl = `${process.env.FRONTEND_URL || 'https://app.nexora.io'}/meetings/${meeting.meetingId}`;
    const lines = [
      meeting.description || '',
      '',
      `Join Nexora Meeting: ${meetingUrl}`,
      meeting.joinPassword ? `Password: ${meeting.joinPassword}` : '',
      `Meeting ID: ${meeting.meetingId}`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  private buildCalendarDescriptionHtml(meeting: any): string {
    const meetingUrl = `${process.env.FRONTEND_URL || 'https://app.nexora.io'}/meetings/${meeting.meetingId}`;
    return `
      <p>${meeting.description || ''}</p>
      <p><strong>Join Nexora Meeting:</strong> <a href="${meetingUrl}">${meetingUrl}</a></p>
      ${meeting.joinPassword ? `<p><strong>Password:</strong> ${meeting.joinPassword}</p>` : ''}
      <p><strong>Meeting ID:</strong> ${meeting.meetingId}</p>
    `.trim();
  }
}
