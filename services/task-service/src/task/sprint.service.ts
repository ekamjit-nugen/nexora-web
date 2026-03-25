import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ISprint } from './schemas/sprint.schema';
import { ITask } from './schemas/task.schema';
import { CreateSprintDto, UpdateSprintDto } from './dto/board.dto';

@Injectable()
export class SprintService {
  private readonly logger = new Logger(SprintService.name);

  constructor(
    @InjectModel('Sprint') private sprintModel: Model<ISprint>,
    @InjectModel('Task') private taskModel: Model<ITask>,
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
    return sprint;
  }

  async completeSprint(sprintId: string, moveUnfinishedTo: string) {
    const sprint = await this.getSprint(sprintId);

    if (sprint.status !== 'active') {
      throw new BadRequestException('Only active sprints can be completed');
    }

    // Calculate velocity: sum of story points of completed tasks
    const completedTasks = await this.taskModel.find({
      _id: { $in: sprint.taskIds },
      status: 'done',
      isDeleted: false,
    });
    const velocity = completedTasks.reduce((sum, t) => sum + ((t as any).storyPoints || 0), 0);

    // Find incomplete tasks
    const incompleteTasks = await this.taskModel.find({
      _id: { $in: sprint.taskIds },
      status: { $ne: 'done' },
      isDeleted: false,
    });

    const incompleteTaskIds = incompleteTasks.map((t) => t._id.toString());

    if (moveUnfinishedTo === 'backlog') {
      // Move incomplete tasks back to backlog
      await this.taskModel.updateMany(
        { _id: { $in: incompleteTaskIds } },
        { sprintId: null, status: 'backlog' },
      );
    } else if (moveUnfinishedTo === 'next_sprint') {
      // Find or check for the next planning sprint on this board
      const nextSprint = await this.sprintModel.findOne({
        boardId: sprint.boardId,
        status: 'planning',
        _id: { $ne: sprintId },
      }).sort({ createdAt: 1 });

      if (nextSprint) {
        // Move tasks to next sprint
        await this.taskModel.updateMany(
          { _id: { $in: incompleteTaskIds } },
          { sprintId: nextSprint._id.toString() },
        );
        nextSprint.taskIds.push(...incompleteTaskIds);
        await nextSprint.save();
      } else {
        // No next sprint — move to backlog as fallback
        await this.taskModel.updateMany(
          { _id: { $in: incompleteTaskIds } },
          { sprintId: null, status: 'backlog' },
        );
      }
    }

    sprint.status = 'completed';
    sprint.velocity = velocity;
    await sprint.save();
    this.logger.log(`Sprint completed: ${sprintId}, velocity: ${velocity}`);
    return sprint;
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
}
