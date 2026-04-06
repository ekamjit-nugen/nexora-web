import { Injectable, Logger, NotFoundException, Inject, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IReminder } from './schemas/reminder.schema';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectModel('Reminder') private reminderModel: Model<IReminder>,
    @Optional() @Inject('BULLMQ_CONNECTION') private readonly connection: any,
  ) {
    this.initProcessor();
  }

  private async initProcessor() {
    if (!this.connection) return;
    try {
      const { Queue, Worker } = await (Function('return import("bullmq")')());
      const queue = new Queue('reminders', { connection: this.connection });
      new Worker('reminders', async () => {
        await this.processDueReminders();
      }, { connection: this.connection, concurrency: 1 });

      await queue.add('check-due', {}, { repeat: { every: 60000 }, removeOnComplete: 5 });
      this.logger.log('Reminders processor started (every 60s)');
    } catch { /* BullMQ not available */ }
  }

  async createReminder(userId: string, messageId: string, conversationId: string, reminderAt: Date, note?: string) {
    const reminder = new this.reminderModel({ userId, messageId, conversationId, reminderAt, note });
    await reminder.save();
    this.logger.log(`Reminder created for ${userId}: message ${messageId} at ${reminderAt.toISOString()}`);
    return reminder;
  }

  async getReminders(userId: string) {
    return this.reminderModel.find({ userId, status: 'pending', reminderAt: { $gt: new Date() } })
      .sort({ reminderAt: 1 }).lean();
  }

  async cancelReminder(reminderId: string, userId: string) {
    const reminder = await this.reminderModel.findOne({ _id: reminderId, userId });
    if (!reminder) throw new NotFoundException('Reminder not found');
    reminder.status = 'cancelled';
    await reminder.save();
  }

  async processDueReminders(): Promise<number> {
    const due = await this.reminderModel.find({ status: 'pending', reminderAt: { $lte: new Date() } });
    for (const reminder of due) {
      reminder.status = 'sent';
      await reminder.save();
      // In production: emit notification via Redis pub/sub
      this.logger.log(`Reminder fired for ${reminder.userId}: message ${reminder.messageId}`);
    }
    return due.length;
  }
}
