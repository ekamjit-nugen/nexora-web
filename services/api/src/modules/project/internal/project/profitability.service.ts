import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';

export interface ProjectCosts {
  labor: number;        // paise: hours × hourly cost
  expenses: number;     // paise: approved reimbursements tied to project
  infrastructure: number; // paise: infra allocations
  overhead: number;     // paise: org overhead allocation (config-driven)
  total: number;
}

export interface ProjectRevenue {
  billed: number;        // paise: invoiced to client
  unbilled: number;      // paise: work done but not invoiced
  forecasted: number;    // paise: projected remaining
  total: number;
}

export interface ProjectProfitability {
  projectId: string;
  projectName: string;
  projectKey: string;
  clientId?: string;
  clientName?: string;
  status: string;

  // Budget
  budget: number;              // total project budget (paise)
  budgetUsed: number;          // percent
  budgetRemaining: number;     // paise

  // Cost breakdown
  costs: ProjectCosts;

  // Revenue breakdown
  revenue: ProjectRevenue;

  // Margin metrics
  grossMargin: number;         // paise (revenue - cost)
  marginPercent: number;       // 0-100
  marginStatus: 'healthy' | 'warning' | 'critical' | 'loss';

  // Time metrics
  daysElapsed: number;
  daysRemaining: number;
  burnRatePerDay: number;      // paise/day
  projectedFinalCost: number;  // paise at current burn rate
  projectedFinalMargin: number;// percent at current burn rate

  // Team metrics
  teamSize: number;
  totalHoursLogged: number;

  // Timestamps
  lastCalculatedAt: Date;
}

@Injectable()
export class ProfitabilityService {
  private readonly logger = new Logger(ProfitabilityService.name);
  private readonly taskServiceUrl: string;
  private readonly payrollServiceUrl: string;
  private readonly hrServiceUrl: string;

  // Margin thresholds (configurable via env in v2)
  private readonly HEALTHY_THRESHOLD = 20; // >= 20% = healthy
  private readonly WARNING_THRESHOLD = 10; // 10-20% = warning
  // < 10% = critical, < 0 = loss

  constructor(
    @InjectModel('Project', 'nexora_projects') private projectModel: Model<any>,
    private configService: ConfigService,
  ) {
    this.taskServiceUrl = this.configService.get<string>('TASK_SERVICE_URL') || 'http://task-service:3021';
    this.payrollServiceUrl = this.configService.get<string>('PAYROLL_SERVICE_URL') || 'http://payroll-service:3014';
    this.hrServiceUrl = this.configService.get<string>('HR_SERVICE_URL') || 'http://hr-service:3010';
  }

  /**
   * Compute real-time profitability for a single project.
   * Pulls:
   * - Hours from task-service (timesheets)
   * - Labor costs from payroll-service (salary structures → hourly rates)
   * - Expenses from payroll-service (expense claims linked to project)
   * - Revenue/budget from project schema itself
   */
  async getProjectProfitability(projectId: string, orgId: string): Promise<ProjectProfitability> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const project = await this.projectModel.findOne({ _id: projectId, organizationId: orgId, isDeleted: false }).lean();
    if (!project) throw new NotFoundException('Project not found');

    // Parallel fetch from other services
    const [timesheetData, expenseData] = await Promise.all([
      this.fetchProjectTimesheets(projectId, orgId),
      this.fetchProjectExpenses(projectId, orgId),
    ]);

    // Compute labor cost
    // For v1: use a default hourly rate if salary data unavailable
    // In production, would compute per-employee using their salary structure
    const totalHoursLogged = timesheetData.totalHours;
    const avgHourlyRate = timesheetData.avgHourlyRate || 50000; // default ₹500/hr in paise
    const laborCost = Math.round(totalHoursLogged * avgHourlyRate);

    // Expense cost
    const expenseCost = expenseData.totalAmount;

    // Infrastructure cost (from project schema if tracked)
    const infraCost = (project as any).infrastructureCost || 0;

    // Overhead (10% of labor — configurable)
    const overhead = Math.round(laborCost * 0.10);

    const totalCost = laborCost + expenseCost + infraCost + overhead;

    // Revenue calculation
    const budget = (project as any).budget?.totalAmount || (project as any).budget?.amount || (project as any).budget || 0;
    const billedAmount = (project as any).billing?.invoicedAmount || (project as any).budget?.spent || 0;
    const billingType = (project as any).billing?.type || (project as any).budget?.billingType || 'fixed_price'; // 'fixed_price' | 'time_material' | 'retainer'

    let billedRevenue = billedAmount;
    let unbilledRevenue = 0;

    if (billingType === 'time_material') {
      // T&M: revenue = hours × bill rate
      const billRate = (project as any).billing?.hourlyRate || (project as any).budget?.hourlyRate || 100000; // default ₹1000/hr in paise
      const totalWorkValue = Math.round(totalHoursLogged * billRate);
      unbilledRevenue = Math.max(0, totalWorkValue - billedAmount);
    }

    const totalRevenue = billedRevenue + unbilledRevenue;
    const forecastedRevenue = budget;

    // Margin
    const grossMargin = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? Math.round((grossMargin / totalRevenue) * 100) : 0;

    let marginStatus: ProjectProfitability['marginStatus'];
    if (marginPercent < 0) marginStatus = 'loss';
    else if (marginPercent < this.WARNING_THRESHOLD) marginStatus = 'critical';
    else if (marginPercent < this.HEALTHY_THRESHOLD) marginStatus = 'warning';
    else marginStatus = 'healthy';

    // Time metrics
    const startDate = (project as any).startDate ? new Date((project as any).startDate) : new Date();
    const endDate = (project as any).endDate ? new Date((project as any).endDate) : null;
    const now = new Date();
    const daysElapsed = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
    const daysRemaining = endDate ? Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;

    const burnRatePerDay = daysElapsed > 0 ? Math.round(totalCost / daysElapsed) : 0;
    const projectedFinalCost = totalCost + (burnRatePerDay * daysRemaining);
    const projectedFinalMargin = forecastedRevenue > 0
      ? Math.round(((forecastedRevenue - projectedFinalCost) / forecastedRevenue) * 100)
      : 0;

    const budgetUsed = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;

    return {
      projectId: (project as any)._id.toString(),
      projectName: (project as any).name || (project as any).projectName || 'Untitled',
      projectKey: (project as any).projectKey || (project as any).key || '',
      clientId: (project as any).clientId,
      clientName: (project as any).clientName,
      status: (project as any).status || 'active',

      budget,
      budgetUsed,
      budgetRemaining: Math.max(0, budget - totalCost),

      costs: {
        labor: laborCost,
        expenses: expenseCost,
        infrastructure: infraCost,
        overhead,
        total: totalCost,
      },

      revenue: {
        billed: billedRevenue,
        unbilled: unbilledRevenue,
        forecasted: forecastedRevenue,
        total: totalRevenue,
      },

      grossMargin,
      marginPercent,
      marginStatus,

      daysElapsed,
      daysRemaining,
      burnRatePerDay,
      projectedFinalCost,
      projectedFinalMargin,

      teamSize: Array.isArray((project as any).team)
        ? (project as any).team.length
        : Array.isArray((project as any).teamMembers)
          ? (project as any).teamMembers.length
          : 0,
      totalHoursLogged,

      lastCalculatedAt: new Date(),
    };
  }

  /**
   * Compute profitability overview for all active projects.
   * Used for the CFO dashboard.
   */
  async getPortfolioProfitability(orgId: string): Promise<{
    summary: {
      totalProjects: number;
      totalRevenue: number;
      totalCost: number;
      totalMargin: number;
      avgMarginPercent: number;
      healthyCount: number;
      warningCount: number;
      criticalCount: number;
      lossCount: number;
    };
    projects: ProjectProfitability[];
  }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    const projects = await this.projectModel
      .find({ organizationId: orgId, isDeleted: false, status: { $in: ['active', 'planning', 'in_progress'] } })
      .lean();

    const profitabilities = await Promise.all(
      projects.map(p =>
        this.getProjectProfitability((p as any)._id.toString(), orgId).catch(err => {
          this.logger.warn(`Failed to compute profitability for project ${(p as any)._id}: ${err.message}`);
          return null;
        }),
      ),
    );

    const valid = profitabilities.filter((p): p is ProjectProfitability => p !== null);

    const totalRevenue = valid.reduce((sum, p) => sum + p.revenue.total, 0);
    const totalCost = valid.reduce((sum, p) => sum + p.costs.total, 0);
    const totalMargin = totalRevenue - totalCost;
    const avgMarginPercent = valid.length > 0
      ? Math.round(valid.reduce((sum, p) => sum + p.marginPercent, 0) / valid.length)
      : 0;

    return {
      summary: {
        totalProjects: valid.length,
        totalRevenue,
        totalCost,
        totalMargin,
        avgMarginPercent,
        healthyCount: valid.filter(p => p.marginStatus === 'healthy').length,
        warningCount: valid.filter(p => p.marginStatus === 'warning').length,
        criticalCount: valid.filter(p => p.marginStatus === 'critical').length,
        lossCount: valid.filter(p => p.marginStatus === 'loss').length,
      },
      projects: valid.sort((a, b) => a.marginPercent - b.marginPercent), // worst first for visibility
    };
  }

  // ── Private helpers for inter-service calls ──

  private async fetchProjectTimesheets(projectId: string, orgId: string): Promise<{ totalHours: number; avgHourlyRate: number }> {
    try {
      const url = `${this.taskServiceUrl}/api/v1/timesheets?projectId=${projectId}&status=approved`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        headers: { 'X-Organization-Id': orgId },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return { totalHours: 0, avgHourlyRate: 0 };
      const json: any = await res.json();
      const timesheets = Array.isArray(json.data) ? json.data : [];
      const totalHours = timesheets.reduce((sum: number, ts: any) => {
        const entries = Array.isArray(ts.entries) ? ts.entries : [];
        return sum + entries.reduce((s: number, e: any) => s + (e.hours || 0), 0);
      }, 0);
      return { totalHours, avgHourlyRate: 0 };
    } catch (err: any) {
      this.logger.warn(`Failed to fetch timesheets for ${projectId}: ${err.message}`);
      return { totalHours: 0, avgHourlyRate: 0 };
    }
  }

  private async fetchProjectExpenses(projectId: string, orgId: string): Promise<{ totalAmount: number }> {
    try {
      const url = `${this.payrollServiceUrl}/api/v1/expense-claims?projectId=${projectId}&status=finance_approved`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        headers: { 'X-Organization-Id': orgId },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return { totalAmount: 0 };
      const json: any = await res.json();
      const claims = Array.isArray(json.data) ? json.data : [];
      const totalAmount = claims.reduce((sum: number, c: any) => sum + (c.totalAmount || 0), 0);
      return { totalAmount };
    } catch (err: any) {
      this.logger.warn(`Failed to fetch expenses for ${projectId}: ${err.message}`);
      return { totalAmount: 0 };
    }
  }
}
