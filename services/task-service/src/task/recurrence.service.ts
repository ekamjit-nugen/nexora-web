import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { ITask } from './schemas/task.schema';
import { ICounter } from './schemas/counter.schema';
import { SetRecurrenceDto } from './dto/index';

@Injectable()
export class RecurrenceService {
  private readonly logger = new Logger(RecurrenceService.name);

  constructor(
    @InjectModel('Task') private taskModel: Model<ITask>,
    @InjectModel('Counter') private counterModel: Model<ICounter>,
  ) {}

  /**
   * Build an RRULE string from frequency settings.
   */
  private buildRRule(dto: SetRecurrenceDto): string {
    const interval = dto.interval || 1;
    switch (dto.frequency) {
      case 'daily':
        return `FREQ=DAILY;INTERVAL=${interval}`;
      case 'weekly': {
        const days = (dto.daysOfWeek || [1]).map(d => ['SU','MO','TU','WE','TH','FR','SA'][d]).join(',');
        return `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${days}`;
      }
      case 'biweekly': {
        const bwDays = (dto.daysOfWeek || [1]).map(d => ['SU','MO','TU','WE','TH','FR','SA'][d]).join(',');
        return `FREQ=WEEKLY;INTERVAL=2;BYDAY=${bwDays}`;
      }
      case 'monthly':
        return `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${dto.dayOfMonth || 1}`;
      case 'quarterly':
        return `FREQ=MONTHLY;INTERVAL=${interval * 3}`;
      case 'custom':
        return dto.rule || `FREQ=DAILY;INTERVAL=${interval}`;
      default:
        return `FREQ=DAILY;INTERVAL=1`;
    }
  }

  /**
   * Calculate the next due date based on recurrence settings relative to a reference date.
   */
  private getNextDueDate(task: ITask): Date | null {
    const rec = task.recurrence;
    if (!rec || !rec.enabled || !rec.frequency) return null;

    const ref = rec.lastGeneratedAt ? new Date(rec.lastGeneratedAt) : new Date();
    const interval = rec.interval || 1;

    switch (rec.frequency) {
      case 'daily': {
        const next = new Date(ref);
        next.setDate(next.getDate() + interval);
        return next;
      }
      case 'weekly': {
        const next = new Date(ref);
        next.setDate(next.getDate() + (7 * interval));
        return next;
      }
      case 'biweekly': {
        const next = new Date(ref);
        next.setDate(next.getDate() + 14);
        return next;
      }
      case 'monthly': {
        const next = new Date(ref);
        next.setMonth(next.getMonth() + interval);
        if (rec.dayOfMonth) {
          next.setDate(Math.min(rec.dayOfMonth, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
        }
        return next;
      }
      case 'quarterly': {
        const next = new Date(ref);
        next.setMonth(next.getMonth() + (3 * interval));
        return next;
      }
      case 'custom': {
        // For custom rules, default to interval days
        const next = new Date(ref);
        next.setDate(next.getDate() + interval);
        return next;
      }
      default:
        return null;
    }
  }

  private async getNextTaskKey(projectId: string, projectKey: string): Promise<string> {
    const prefix = projectKey || projectId.slice(-4).toUpperCase();
    const counter = await this.counterModel.findByIdAndUpdate(
      `taskseq_${projectId}`,
      { $inc: { sequence: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return `${prefix}-${counter.sequence}`;
  }

  /**
   * Create a single recurring instance from a template task.
   */
  async createRecurringInstance(template: ITask): Promise<ITask> {
    const taskKey = await this.getNextTaskKey(
      template.projectId,
      template.taskKey?.split('-')[0] || '',
    );

    const nextDue = this.getNextDueDate(template);

    const instance = new this.taskModel({
      organizationId: template.organizationId,
      taskKey,
      title: template.title,
      description: template.description,
      projectId: template.projectId,
      parentTaskId: template.parentTaskId,
      type: template.type,
      status: 'todo',
      priority: template.priority,
      assigneeId: template.assigneeId,
      reporterId: template.reporterId,
      storyPoints: template.storyPoints,
      dueDate: nextDue,
      labels: template.labels || [],
      estimatedHours: template.estimatedHours,
      loggedHours: 0,
      boardId: template.boardId,
      components: template.components,
      fixVersion: template.fixVersion,
      environment: template.environment,
      originalEstimate: template.originalEstimate,
      remainingEstimate: template.remainingEstimate,
      isRecurringInstance: true,
      recurringParentId: template._id.toString(),
      createdBy: template.createdBy,
      comments: [],
      timeEntries: [],
      attachments: [],
      dependencies: [],
      statusHistory: [],
      watchers: template.watchers || [],
    });

    const saved = await instance.save();
    this.logger.log(`Recurring instance created: ${saved.taskKey} from template ${template.taskKey || template._id}`);
    return saved;
  }

  /**
   * Check if a recurring template is due for a new instance.
   */
  private isDueForGeneration(task: ITask): boolean {
    const rec = task.recurrence;
    if (!rec || !rec.enabled || !rec.frequency) return false;

    // Check max occurrences
    if (rec.maxOccurrences && (rec.occurrenceCount || 0) >= rec.maxOccurrences) return false;

    // Check end date
    if (rec.endDate && new Date() > new Date(rec.endDate)) return false;

    const nextDue = this.getNextDueDate(task);
    if (!nextDue) return false;

    return new Date() >= nextDue;
  }

  /**
   * Cron job: runs every hour to generate due recurring task instances.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async generateDueInstances(): Promise<{ generated: number }> {
    this.logger.log('Running recurring task generation check...');

    const templates = await this.taskModel.find({
      'recurrence.enabled': true,
      isDeleted: false,
      isRecurringInstance: { $ne: true },
    });

    let generated = 0;

    for (const template of templates) {
      try {
        if (!this.isDueForGeneration(template)) continue;

        await this.createRecurringInstance(template);

        // Update template metadata
        await this.taskModel.findByIdAndUpdate(template._id, {
          $set: { 'recurrence.lastGeneratedAt': new Date() },
          $inc: { 'recurrence.occurrenceCount': 1 },
        });

        generated++;

        // Check if we should auto-disable after hitting max
        const rec = template.recurrence;
        if (rec?.maxOccurrences && (rec.occurrenceCount || 0) + 1 >= rec.maxOccurrences) {
          await this.taskModel.findByIdAndUpdate(template._id, {
            $set: { 'recurrence.enabled': false },
          });
          this.logger.log(`Recurrence disabled for ${template.taskKey} - max occurrences reached`);
        }

        // Check if end date has been reached
        if (rec?.endDate && new Date() >= new Date(rec.endDate)) {
          await this.taskModel.findByIdAndUpdate(template._id, {
            $set: { 'recurrence.enabled': false },
          });
          this.logger.log(`Recurrence disabled for ${template.taskKey} - end date reached`);
        }
      } catch (error) {
        this.logger.error(`Failed to generate instance for template ${template._id}: ${error.message}`);
      }
    }

    this.logger.log(`Recurring task generation complete. Generated ${generated} instances.`);
    return { generated };
  }

  /**
   * Set or update recurrence rule on a task.
   */
  async setRecurrence(taskId: string, dto: SetRecurrenceDto, orgId?: string): Promise<ITask> {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const task = await this.taskModel.findOne(filter);
    if (!task) throw new NotFoundException('Task not found');

    const rule = dto.rule || this.buildRRule(dto);

    const updated = await this.taskModel.findOneAndUpdate(
      filter,
      {
        $set: {
          'recurrence.enabled': true,
          'recurrence.rule': rule,
          'recurrence.frequency': dto.frequency,
          'recurrence.interval': dto.interval || 1,
          'recurrence.daysOfWeek': dto.daysOfWeek || [],
          'recurrence.dayOfMonth': dto.dayOfMonth || null,
          'recurrence.endDate': dto.endDate ? new Date(dto.endDate) : null,
          'recurrence.maxOccurrences': dto.maxOccurrences || null,
          'recurrence.lastGeneratedAt': task.recurrence?.lastGeneratedAt || new Date(),
        },
      },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Task not found');
    this.logger.log(`Recurrence set on task ${updated.taskKey || updated._id}: ${rule}`);
    return updated;
  }

  /**
   * Stop recurrence on a task.
   */
  async stopRecurrence(taskId: string, orgId?: string): Promise<ITask> {
    const filter: any = { _id: taskId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const updated = await this.taskModel.findOneAndUpdate(
      filter,
      { $set: { 'recurrence.enabled': false } },
      { new: true },
    );

    if (!updated) throw new NotFoundException('Task not found');
    this.logger.log(`Recurrence stopped on task ${updated.taskKey || updated._id}`);
    return updated;
  }

  /**
   * List all recurring task templates in a project.
   */
  async getRecurringTasks(projectId: string, orgId?: string): Promise<ITask[]> {
    const filter: any = {
      'recurrence.enabled': true,
      isDeleted: false,
      isRecurringInstance: { $ne: true },
    };
    if (projectId) filter.projectId = projectId;
    if (orgId) filter.organizationId = orgId;

    return this.taskModel.find(filter).sort({ createdAt: -1 });
  }

  /**
   * Get all generated instances for a recurring template.
   */
  async getRecurringInstances(templateId: string, orgId?: string): Promise<ITask[]> {
    const filter: any = {
      recurringParentId: templateId,
      isDeleted: false,
    };
    if (orgId) filter.organizationId = orgId;

    return this.taskModel.find(filter).sort({ createdAt: -1 });
  }
}
