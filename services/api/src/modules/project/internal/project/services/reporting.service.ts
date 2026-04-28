import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITimeLog } from '../schemas/time-log.schema';
import { IProject } from '../schemas/project.schema';

export interface BudgetUtilizationData {
  total: number;
  spent: number;
  remaining: number;
  currency: string;
  billingType: string;
  burnRate: number;
  projectedOverrun: number;
  byUser: Array<{
    userId: string;
    hours: number;
    cost: number;
  }>;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectModel('Project', 'nexora_projects') private projectModel: Model<IProject>,
    @InjectModel('TimeLog', 'nexora_projects') private timeLogModel: Model<ITimeLog>,
  ) {}

  // ── Budget Utilization ──

  async getBudgetUtilization(projectId: string): Promise<BudgetUtilizationData> {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const budget = project.budget || { amount: 0, spent: 0, currency: 'USD', billingType: 'fixed' };
    const total = budget.amount || 0;
    const spent = budget.spent || 0;
    const remaining = Math.max(0, total - spent);

    // Calculate burn rate from time logs (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogs = await this.timeLogModel
      .find({ projectId, date: { $gte: thirtyDaysAgo } })
      .lean();

    const recentCost = recentLogs.reduce((sum, log) => {
      const hours = log.duration / 60;
      const rate = log.rate || budget.hourlyRate || 50;
      return sum + hours * rate;
    }, 0);

    // Daily burn rate (based on last 30 days)
    const burnRate = Math.round((recentCost / 30) * 100) / 100;

    // Projected overrun: if burnRate > 0, how many days until budget runs out vs project end
    let projectedOverrun = 0;
    if (burnRate > 0 && total > 0) {
      const daysRemaining = remaining / burnRate;
      const projectEndDate = project.endDate ? new Date(project.endDate) : null;
      if (projectEndDate) {
        const daysUntilEnd = Math.max(0, (projectEndDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        projectedOverrun = Math.round((daysUntilEnd - daysRemaining) * burnRate * 100) / 100;
        if (projectedOverrun < 0) projectedOverrun = 0;
      }
    }

    // Aggregate by user
    const allLogs = await this.timeLogModel.find({ projectId }).lean();
    const byUserMap: Record<string, { hours: number; cost: number }> = {};
    for (const log of allLogs) {
      if (!byUserMap[log.userId]) {
        byUserMap[log.userId] = { hours: 0, cost: 0 };
      }
      const hours = log.duration / 60;
      const rate = log.rate || budget.hourlyRate || 50;
      byUserMap[log.userId].hours += hours;
      byUserMap[log.userId].cost += hours * rate;
    }

    const byUser = Object.entries(byUserMap).map(([userId, data]) => ({
      userId,
      hours: Math.round(data.hours * 10) / 10,
      cost: Math.round(data.cost * 100) / 100,
    }));

    return {
      total,
      spent,
      remaining,
      currency: budget.currency || 'USD',
      billingType: budget.billingType || 'fixed',
      burnRate,
      projectedOverrun: Math.max(0, projectedOverrun),
      byUser: byUser.sort((a, b) => b.cost - a.cost),
    };
  }

  // ── Velocity Report for Export ──

  async getVelocityReportForExport(projectId: string) {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // This endpoint returns project-level metadata for export
    // Actual velocity data comes from task-service
    return {
      projectId,
      projectName: project.projectName,
      projectKey: project.projectKey,
      methodology: project.methodology,
      sprintDuration: project.settings?.sprintDuration || 14,
    };
  }

  // ── Billing Report for Export ──

  async getBillingReportForExport(
    projectId: string,
    fromDate: Date,
    toDate: Date,
  ) {
    const project = await this.projectModel.findById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const timeLogs = await this.timeLogModel
      .find({
        projectId,
        date: { $gte: fromDate, $lte: toDate },
      })
      .lean();

    const totalMinutes = timeLogs.reduce((sum, log) => sum + log.duration, 0);
    const totalHours = totalMinutes / 60;
    const billableMinutes = timeLogs
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.duration, 0);
    const billableHours = billableMinutes / 60;

    const hourlyRate = project.budget?.hourlyRate || 50;

    // Group by user
    const byUser: Record<string, { userId: string; hours: number; cost: number }> = {};
    timeLogs.forEach((log) => {
      if (!byUser[log.userId]) {
        byUser[log.userId] = { userId: log.userId, hours: 0, cost: 0 };
      }
      byUser[log.userId].hours += log.duration / 60;
      byUser[log.userId].cost += (log.duration / 60) * (log.rate || hourlyRate);
    });

    return {
      projectName: project.projectName,
      period: { from: fromDate, to: toDate },
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      totalCost: Object.values(byUser).reduce((sum, u) => sum + u.cost, 0),
      currency: project.budget?.currency || 'USD',
      byUser: Object.values(byUser).map((u) => ({
        ...u,
        hours: Math.round(u.hours * 10) / 10,
        cost: Math.round(u.cost * 100) / 100,
      })),
    };
  }
}
