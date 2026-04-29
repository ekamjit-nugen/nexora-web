import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AUTH_DB, HR_DB, PAYROLL_DB, ATTENDANCE_DB, LEAVE_DB,
} from '../../../bootstrap/database/database.tokens';

/**
 * Fetches a small, fast tenant + user snapshot for the chatbot prompt.
 *
 * Goal: give the LLM enough live context to feel "aware" without
 * exposing data the user shouldn't see. Everything queried here is
 * scoped to the user's organizationId; we never reach across tenants.
 *
 * Per-call cost target: < 50ms total (5 small Mongo queries in
 * parallel, all on indexed fields).
 *
 * The snapshot is regenerated on every message so info stays fresh.
 * If a query times out or fails, that field is just omitted —
 * never block the chat.
 */

export interface TenantSnapshot {
  user: {
    firstName?: string;
    role: string;            // owner / admin / hr / manager / member / etc.
    isPlatformAdmin: boolean;
  };
  org: {
    id: string;
    name: string;
    type?: string;
    country?: string;
    setupComplete?: boolean;
  };
  workforce?: {
    totalActive: number;
    departmentCount: number;
  };
  payroll?: {
    currentMonth: string;       // "March 2026"
    latestRunStatus?: string;   // draft / review / approved / finalized / paid
    latestRunNet?: number;
    employeesPaid?: number;
    salaryStructuresActive?: number;
  };
  myAttendance?: {
    todayStatus?: string;       // present / absent / leave / not_logged
    monthPresentDays?: number;
  };
  myLeave?: {
    pending?: number;
    balance?: { type: string; remaining: number }[];
  };
}

@Injectable()
export class TenantContextService {
  private readonly log = new Logger(TenantContextService.name);

  constructor(
    @InjectModel('Organization', AUTH_DB) private readonly orgModel: Model<any>,
    @InjectModel('User', AUTH_DB) private readonly userModel: Model<any>,
    @InjectModel('Employee', HR_DB) private readonly employeeModel: Model<any>,
    @InjectModel('Department', HR_DB) private readonly departmentModel: Model<any>,
    @InjectModel('PayrollRun', PAYROLL_DB) private readonly payrollRunModel: Model<any>,
    @InjectModel('SalaryStructure', PAYROLL_DB) private readonly salaryStructureModel: Model<any>,
    @InjectModel('Attendance', ATTENDANCE_DB) private readonly attendanceModel: Model<any>,
    @InjectModel('Leave', LEAVE_DB) private readonly leaveModel: Model<any>,
  ) {}

  async fetch(
    organizationId: string,
    userId: string,
    role: string,
    isPlatformAdmin: boolean,
  ): Promise<TenantSnapshot> {
    // Run everything in parallel, swallow individual failures.
    const safe = <T>(p: Promise<T>): Promise<T | null> =>
      p.catch((err) => {
        this.log.debug(`snapshot field failed: ${err?.message}`);
        return null;
      });

    const [org, user, activeEmps, deptCount, latestRun, structureCount] = await Promise.all([
      safe(this.orgModel.findById(organizationId).lean()),
      safe(this.userModel.findById(userId).lean()),
      safe(
        this.employeeModel.countDocuments({
          organizationId, status: 'active', isDeleted: { $ne: true },
        }),
      ),
      safe(
        this.departmentModel.countDocuments({
          organizationId, isDeleted: { $ne: true },
        }),
      ),
      safe(
        this.payrollRunModel
          .findOne({ organizationId, isDeleted: false })
          .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
          .lean(),
      ),
      safe(
        this.salaryStructureModel.countDocuments({
          organizationId, status: 'active', isDeleted: { $ne: true },
        }),
      ),
    ]);

    const now = new Date();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

    // Per-user: today's attendance + leave summary (skip for super admin
    // because they don't have an attendance/leave context per tenant).
    let myAttendance: TenantSnapshot['myAttendance'] | undefined;
    let myLeave: TenantSnapshot['myLeave'] | undefined;
    if (!isPlatformAdmin) {
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [att, presentDays, leavePending] = await Promise.all([
        safe(
          this.attendanceModel
            .findOne({ organizationId, employeeId: userId, date: { $gte: todayStart } })
            .lean(),
        ),
        safe(
          this.attendanceModel.countDocuments({
            organizationId, employeeId: userId,
            date: { $gte: monthStart },
            status: 'present',
            isDeleted: { $ne: true },
          }),
        ),
        safe(
          this.leaveModel.countDocuments({
            organizationId, employeeId: userId,
            status: 'pending', isDeleted: { $ne: true },
          }),
        ),
      ]);
      myAttendance = {
        todayStatus: (att as any)?.status || 'not_logged',
        monthPresentDays: presentDays as number || 0,
      };
      myLeave = { pending: leavePending as number || 0 };
    }

    return {
      user: {
        firstName: (user as any)?.firstName,
        role: role || 'member',
        isPlatformAdmin: !!isPlatformAdmin,
      },
      org: {
        id: organizationId,
        name: (org as any)?.name || 'your organization',
        type: (org as any)?.type,
        country: (org as any)?.country,
        setupComplete: (user as any)?.setupStage === 'complete',
      },
      workforce: org && {
        totalActive: (activeEmps as number) || 0,
        departmentCount: (deptCount as number) || 0,
      },
      payroll: latestRun
        ? {
            currentMonth: `${monthNames[(latestRun as any).payPeriod?.month - 1] || ''} ${(latestRun as any).payPeriod?.year || ''}`.trim(),
            latestRunStatus: (latestRun as any).status,
            latestRunNet: (latestRun as any).summary?.totalNet,
            employeesPaid: (latestRun as any).summary?.totalEmployees,
            salaryStructuresActive: (structureCount as number) || 0,
          }
        : {
            currentMonth: `${monthNames[now.getMonth()]} ${now.getFullYear()}`,
            salaryStructuresActive: (structureCount as number) || 0,
          },
      myAttendance,
      myLeave,
    };
  }

  /**
   * Render the snapshot as a compact Markdown block to inject into
   * the system prompt. Compact = the LLM consumes ~150 tokens, not 500.
   */
  toPromptBlock(snap: TenantSnapshot): string {
    const lines: string[] = [];
    lines.push('## Live tenant context (use this when answering)');
    lines.push(`- User: ${snap.user.firstName ? snap.user.firstName + ' ' : ''}(${snap.user.role}${snap.user.isPlatformAdmin ? ', platform admin' : ''})`);
    lines.push(`- Organization: ${snap.org.name}${snap.org.country ? ' · ' + snap.org.country : ''}${snap.org.type ? ' · ' + snap.org.type : ''}`);
    if (snap.workforce) {
      lines.push(`- Workforce: ${snap.workforce.totalActive} active employees, ${snap.workforce.departmentCount} departments`);
    }
    if (snap.payroll) {
      const p = snap.payroll;
      const bits = [`current cycle: ${p.currentMonth}`];
      if (p.latestRunStatus) bits.push(`latest run status: ${p.latestRunStatus}`);
      if (p.latestRunNet) bits.push(`latest net payout: ₹${p.latestRunNet.toLocaleString('en-IN')}`);
      if (p.employeesPaid) bits.push(`${p.employeesPaid} employees in last run`);
      if (p.salaryStructuresActive) bits.push(`${p.salaryStructuresActive} active salary structures`);
      lines.push(`- Payroll: ${bits.join(', ')}`);
    }
    if (snap.myAttendance) {
      lines.push(`- ${snap.user.firstName || 'You'} today: ${snap.myAttendance.todayStatus}; this month present ${snap.myAttendance.monthPresentDays} days`);
    }
    if (snap.myLeave?.pending !== undefined) {
      lines.push(`- ${snap.user.firstName || 'You'}'s pending leave requests: ${snap.myLeave.pending}`);
    }
    lines.push(
      '',
      'Use these numbers when relevant. Refer to the user by first name. ' +
        'Never speculate about figures you can\'t see in this block. If the user ' +
        'asks for a number not present here, tell them which screen to check.',
    );
    return lines.join('\n');
  }
}
