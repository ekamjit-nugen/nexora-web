import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IMeeting, IRecurrencePattern } from './schemas/meeting.schema';

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    @InjectModel('Meeting', 'nexora_calling') private meetingModel: Model<IMeeting>,
  ) {}

  /**
   * Calculate the next N occurrence dates from a recurrence pattern.
   */
  getNextOccurrences(pattern: IRecurrencePattern, startDate: Date, count: number = 10): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);
    let iterations = 0;
    const maxIterations = 365; // safety limit

    while (dates.length < count && iterations < maxIterations) {
      iterations++;

      switch (pattern.frequency) {
        case 'daily':
          current.setDate(current.getDate() + pattern.interval);
          break;
        case 'weekly':
          if (pattern.daysOfWeek?.length) {
            const dayMap: Record<string, number> = {
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
              thursday: 4, friday: 5, saturday: 6,
            };
            current.setDate(current.getDate() + 1);
            while (!pattern.daysOfWeek.includes(
              Object.keys(dayMap).find(k => dayMap[k] === current.getDay()) || '',
            )) {
              current.setDate(current.getDate() + 1);
              if (iterations++ > maxIterations) break;
            }
          } else {
            current.setDate(current.getDate() + 7 * pattern.interval);
          }
          break;
        case 'monthly':
          current.setMonth(current.getMonth() + pattern.interval);
          if (pattern.dayOfMonth) {
            current.setDate(Math.min(pattern.dayOfMonth, new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate()));
          }
          break;
        case 'yearly':
          current.setFullYear(current.getFullYear() + pattern.interval);
          break;
        default:
          return dates;
      }

      // Check end conditions
      if (pattern.endType === 'on_date' && pattern.endDate && current > new Date(pattern.endDate)) break;
      if (pattern.endType === 'after' && pattern.endAfterOccurrences && dates.length >= pattern.endAfterOccurrences) break;

      // Skip exceptions
      const isException = pattern.exceptions?.some(ex =>
        new Date(ex).toDateString() === current.toDateString(),
      );
      if (!isException) {
        dates.push(new Date(current));
      }
    }

    return dates;
  }

  /**
   * Check if a meeting is recurring and generate next occurrence info.
   */
  async getNextOccurrence(meetingId: string): Promise<Date | null> {
    const meeting = await this.meetingModel.findOne({ meetingId, type: 'recurring' });
    if (!meeting?.recurrence?.frequency) return null;

    const occurrences = this.getNextOccurrences(meeting.recurrence as IRecurrencePattern, meeting.scheduledAt, 1);
    return occurrences[0] || null;
  }

  /**
   * Update recurrence pattern on a meeting.
   */
  async setRecurrence(meetingId: string, recurrence: IRecurrencePattern): Promise<IMeeting | null> {
    return this.meetingModel.findOneAndUpdate(
      { meetingId },
      { $set: { recurrence, type: 'recurring' } },
      { new: true },
    );
  }

  /**
   * Cancel a single occurrence (add to exceptions list).
   */
  async cancelOccurrence(meetingId: string, date: Date): Promise<IMeeting | null> {
    return this.meetingModel.findOneAndUpdate(
      { meetingId },
      { $push: { 'recurrence.exceptions': date } },
      { new: true },
    );
  }
}
