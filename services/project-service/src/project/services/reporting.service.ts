import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITimeLog } from '../schemas/time-log.schema';
import { IProject } from '../schemas/project.schema';

export interface CumulativeFlowData {
  dates: string[];
  columns: Array<{
    name: string;
    color: string;
    counts: number[];
  }>;
}

export interface CycleTimeData {
  tasks: Array<{
    key: string;
    title: string;
    completedDate: Date;
    cycleTimeDays: number;
  }>;
  avgCycleTime: number;
  medianCycleTime: number;
  p90CycleTime: number;
}

export interface EpicProgressData {
  epics: Array<{
    id: string;
    key: string;
    title: string;
    status: string;
    completedStories: number;
    totalStories: number;
    completedPoints: number;
    totalPoints: number;
    startDate: Date;
    targetDate: Date;
    projectedCompletion: Date;
    stories: Array<{
      id: string;
      key: string;
      title: string;
      status: string;
      points: number;
    }>;
  }>;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectModel('Project') private projectModel: Model<IProject>,
    @InjectModel('TimeLog') private timeLogModel: Model<ITimeLog>,
  ) {}

  // ── 4.1.1 Cumulative Flow Diagram ──

  async getCumulativeFlowData(
    projectId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<CumulativeFlowData> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Define board columns based on project settings
    const columns = this.getProjectColumns(project);
    const dates: string[] = [];
    const columnCounts: { [key: string]: number[] } = {};

    // Initialize counts
    columns.forEach((col) => {
      columnCounts[col.name] = [];
    });

    // Generate daily snapshots
    const current = new Date(fromDate);
    while (current <= toDate) {
      const dateStr = current.toISOString().split('T')[0];
      dates.push(dateStr);

      // For each column, get task count as of this date
      for (const column of columns) {
        // Placeholder: In real implementation, would query task history
        const count = Math.floor(Math.random() * 50); // Mock data
        columnCounts[column.name].push(count);
      }

      current.setDate(current.getDate() + 1);
    }

    return {
      dates,
      columns: columns.map((col) => ({
        name: col.name,
        color: col.color,
        counts: columnCounts[col.name] || [],
      })),
    };
  }

  // ── 4.1.2 Control Chart (Cycle Time) ──

  async getCycleTimeData(projectId: string): Promise<CycleTimeData> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Placeholder: In real implementation, would analyze task completion times
    // For now, return mock structure
    const tasks = [
      {
        key: 'PROJ-1',
        title: 'Implement login',
        completedDate: new Date('2026-03-20'),
        cycleTimeDays: 5,
      },
      {
        key: 'PROJ-2',
        title: 'Fix bug',
        completedDate: new Date('2026-03-21'),
        cycleTimeDays: 3,
      },
      {
        key: 'PROJ-3',
        title: 'Design dashboard',
        completedDate: new Date('2026-03-22'),
        cycleTimeDays: 7,
      },
    ];

    const cycleTimes = tasks.map((t) => t.cycleTimeDays);
    cycleTimes.sort((a, b) => a - b);

    const avgCycleTime = cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length;
    const medianCycleTime =
      cycleTimes.length % 2 === 0
        ? (cycleTimes[cycleTimes.length / 2 - 1] + cycleTimes[cycleTimes.length / 2]) /
          2
        : cycleTimes[Math.floor(cycleTimes.length / 2)];
    const p90Index = Math.ceil(cycleTimes.length * 0.9) - 1;
    const p90CycleTime = cycleTimes[p90Index];

    return {
      tasks,
      avgCycleTime: Math.round(avgCycleTime * 10) / 10,
      medianCycleTime,
      p90CycleTime,
    };
  }

  // ── 4.1.3 Epic Progress Report ──

  async getEpicProgressData(projectId: string): Promise<EpicProgressData> {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Placeholder: In real implementation, would query epic and story data
    // For now, return structure with mock data
    return {
      epics: [
        {
          id: 'epic-1',
          key: 'EPIC-1',
          title: 'Authentication System',
          status: 'in_progress',
          completedStories: 3,
          totalStories: 5,
          completedPoints: 21,
          totalPoints: 40,
          startDate: new Date('2026-03-01'),
          targetDate: new Date('2026-04-01'),
          projectedCompletion: new Date('2026-03-25'),
          stories: [
            {
              id: 'story-1',
              key: 'AUTH-1',
              title: 'Login form',
              status: 'Done',
              points: 8,
            },
            {
              id: 'story-2',
              key: 'AUTH-2',
              title: 'Reset password',
              status: 'Done',
              points: 5,
            },
            {
              id: 'story-3',
              key: 'AUTH-3',
              title: '2FA implementation',
              status: 'In Progress',
              points: 13,
            },
          ],
        },
      ],
    };
  }

  // ── CSV/PDF Export Support ──

  async getVelocityReportForExport(projectId: string) {
    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Return data structure ready for CSV/PDF export
    return {
      sprints: [
        {
          sprint: 'Sprint 1',
          startDate: '2026-03-01',
          endDate: '2026-03-07',
          committedPoints: 40,
          completedPoints: 38,
          completionPercentage: 95,
        },
        {
          sprint: 'Sprint 2',
          startDate: '2026-03-08',
          endDate: '2026-03-14',
          committedPoints: 45,
          completedPoints: 42,
          completionPercentage: 93,
        },
      ],
    };
  }

  async getBillingReportForExport(
    projectId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    // Query time logs
    const timeLogs = await this.timeLogModel
      .find({
        projectId,
        date: { $gte: fromDate, $lte: toDate },
      })
      .exec();

    const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const totalHours = totalMinutes / 60;
    const billableMinutes = timeLogs
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.duration, 0);
    const billableHours = billableMinutes / 60;

    // Group by user
    const byUser: { [userId: string]: any } = {};
    timeLogs.forEach((log) => {
      if (!byUser[log.userId]) {
        byUser[log.userId] = {
          userId: log.userId,
          hours: 0,
          cost: 0,
        };
      }
      byUser[log.userId].hours += log.duration / 60;
      byUser[log.userId].cost += (log.duration / 60) * (log.rate || 50);
    });

    return {
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      totalCost: Object.values(byUser).reduce((sum: number, u: any) => sum + u.cost, 0),
      byUser: Object.values(byUser),
    };
  }

  // ── Helper Methods ──

  private getProjectColumns(project: IProject) {
    // Default Kanban columns
    return [
      { name: 'To Do', color: '#e5e7eb' },
      { name: 'In Progress', color: '#3b82f6' },
      { name: 'In Review', color: '#f59e0b' },
      { name: 'Done', color: '#10b981' },
    ];
  }
}
