import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ISprint } from './schemas/sprint.schema';
import { ITask } from './schemas/task.schema';
import { IActivity } from './schemas/activity.schema';
import { CreateSprintDto, UpdateSprintDto } from './dto/board.dto';
import { NotificationService } from './notification.service';

@Injectable()
export class SprintService {
  private readonly logger = new Logger(SprintService.name);

  constructor(
    @InjectModel('Sprint') private sprintModel: Model<ISprint>,
    @InjectModel('Task') private taskModel: Model<ITask>,
    @InjectModel('Activity') private activityModel: Model<IActivity>,
    private notificationService: NotificationService,
  ) {}

  async createSprint(dto: CreateSprintDto, userId: string) {
    const sprint = new this.sprintModel({
      name: dto.name,
      boardId: dto.boardId,
      projectId: dto.projectId,
      goal: dto.goal || '',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      createdBy: userId,
    });
    await sprint.save();
    this.logger.log(`Sprint created: ${sprint._id} - ${dto.name}`);
    return sprint;
  }

  async getSprintsByBoard(boardId: string) {
    return this.sprintModel.find({ boardId }).sort({ createdAt: -1 });
  }

  async getSprintsByProject(projectId: string) {
    return this.sprintModel.find({ projectId }).sort({ createdAt: -1 });
  }

  async getSprint(sprintId: string) {
    const sprint = await this.sprintModel.findById(sprintId);
    if (!sprint) throw new NotFoundException('Sprint not found');
    return sprint;
  }

  async updateSprint(sprintId: string, dto: UpdateSprintDto) {
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.goal !== undefined) updateData.goal = dto.goal;
    if (dto.endDate !== undefined) updateData.endDate = new Date(dto.endDate);

    const sprint = await this.sprintModel.findByIdAndUpdate(
      sprintId,
      updateData,
      { new: true },
    );
    if (!sprint) throw new NotFoundException('Sprint not found');
    this.logger.log(`Sprint updated: ${sprintId}`);
    return sprint;
  }

  async startSprint(sprintId: string) {
    const sprint = await this.getSprint(sprintId);

    if (sprint.status !== 'planning') {
      throw new BadRequestException('Only sprints in planning status can be started');
    }

    // Validate only one active sprint per board
    const activeSprint = await this.sprintModel.findOne({
      boardId: sprint.boardId,
      status: 'active',
    });
    if (activeSprint) {
      throw new BadRequestException(
        `Board already has an active sprint: "${activeSprint.name}". Complete it first.`,
      );
    }

    sprint.status = 'active';
    if (!sprint.startDate) sprint.startDate = new Date();
    await sprint.save();
    this.logger.log(`Sprint started: ${sprintId}`);

    // Notify team members (unique assignees of sprint tasks)
    this.notifySprintTeam(sprint, 'started').catch((e) =>
      this.logger.error(`Failed to send sprint start notifications: ${e.message}`),
    );

    // Activity log
    this.logSprintActivity(sprint, 'sprint.started').catch(() => {});

    return sprint;
  }

  /**
   * Wave 1.2: Complete a sprint with full Jira-parity flow.
   * Supports moveUnfinishedTo: 'backlog' | 'next_sprint' | 'new_sprint'
   * forceCompleteIds: task IDs to mark done before velocity calculation
   */
  async completeSprint(
    sprintId: string,
    moveUnfinishedTo: string,
    options?: { newSprintName?: string; forceCompleteIds?: string[] },
  ) {
    const sprint = await this.getSprint(sprintId);

    if (sprint.status !== 'active') {
      throw new BadRequestException('Only active sprints can be completed');
    }

    // Force-complete selected items (mark as done before velocity calc)
    if (options?.forceCompleteIds?.length) {
      await this.taskModel.updateMany(
        { _id: { $in: options.forceCompleteIds }, sprintId },
        { status: 'done', completedAt: new Date() },
      );
    }

    // Calculate velocity: sum of story points of completed tasks
    const completedTasks = await this.taskModel.find({
      sprintId,
      status: 'done',
      isDeleted: false,
    });
    const velocity = completedTasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
    const completedPoints = velocity;

    // Find incomplete tasks
    const incompleteTasks = await this.taskModel.find({
      sprintId,
      status: { $nin: ['done', 'cancelled'] },
      isDeleted: false,
    });

    const incompleteTaskIds = incompleteTasks.map((t) => t._id.toString());
    const spilloverPoints = incompleteTasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
    const allTasks = await this.taskModel.find({ sprintId, isDeleted: false });
    const plannedPoints = allTasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);

    let nextSprintId: string | null = null;
    let newSprint: any = null;

    if (moveUnfinishedTo === 'backlog') {
      await this.taskModel.updateMany(
        { _id: { $in: incompleteTaskIds } },
        { sprintId: null, status: 'backlog' },
      );
    } else if (moveUnfinishedTo === 'next_sprint') {
      const nextSprint = await this.sprintModel.findOne({
        boardId: sprint.boardId,
        status: 'planning',
        _id: { $ne: sprintId },
      }).sort({ createdAt: 1 });

      if (!nextSprint) {
        throw new BadRequestException(
          'No planning sprint exists to move incomplete items to. ' +
          'Create a new sprint first, or use moveUnfinishedTo: "new_sprint".',
        );
      }

      nextSprintId = nextSprint._id.toString();
      const carryOverPoints = incompleteTasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);
      await this.taskModel.updateMany(
        { _id: { $in: incompleteTaskIds } },
        { sprintId: nextSprint._id.toString() },
      );
      nextSprint.taskIds.push(...incompleteTaskIds);
      (nextSprint as any).carryOverPoints = ((nextSprint as any).carryOverPoints || 0) + carryOverPoints;
      (nextSprint as any).carryOverTaskIds = [...((nextSprint as any).carryOverTaskIds || []), ...incompleteTaskIds];
      (nextSprint as any).carriedFromSprintId = sprintId;
      sprint.carryOverTaskIds = incompleteTaskIds as any;
      sprint.carryOverPoints = carryOverPoints as any;
      await nextSprint.save();
    } else if (moveUnfinishedTo === 'new_sprint') {
      // Wave 1.2: Create a new planning sprint and move incomplete items there
      const newSprintName = options?.newSprintName || `${sprint.name} (Carry-over)`;
      newSprint = new this.sprintModel({
        name: newSprintName,
        boardId: sprint.boardId,
        projectId: sprint.projectId,
        goal: `Carry-over items from ${sprint.name}`,
        status: 'planning',
        taskIds: incompleteTaskIds,
        carryOverTaskIds: incompleteTaskIds,
        carryOverPoints: spilloverPoints,
        carriedFromSprintId: sprintId,
        createdBy: sprint.createdBy,
      });
      await newSprint.save();
      nextSprintId = newSprint._id.toString();

      await this.taskModel.updateMany(
        { _id: { $in: incompleteTaskIds } },
        { sprintId: newSprint._id.toString() },
      );
      sprint.carryOverTaskIds = incompleteTaskIds as any;
      sprint.carryOverPoints = spilloverPoints as any;
    }

    sprint.status = 'completed';
    sprint.velocity = velocity;
    (sprint as any).completedPoints = completedPoints;
    (sprint as any).plannedPoints = plannedPoints;
    (sprint as any).spilloverPoints = spilloverPoints;
    (sprint as any).spilloverTaskIds = incompleteTaskIds;
    if (!sprint.endDate) sprint.endDate = new Date();
    (sprint as any).completedAt = new Date();
    await sprint.save();
    this.logger.log(`Sprint completed: ${sprintId}, velocity: ${velocity}sp, spillover: ${spilloverPoints}sp, action: ${moveUnfinishedTo}`);

    // Notify team members of sprint completion
    this.notifySprintTeam(
      sprint,
      'completed',
      `Completed ${completedTasks.length} items (${velocity} SP). ${incompleteTasks.length} items carried over.`,
    ).catch((e) =>
      this.logger.error(`Failed to send sprint completion notifications: ${e.message}`),
    );

    // Activity log
    this.logSprintActivity(sprint, 'sprint.completed', {
      velocity,
      completedCount: completedTasks.length,
      incompleteCount: incompleteTasks.length,
      moveUnfinishedTo,
    }).catch(() => {});

    return {
      sprint,
      velocity,
      completedCount: completedTasks.length,
      incompleteCount: incompleteTasks.length,
      movedToSprintId: nextSprintId,
      newSprint: newSprint || null,
    };
  }

  async addTasksToSprint(sprintId: string, taskIds: string[]) {
    const sprint = await this.getSprint(sprintId);

    // Add only new task IDs (avoid duplicates)
    const existingSet = new Set(sprint.taskIds);
    const newTaskIds = taskIds.filter((id) => !existingSet.has(id));

    if (newTaskIds.length > 0) {
      sprint.taskIds.push(...newTaskIds);
      await sprint.save();

      // Update tasks with sprintId
      await this.taskModel.updateMany(
        { _id: { $in: newTaskIds }, isDeleted: false },
        { sprintId: sprint._id.toString() },
      );
    }

    this.logger.log(`${newTaskIds.length} tasks added to sprint ${sprintId}`);
    return sprint;
  }

  async removeTaskFromSprint(sprintId: string, taskId: string) {
    const sprint = await this.getSprint(sprintId);

    sprint.taskIds = sprint.taskIds.filter((id) => id !== taskId);
    await sprint.save();

    await this.taskModel.findByIdAndUpdate(taskId, { sprintId: null });

    this.logger.log(`Task ${taskId} removed from sprint ${sprintId}`);
    return sprint;
  }

  async getActiveSprint(boardId: string) {
    const sprint = await this.sprintModel.findOne({ boardId, status: 'active' });
    return sprint;
  }

  async getSprintDetails(sprintId: string) {
    const sprint = await this.sprintModel.findById(sprintId);
    if (!sprint) throw new NotFoundException('Sprint not found');

    const tasks = await this.taskModel.find({ sprintId: sprintId });
    const done = tasks.filter(t => t.status === 'done');
    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const donePoints = done.reduce((s, t) => s + (t.storyPoints || 0), 0);

    // Get velocity context (last 5 completed sprints on same board)
    const completedSprints = await this.sprintModel.find({
      boardId: sprint.boardId,
      status: 'completed',
    }).sort({ updatedAt: -1 }).limit(5);

    const velocities = completedSprints.map(s => ({
      name: s.name,
      velocity: s.velocity || 0,
      id: s._id,
    }));
    const avgVelocity = velocities.length > 0
      ? Math.round(velocities.reduce((s, v) => s + v.velocity, 0) / velocities.length)
      : 0;

    return {
      sprint,
      tasks,
      stats: {
        totalTasks: tasks.length,
        doneTasks: done.length,
        totalPoints,
        donePoints,
        byStatus: {
          backlog: tasks.filter(t => t.status === 'backlog').length,
          todo: tasks.filter(t => t.status === 'todo').length,
          in_progress: tasks.filter(t => t.status === 'in_progress').length,
          in_review: tasks.filter(t => t.status === 'in_review').length,
          blocked: tasks.filter(t => t.status === 'blocked').length,
          done: done.length,
        },
      },
      velocity: { current: sprint.velocity || donePoints, history: velocities, average: avgVelocity },
    };
  }

  async getSprintBurndown(sprintId: string) {
    const sprint = await this.sprintModel.findById(sprintId);
    if (!sprint) throw new NotFoundException('Sprint not found');

    const tasks = await this.taskModel.find({ sprintId });
    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

    if (!sprint.startDate || !sprint.endDate) {
      return { totalPoints, dataPoints: [], idealLine: [] };
    }

    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);
    const now = new Date();
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);

    // Build daily data points
    const dataPoints = [];
    const idealLine = [];
    for (let i = 0; i <= totalDays; i++) {
      const day = new Date(start);
      day.setDate(day.getDate() + i);

      idealLine.push({ day: i, date: day.toISOString().split('T')[0], points: Math.round(totalPoints * (1 - i / totalDays)) });

      if (day <= now) {
        // Count done tasks whose updatedAt is before this day's end
        const dayEnd = new Date(day);
        dayEnd.setHours(23, 59, 59, 999);
        const doneByDay = tasks.filter(t => t.status === 'done' && new Date(t.updatedAt) <= dayEnd);
        const donePoints = doneByDay.reduce((s, t) => s + (t.storyPoints || 0), 0);
        dataPoints.push({ day: i, date: day.toISOString().split('T')[0], remaining: totalPoints - donePoints });
      }
    }

    return { totalPoints, dataPoints, idealLine };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async recordDailyBurndown() {
    const activeSprints = await this.sprintModel.find({ status: 'active' });
    for (const sprint of activeSprints) {
      if (!sprint.startDate || !sprint.endDate) continue;
      const tasks = await this.taskModel.find({ _id: { $in: sprint.taskIds }, isDeleted: false });
      const remaining = tasks
        .filter(t => t.status !== 'done' && t.status !== 'cancelled')
        .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const plannedPoints = (sprint as any).plannedPoints || tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
      const totalDays = Math.ceil((sprint.endDate.getTime() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(Math.ceil((Date.now() - sprint.startDate.getTime()) / (1000 * 60 * 60 * 24)), 0);
      const ideal = Math.max(0, Math.round(plannedPoints * (1 - daysElapsed / totalDays) * 100) / 100);
      if (!(sprint as any).burndownData) (sprint as any).burndownData = [];
      (sprint as any).burndownData.push({ day: new Date(), remaining, ideal });
      await sprint.save();
    }
    this.logger.log(`Daily burndown snapshot recorded for ${activeSprints.length} active sprint(s)`);
  }

  /**
   * Notify all unique assignees of sprint tasks about a sprint event.
   */
  private async notifySprintTeam(sprint: ISprint, event: 'started' | 'completed', details?: string) {
    const tasks = await this.taskModel.find({
      _id: { $in: sprint.taskIds },
      isDeleted: false,
      assigneeId: { $ne: null, $exists: true },
    });

    const uniqueAssignees = [...new Set(tasks.map((t) => t.assigneeId).filter(Boolean))];
    if (uniqueAssignees.length === 0) return;

    const actor = {
      userId: sprint.createdBy,
      userName: sprint.createdBy,
      userEmail: sprint.createdBy,
    };

    await this.notificationService.createSprintNotification({
      organizationId: sprint.organizationId,
      recipientIds: uniqueAssignees,
      projectId: sprint.projectId,
      sprintName: sprint.name,
      event,
      details,
      actor,
    });
  }

  private async logSprintActivity(sprint: ISprint, action: string, details?: Record<string, any>) {
    try {
      await this.activityModel.create({
        organizationId: sprint.organizationId,
        projectId: sprint.projectId,
        sprintId: sprint._id.toString(),
        action,
        actorId: sprint.createdBy,
        entityType: 'sprint',
        entityTitle: sprint.name,
        details: details || {},
      });
    } catch (e) {
      this.logger.warn(`Failed to log sprint activity: ${e.message}`);
    }
  }
}
