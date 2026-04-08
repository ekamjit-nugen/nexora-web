import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITask } from './schemas/task.schema';
import { ISprint } from './schemas/sprint.schema';

@Injectable()
export class TaskReportingService {
  private readonly logger = new Logger(TaskReportingService.name);

  constructor(
    @InjectModel('Task') private taskModel: Model<ITask>,
    @InjectModel('Sprint') private sprintModel: Model<ISprint>,
  ) {}

  /**
   * Velocity Chart — Per-sprint committed vs completed story points
   */
  async getVelocityData(projectId: string) {
    const sprints = await this.sprintModel
      .find({ projectId })
      .sort({ startDate: 1 })
      .lean();

    if (!sprints.length) {
      return { sprints: [] };
    }

    const result = [];
    for (const sprint of sprints) {
      const sprintTasks = await this.taskModel
        .find({ projectId, sprintId: sprint._id.toString(), isDeleted: false })
        .lean();

      const planned = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const completed = sprintTasks
        .filter((t) => t.status === 'done')
        .reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const carryOver = sprint.carryOverPoints || 0;

      result.push({
        sprintId: sprint._id.toString(),
        sprintName: sprint.name,
        planned,
        completed,
        carryOver,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
        status: sprint.status,
      });
    }

    return { sprints: result };
  }

  /**
   * Cumulative Flow Diagram — Task count per status over time
   */
  async getCumulativeFlowData(projectId: string, fromDate: Date, toDate: Date) {
    const tasks = await this.taskModel
      .find({
        projectId,
        isDeleted: false,
        createdAt: { $lte: toDate },
      })
      .select('status statusHistory createdAt')
      .lean();

    const statuses = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];
    const statusColors: Record<string, string> = {
      backlog: '#94A3B8',
      todo: '#e5e7eb',
      in_progress: '#3b82f6',
      in_review: '#f59e0b',
      done: '#10b981',
    };

    const dates: string[] = [];
    const current = new Date(fromDate);
    while (current <= toDate) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // For each date, determine the status of each task at that point in time
    const columns = statuses.map((status) => ({
      name: status,
      color: statusColors[status],
      counts: [] as number[],
    }));

    for (const dateStr of dates) {
      const asOfDate = new Date(dateStr + 'T23:59:59.999Z');
      const statusCounts: Record<string, number> = {};
      statuses.forEach((s) => (statusCounts[s] = 0));

      for (const task of tasks) {
        // Skip tasks created after this date
        if (new Date(task.createdAt) > asOfDate) continue;

        // Determine status at this date by walking statusHistory
        let statusAtDate = 'backlog'; // default
        if (task.statusHistory && task.statusHistory.length > 0) {
          // Find the last status change before or on this date
          const sorted = [...task.statusHistory].sort(
            (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
          );
          for (const entry of sorted) {
            if (new Date(entry.changedAt) <= asOfDate) {
              statusAtDate = entry.status;
            }
          }
        } else {
          statusAtDate = task.status;
        }

        // Map to one of our tracked statuses
        if (statuses.includes(statusAtDate)) {
          statusCounts[statusAtDate]++;
        } else {
          statusCounts['backlog']++;
        }
      }

      for (const col of columns) {
        col.counts.push(statusCounts[col.name]);
      }
    }

    return { dates, columns };
  }

  /**
   * Cycle Time Analysis — Time from in_progress to done
   */
  async getCycleTimeData(projectId: string) {
    const completedTasks = await this.taskModel
      .find({
        projectId,
        isDeleted: false,
        status: 'done',
        'statusHistory.0': { $exists: true },
      })
      .select('taskKey title statusHistory completedAt storyPoints')
      .lean();

    const taskCycleTimes: Array<{
      key: string;
      title: string;
      completedDate: Date;
      cycleTimeDays: number;
      storyPoints: number;
    }> = [];

    for (const task of completedTasks) {
      if (!task.statusHistory || task.statusHistory.length === 0) continue;

      const sorted = [...task.statusHistory].sort(
        (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
      );

      // Find when task first moved to in_progress
      const startEntry = sorted.find((e) => e.status === 'in_progress');
      // Find when task moved to done
      const endEntry = [...sorted].reverse().find((e) => e.status === 'done');

      if (startEntry && endEntry) {
        const startTime = new Date(startEntry.changedAt).getTime();
        const endTime = new Date(endEntry.changedAt).getTime();
        const cycleTimeDays = Math.max(0.1, (endTime - startTime) / (1000 * 60 * 60 * 24));

        taskCycleTimes.push({
          key: task.taskKey || task._id.toString(),
          title: task.title,
          completedDate: new Date(endEntry.changedAt),
          cycleTimeDays: Math.round(cycleTimeDays * 10) / 10,
          storyPoints: task.storyPoints || 0,
        });
      }
    }

    if (taskCycleTimes.length === 0) {
      return {
        tasks: [],
        average: 0,
        median: 0,
        p90: 0,
        distribution: [],
      };
    }

    const cycleTimes = taskCycleTimes.map((t) => t.cycleTimeDays).sort((a, b) => a - b);

    const average = Math.round((cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length) * 10) / 10;
    const median =
      cycleTimes.length % 2 === 0
        ? Math.round(((cycleTimes[cycleTimes.length / 2 - 1] + cycleTimes[cycleTimes.length / 2]) / 2) * 10) / 10
        : cycleTimes[Math.floor(cycleTimes.length / 2)];
    const p90Index = Math.ceil(cycleTimes.length * 0.9) - 1;
    const p90 = cycleTimes[Math.min(p90Index, cycleTimes.length - 1)];

    // Build distribution buckets
    const buckets = [
      { range: '0-1 days', min: 0, max: 1 },
      { range: '1-3 days', min: 1, max: 3 },
      { range: '3-5 days', min: 3, max: 5 },
      { range: '5-10 days', min: 5, max: 10 },
      { range: '10-20 days', min: 10, max: 20 },
      { range: '20+ days', min: 20, max: Infinity },
    ];

    const distribution = buckets.map((b) => ({
      range: b.range,
      count: cycleTimes.filter((ct) => ct >= b.min && ct < b.max).length,
    }));

    return {
      tasks: taskCycleTimes.sort(
        (a, b) => new Date(b.completedDate).getTime() - new Date(a.completedDate).getTime(),
      ),
      average,
      median,
      p90,
      distribution,
    };
  }

  /**
   * Burndown Chart — For a specific sprint
   */
  async getBurndownData(projectId: string, sprintId: string) {
    const sprint = await this.sprintModel.findById(sprintId).lean();
    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // If sprint has pre-computed burndown data, use it
    if (sprint.burndownData && sprint.burndownData.length > 0) {
      return {
        sprintName: sprint.name,
        days: sprint.burndownData.map((d) => ({
          date: new Date(d.day).toISOString().split('T')[0],
          ideal: d.ideal,
          actual: d.remaining,
        })),
      };
    }

    // Otherwise compute from task data
    const sprintTasks = await this.taskModel
      .find({
        projectId,
        sprintId: sprintId,
        isDeleted: false,
      })
      .select('storyPoints status statusHistory completedAt')
      .lean();

    const totalPoints = sprintTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const startDate = sprint.startDate ? new Date(sprint.startDate) : new Date();
    const endDate = sprint.endDate ? new Date(sprint.endDate) : new Date();
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

    const days: Array<{ date: string; ideal: number; actual: number }> = [];
    const today = new Date();

    for (let i = 0; i <= totalDays; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      const dayStr = dayDate.toISOString().split('T')[0];

      // Ideal: linear from totalPoints to 0
      const ideal = Math.round((totalPoints * (totalDays - i)) / totalDays * 10) / 10;

      // Actual: total points minus points completed by this day
      let completedByDay = 0;
      if (dayDate <= today) {
        for (const task of sprintTasks) {
          if (!task.statusHistory || task.statusHistory.length === 0) {
            if (task.status === 'done' && task.completedAt && new Date(task.completedAt) <= dayDate) {
              completedByDay += task.storyPoints || 0;
            }
            continue;
          }

          // Check if task was done by this day using statusHistory
          const sorted = [...task.statusHistory].sort(
            (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
          );
          let statusAtDay = 'backlog';
          for (const entry of sorted) {
            if (new Date(entry.changedAt) <= dayDate) {
              statusAtDay = entry.status;
            }
          }
          if (statusAtDay === 'done') {
            completedByDay += task.storyPoints || 0;
          }
        }
      }

      const actual = dayDate <= today ? totalPoints - completedByDay : undefined;

      days.push({
        date: dayStr,
        ideal,
        actual: actual !== undefined ? actual : null as any,
      });
    }

    return {
      sprintName: sprint.name,
      totalPoints,
      days,
    };
  }

  /**
   * Team Workload — Hours logged and task distribution per team member
   */
  async getTeamWorkloadData(projectId: string) {
    const tasks = await this.taskModel
      .find({ projectId, isDeleted: false })
      .select('assigneeId storyPoints estimatedHours loggedHours status timeEntries')
      .lean();

    const memberMap = new Map<
      string,
      {
        userId: string;
        logged: number;
        estimated: number;
        taskCount: number;
        completedTasks: number;
        totalPoints: number;
      }
    >();

    for (const task of tasks) {
      if (!task.assigneeId) continue;

      const entry = memberMap.get(task.assigneeId) || {
        userId: task.assigneeId,
        logged: 0,
        estimated: 0,
        taskCount: 0,
        completedTasks: 0,
        totalPoints: 0,
      };

      entry.taskCount++;
      entry.totalPoints += task.storyPoints || 0;
      entry.estimated += task.estimatedHours || 0;
      entry.logged += task.loggedHours || 0;

      if (task.status === 'done') {
        entry.completedTasks++;
      }

      // Also aggregate from time entries
      if (task.timeEntries && task.timeEntries.length > 0) {
        const entryHours = task.timeEntries
          .filter((te) => te.userId === task.assigneeId)
          .reduce((sum, te) => sum + (te.hours || 0), 0);
        // Use the max of logged hours or time entries sum to avoid double counting
        entry.logged = Math.max(entry.logged, entryHours);
      }

      memberMap.set(task.assigneeId, entry);
    }

    const members = Array.from(memberMap.values()).map((m) => ({
      userId: m.userId,
      logged: Math.round(m.logged * 10) / 10,
      estimated: Math.round(m.estimated * 10) / 10,
      utilization: m.estimated > 0 ? Math.round((m.logged / m.estimated) * 100) : 0,
      taskCount: m.taskCount,
      completedTasks: m.completedTasks,
      totalPoints: m.totalPoints,
    }));

    return { members: members.sort((a, b) => b.logged - a.logged) };
  }

  /**
   * Epic Progress — Epics with child story completion
   */
  async getEpicProgressData(projectId: string) {
    const epics = await this.taskModel
      .find({ projectId, type: 'epic', isDeleted: false })
      .select('taskKey title status storyPoints statusHistory createdAt dueDate')
      .lean();

    const result = [];
    for (const epic of epics) {
      // Find child stories/tasks of this epic
      const children = await this.taskModel
        .find({
          projectId,
          parentTaskId: epic._id.toString(),
          isDeleted: false,
        })
        .select('taskKey title status storyPoints')
        .lean();

      const totalStories = children.length;
      const completedStories = children.filter((c) => c.status === 'done').length;
      const totalPoints = children.reduce((s, c) => s + (c.storyPoints || 0), 0);
      const completedPoints = children
        .filter((c) => c.status === 'done')
        .reduce((s, c) => s + (c.storyPoints || 0), 0);

      result.push({
        id: epic._id.toString(),
        key: epic.taskKey || epic._id.toString(),
        title: epic.title,
        status: epic.status,
        completedStories,
        totalStories,
        completedPoints,
        totalPoints,
        startDate: epic.createdAt,
        targetDate: epic.dueDate,
        stories: children.map((c) => ({
          id: c._id.toString(),
          key: c.taskKey || c._id.toString(),
          title: c.title,
          status: c.status,
          points: c.storyPoints || 0,
        })),
      });
    }

    return { epics: result };
  }

  /**
   * Overview Stats — Key metrics for dashboard cards
   */
  async getOverviewStats(projectId: string) {
    const tasks = await this.taskModel
      .find({ projectId, isDeleted: false })
      .select('status storyPoints statusHistory completedAt')
      .lean();

    const totalTasks = tasks.length;
    const doneTasks = tasks.filter((t) => t.status === 'done');
    const completionRate = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;
    const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
    const completedPoints = doneTasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

    // Average cycle time (quick compute)
    let cycleTimeSum = 0;
    let cycleTimeCount = 0;
    for (const task of doneTasks) {
      if (!task.statusHistory || task.statusHistory.length === 0) continue;
      const sorted = [...task.statusHistory].sort(
        (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
      );
      const start = sorted.find((e) => e.status === 'in_progress');
      const end = [...sorted].reverse().find((e) => e.status === 'done');
      if (start && end) {
        const days = (new Date(end.changedAt).getTime() - new Date(start.changedAt).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= 0) {
          cycleTimeSum += days;
          cycleTimeCount++;
        }
      }
    }
    const avgCycleTime = cycleTimeCount > 0 ? Math.round((cycleTimeSum / cycleTimeCount) * 10) / 10 : 0;

    // Status breakdown
    const statusBreakdown: Record<string, number> = {};
    for (const t of tasks) {
      statusBreakdown[t.status] = (statusBreakdown[t.status] || 0) + 1;
    }

    return {
      totalTasks,
      completedTasks: doneTasks.length,
      completionRate,
      totalPoints,
      completedPoints,
      avgCycleTime,
      statusBreakdown,
    };
  }
}
