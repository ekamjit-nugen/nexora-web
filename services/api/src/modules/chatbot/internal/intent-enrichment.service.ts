import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AUTH_DB, HR_DB, PAYROLL_DB, ATTENDANCE_DB, LEAVE_DB,
} from '../../../bootstrap/database/database.tokens';

/**
 * Intent-aware data enrichment for the chatbot prompt.
 *
 * The LLM by itself doesn't have DB access. To answer questions like
 * "show me my team's attendance for today" with real rows, we have
 * to detect that intent on the server, fetch the right data
 * (tenant-scoped, role-aware), and prepend a Markdown "Live data
 * block" to the system prompt so the model can reproduce the table
 * verbatim instead of just pointing the user to a screen.
 *
 * Why server-side detection (instead of LLM tool-calling):
 *   - qwen2.5-coder doesn't reliably emit the function-call format.
 *   - Latency: a tool round-trip would double the LLM wait.
 *   - Cost: tool-calling sends the full tool catalogue every turn.
 *   - Determinism: keyword detection is debuggable, function-call
 *     model output is not.
 *
 * Tenant isolation:
 *   - Every query filters by organizationId from the JWT.
 *   - For "team" queries by a manager, we additionally filter by
 *     reportingManagerId = manager's HR _id.
 *   - For "my" queries we filter by employeeId = the caller's HR
 *     _id (or userId fallback).
 *   - We never expose other orgs / other people's data here.
 *
 * If no intent matches, the function returns null and we send the
 * usual snapshot-only prompt — saving LLM tokens.
 */

const TODAY_TEAM_ATTENDANCE = /(team|everyone|all employees|all staff|the team|my team).*(attendance|present|in office|today)/i;
const MY_ATTENDANCE = /(my|own).*(attendance|present|hours|status today|clock)/i;
const PENDING_LEAVES = /(pending|to approve|awaiting).*leave|leave.*(pending|approval)/i;
const ON_LEAVE_TODAY = /(who.{0,4}(is|are|on)).*(leave|away|out)|out today|on leave today|away today/i;
const LIST_TEAM = /(list|show|who).*(team|reports|staff|employees|members)/i;
const ACTIVE_SALARY_STRUCTURES = /(salary structure|salary structures|comp structure)/i;
const LIST_DEPARTMENTS = /(list|show).*departments?|how many departments?/i;

@Injectable()
export class IntentEnrichmentService {
  private readonly log = new Logger(IntentEnrichmentService.name);

  constructor(
    @InjectModel('Employee', HR_DB) private readonly employeeModel: Model<any>,
    @InjectModel('Department', HR_DB) private readonly departmentModel: Model<any>,
    @InjectModel('Attendance', ATTENDANCE_DB) private readonly attendanceModel: Model<any>,
    @InjectModel('Leave', LEAVE_DB) private readonly leaveModel: Model<any>,
    @InjectModel('SalaryStructure', PAYROLL_DB) private readonly salaryStructureModel: Model<any>,
  ) {}

  /**
   * Detect intent in the user's message and fetch the relevant data.
   * Returns a Markdown-formatted block to inject into the system prompt,
   * or null if no intent matched.
   */
  async detectAndFetch(
    userMessage: string,
    organizationId: string,
    userId: string,
    role: string,
  ): Promise<string | null> {
    const role_ = (role || '').toLowerCase();
    const isPrivileged =
      role_ === 'admin' ||
      role_ === 'hr' ||
      role_ === 'owner' ||
      role_ === 'super_admin';
    const isManagerLike = role_ === 'manager' || isPrivileged;

    // Resolve the caller's HR employee row once — used by both "my"
    // queries and the "team = my reports" filter for managers.
    const myEmployee: any = await this.employeeModel
      .findOne({
        organizationId,
        $or: [{ userId }, { _id: userId }],
        isDeleted: { $ne: true },
      })
      .lean();
    const myEmployeeId = myEmployee?._id ? String(myEmployee._id) : userId;

    const blocks: string[] = [];

    // ── Today's team attendance ────────────────────────────────────
    if (TODAY_TEAM_ATTENDANCE.test(userMessage) && isManagerLike) {
      const block = await this.todayTeamAttendance(
        organizationId,
        myEmployeeId,
        isPrivileged,
      );
      if (block) blocks.push(block);
    } else if (MY_ATTENDANCE.test(userMessage)) {
      const block = await this.myAttendance(organizationId, myEmployeeId);
      if (block) blocks.push(block);
    }

    // ── Who's on leave today ───────────────────────────────────────
    if (ON_LEAVE_TODAY.test(userMessage)) {
      const block = await this.whoIsOnLeaveToday(
        organizationId,
        myEmployeeId,
        isPrivileged,
        isManagerLike,
      );
      if (block) blocks.push(block);
    }

    // ── Pending leaves ─────────────────────────────────────────────
    if (PENDING_LEAVES.test(userMessage)) {
      const block = await this.pendingLeaves(
        organizationId,
        myEmployeeId,
        isPrivileged,
        isManagerLike,
      );
      if (block) blocks.push(block);
    }

    // ── List the team ──────────────────────────────────────────────
    if (LIST_TEAM.test(userMessage) && isManagerLike) {
      const block = await this.teamList(
        organizationId,
        myEmployeeId,
        isPrivileged,
      );
      if (block) blocks.push(block);
    }

    // ── Active salary structures (HR/admin/owner only) ────────────
    if (ACTIVE_SALARY_STRUCTURES.test(userMessage) && isPrivileged) {
      const block = await this.activeSalaryStructures(organizationId);
      if (block) blocks.push(block);
    }

    // ── Departments ────────────────────────────────────────────────
    if (LIST_DEPARTMENTS.test(userMessage) && isManagerLike) {
      const block = await this.departmentList(organizationId);
      if (block) blocks.push(block);
    }

    if (blocks.length === 0) return null;
    return [
      '## Live data block',
      '_The following rows are the answer to the user\'s question. Reproduce',
      '  them in your reply (Markdown table preferred). Do NOT tell the user',
      '  to navigate to a screen — they asked for the data, you have it._',
      '',
      ...blocks,
    ].join('\n');
  }

  // ─────────────────────────────────────────────────────────────────
  // Detectors

  private async todayTeamAttendance(
    organizationId: string,
    managerEmployeeId: string,
    privileged: boolean,
  ): Promise<string | null> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // Resolve which employee ids belong to "the team":
    //   - HR/admin/owner: every active employee in the org
    //   - manager:        only their direct reports
    const empFilter: any = {
      organizationId,
      isDeleted: { $ne: true },
      status: 'active',
    };
    if (!privileged) empFilter.reportingManagerId = managerEmployeeId;

    const employees = await this.employeeModel
      .find(empFilter, { firstName: 1, lastName: 1, employeeId: 1 })
      .limit(200)
      .lean();
    if (employees.length === 0) return null;

    const empIdSet = employees.map((e: any) => String(e._id));
    const records = await this.attendanceModel
      .find({
        organizationId,
        employeeId: { $in: empIdSet },
        date: { $gte: todayStart, $lt: todayEnd },
        isDeleted: { $ne: true },
      })
      .lean();
    const byEmployee = new Map<string, any>();
    for (const r of records) byEmployee.set(String(r.employeeId), r);

    const rows: string[] = [];
    rows.push("### 📊 Today's team attendance");
    rows.push('');
    rows.push('| Name | ID | Status | Clock in | Clock out |');
    rows.push('|---|---|---|---|---|');

    let present = 0, absent = 0, onLeave = 0, late = 0;
    for (const e of employees) {
      const r = byEmployee.get(String(e._id));
      const name = `${e.firstName || ''} ${e.lastName || ''}`.trim() || '—';
      const code = e.employeeId || '—';
      const status = r?.status || 'not_logged';
      const ci = r?.checkInTime
        ? new Date(r.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';
      const co = r?.checkOutTime
        ? new Date(r.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';
      rows.push(`| ${name} | ${code} | ${status} | ${ci} | ${co} |`);
      if (status === 'present') present++;
      else if (status === 'late') late++;
      else if (status === 'leave') onLeave++;
      else if (status === 'absent' || status === 'not_logged') absent++;
    }
    rows.push('');
    rows.push(
      `**Summary:** ${employees.length} ${privileged ? 'employees' : 'reports'} · ` +
        `${present} present · ${late} late · ${onLeave} on leave · ${absent} absent / not yet logged`,
    );
    return rows.join('\n');
  }

  private async myAttendance(
    organizationId: string,
    myEmployeeId: string,
  ): Promise<string | null> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [todayRow, monthRows] = await Promise.all([
      this.attendanceModel
        .findOne({
          organizationId,
          employeeId: myEmployeeId,
          date: { $gte: todayStart },
          isDeleted: { $ne: true },
        })
        .lean(),
      this.attendanceModel
        .find({
          organizationId,
          employeeId: myEmployeeId,
          date: { $gte: monthStart },
          isDeleted: { $ne: true },
        })
        .sort({ date: -1 })
        .limit(40)
        .lean(),
    ]);

    const out: string[] = [];
    out.push('### ⏰ Your attendance');
    out.push('');
    const todayRowAny = todayRow as any;
    if (todayRowAny) {
      const ci = todayRowAny.checkInTime
        ? new Date(todayRowAny.checkInTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';
      const co = todayRowAny.checkOutTime
        ? new Date(todayRowAny.checkOutTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
        : '—';
      out.push(`**Today:** ${todayRowAny.status} · clocked in ${ci} · clocked out ${co}`);
    } else {
      out.push("**Today:** not logged yet");
    }
    out.push('');
    if (monthRows.length > 0) {
      const present = monthRows.filter((r: any) => r.status === 'present').length;
      const late = monthRows.filter((r: any) => r.status === 'late').length;
      const lop = monthRows.filter((r: any) => r.status === 'lop' || r.status === 'absent').length;
      const wfh = monthRows.filter((r: any) => r.status === 'wfh').length;
      out.push(
        `**This month:** ${present} present · ${late} late · ${wfh} WFH · ${lop} LOP / absent`,
      );
    }
    return out.join('\n');
  }

  private async whoIsOnLeaveToday(
    organizationId: string,
    myEmployeeId: string,
    privileged: boolean,
    managerLike: boolean,
  ): Promise<string | null> {
    if (!managerLike) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const empFilter: any = { organizationId, isDeleted: { $ne: true } };
    if (!privileged) empFilter.reportingManagerId = myEmployeeId;
    const teamIds = (
      await this.employeeModel.find(empFilter, { _id: 1 }).lean()
    ).map((e: any) => String(e._id));
    if (teamIds.length === 0) return null;

    const onLeave = await this.leaveModel
      .find({
        organizationId,
        employeeId: { $in: teamIds },
        status: 'approved',
        fromDate: { $lte: today },
        toDate: { $gte: today },
        isDeleted: { $ne: true },
      })
      .lean();
    if (onLeave.length === 0) {
      return '### 🏖️ On leave today\n\nNo one is on leave today ✅';
    }
    const empMap = await this.employeesById(organizationId, onLeave.map((l: any) => String(l.employeeId)));
    const lines: string[] = ['### 🏖️ On leave today', ''];
    lines.push('| Name | Type | Until |');
    lines.push('|---|---|---|');
    for (const l of onLeave) {
      const e = empMap.get(String(l.employeeId));
      const name = e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '—';
      const until = l.toDate ? new Date(l.toDate).toLocaleDateString('en-IN') : '—';
      lines.push(`| ${name} | ${l.leaveType || '—'} | ${until} |`);
    }
    return lines.join('\n');
  }

  private async pendingLeaves(
    organizationId: string,
    myEmployeeId: string,
    privileged: boolean,
    managerLike: boolean,
  ): Promise<string | null> {
    const filter: any = {
      organizationId,
      status: 'pending',
      isDeleted: { $ne: true },
    };
    let scope = 'mine';
    if (managerLike) {
      // Manager / HR / admin sees pending leaves they can approve — scoped
      // by the same reporting-manager logic the leave approval routes use.
      const empFilter: any = { organizationId, isDeleted: { $ne: true } };
      if (!privileged) empFilter.reportingManagerId = myEmployeeId;
      const teamIds = (
        await this.employeeModel.find(empFilter, { _id: 1 }).lean()
      ).map((e: any) => String(e._id));
      filter.employeeId = { $in: teamIds };
      scope = privileged ? 'org-wide' : 'my reports';
    } else {
      filter.employeeId = myEmployeeId;
    }

    const rows = await this.leaveModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    if (rows.length === 0) {
      return `### 🏖️ Pending leave requests (${scope})\n\nNothing pending — you're all caught up ✅`;
    }
    const empMap = await this.employeesById(organizationId, rows.map((r: any) => String(r.employeeId)));
    const lines: string[] = [`### 🏖️ Pending leave requests (${scope})`, ''];
    lines.push('| Employee | Type | From | To | Reason |');
    lines.push('|---|---|---|---|---|');
    for (const r of rows) {
      const e = empMap.get(String(r.employeeId));
      const name = e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '—';
      const f = r.fromDate ? new Date(r.fromDate).toLocaleDateString('en-IN') : '—';
      const t = r.toDate ? new Date(r.toDate).toLocaleDateString('en-IN') : '—';
      const reason = (r.reason || '').slice(0, 40) || '—';
      lines.push(`| ${name} | ${r.leaveType || '—'} | ${f} | ${t} | ${reason} |`);
    }
    return lines.join('\n');
  }

  private async teamList(
    organizationId: string,
    myEmployeeId: string,
    privileged: boolean,
  ): Promise<string | null> {
    const filter: any = {
      organizationId,
      isDeleted: { $ne: true },
      status: 'active',
    };
    if (!privileged) filter.reportingManagerId = myEmployeeId;
    const rows = await this.employeeModel
      .find(filter, { firstName: 1, lastName: 1, designation: 1, employeeId: 1, email: 1 })
      .limit(50)
      .lean();
    if (rows.length === 0) return null;
    const lines: string[] = [
      `### 👥 ${privileged ? 'Active employees' : 'Your direct reports'} (${rows.length})`,
      '',
      '| Name | ID | Designation |',
      '|---|---|---|',
    ];
    for (const e of rows) {
      lines.push(
        `| ${(e.firstName || '') + ' ' + (e.lastName || '')} | ${e.employeeId || '—'} | ${e.designation || '—'} |`,
      );
    }
    return lines.join('\n');
  }

  private async activeSalaryStructures(organizationId: string): Promise<string | null> {
    const rows = await this.salaryStructureModel
      .find({ organizationId, status: 'active', isDeleted: { $ne: true } })
      .limit(20)
      .lean();
    if (rows.length === 0) return null;
    const empMap = await this.employeesById(organizationId, rows.map((r: any) => String(r.employeeId)));
    const lines: string[] = [
      `### 💰 Active salary structures (${rows.length})`,
      '',
      '| Employee | CTC | Effective from |',
      '|---|---|---|',
    ];
    for (const r of rows) {
      const e = empMap.get(String(r.employeeId));
      const name = e ? `${e.firstName || ''} ${e.lastName || ''}`.trim() : '—';
      const ctc = (r.annualCtc || r.ctc || 0)?.toLocaleString('en-IN');
      const eff = r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString('en-IN') : '—';
      lines.push(`| ${name} | ₹${ctc} | ${eff} |`);
    }
    return lines.join('\n');
  }

  private async departmentList(organizationId: string): Promise<string | null> {
    const rows = await this.departmentModel
      .find({ organizationId, isDeleted: { $ne: true } }, { name: 1, code: 1 })
      .limit(50)
      .lean();
    if (rows.length === 0) return null;
    const lines: string[] = [
      `### 🏢 Departments (${rows.length})`,
      '',
      '| Name | Code |',
      '|---|---|',
    ];
    for (const d of rows) lines.push(`| ${d.name || '—'} | ${d.code || '—'} |`);
    return lines.join('\n');
  }

  // ─────────────────────────────────────────────────────────────────

  private async employeesById(
    organizationId: string,
    ids: string[],
  ): Promise<Map<string, any>> {
    if (ids.length === 0) return new Map();
    const rows = await this.employeeModel
      .find(
        { organizationId, _id: { $in: ids } },
        { firstName: 1, lastName: 1, employeeId: 1 },
      )
      .lean();
    return new Map(rows.map((r: any) => [String(r._id), r]));
  }
}
