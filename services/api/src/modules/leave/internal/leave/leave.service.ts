import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ILeave } from './schemas/leave.schema';
import { ILeaveBalance } from './schemas/leave-balance.schema';
import { ILeavePolicy } from './schemas/leave-policy.schema';
import { PolicyClientService } from './policy-client.service';
import {
  ApplyLeaveDto, ApproveLeaveDto, CancelLeaveDto, LeaveQueryDto,
  CreateLeavePolicyDto, UpdateLeavePolicyDto,
} from './dto/index';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectModel('Leave', 'nexora_leave') private leaveModel: Model<ILeave>,
    @InjectModel('LeaveBalance', 'nexora_leave') private leaveBalanceModel: Model<ILeaveBalance>,
    @InjectModel('LeavePolicy', 'nexora_leave') private leavePolicyModel: Model<ILeavePolicy>,
    private readonly policyClient: PolicyClientService,
  ) {}

  // Roles that cannot apply for leave — they manage approvals, not
  // their own time off. Mirrors attendance-service's EXCLUDED_ORG_ROLES
  // so the policy is consistent across "self" actions. HR is NOT
  // excluded; HR users still apply for their own leave alongside their
  // approval duties. Update both lists together if the rule changes.
  private readonly EXCLUDED_TOP_ROLES = ['admin', 'super_admin'];
  private readonly EXCLUDED_ORG_ROLES = ['admin', 'owner'];

  private validateNotAdmin(roles: string[], orgRole?: string | null) {
    if (roles && roles.some((r) => this.EXCLUDED_TOP_ROLES.includes(r))) {
      throw new ForbiddenException('Admin users do not apply for leave. Use employee or HR accounts.');
    }
    if (orgRole && this.EXCLUDED_ORG_ROLES.includes(orgRole)) {
      throw new ForbiddenException('Owners and org admins do not apply for leave. Use the Approvals view to action your team\u2019s requests.');
    }
  }

  // ── Leave Requests ──

  async applyLeave(
    dto: ApplyLeaveDto,
    userId: string,
    orgId?: string,
    roles?: string[],
    orgRole?: string | null,
  ) {
    this.validateNotAdmin(roles || [], orgRole);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate < startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Calculate total days
    let totalDays = this.calculateBusinessDays(startDate, endDate);
    if (dto.halfDay?.enabled) {
      totalDays = 0.5;
    }

    if (totalDays <= 0) {
      throw new BadRequestException('Total leave days must be greater than 0');
    }

    // Check for overlapping leaves
    const overlapFilter: any = {
      employeeId: userId,
      isDeleted: false,
      status: { $in: ['pending', 'approved'] },
      $or: [
        { startDate: { $lte: endDate }, endDate: { $gte: startDate } },
      ],
    };
    if (orgId) overlapFilter.organizationId = orgId;

    const overlapping = await this.leaveModel.findOne(overlapFilter);

    if (overlapping) {
      throw new ConflictException('You already have a leave request overlapping with these dates');
    }

    // Validate balance (skip for lop)
    if (dto.leaveType !== 'lop') {
      const currentYear = new Date().getFullYear();
      const balanceFilter: any = { employeeId: userId, year: currentYear };
      if (orgId) balanceFilter.organizationId = orgId;

      const balance = await this.leaveBalanceModel.findOne(balanceFilter);

      if (balance) {
        const typeBalance = balance.balances.find(b => b.leaveType === dto.leaveType);
        if (typeBalance && typeBalance.available < totalDays) {
          throw new BadRequestException(
            `Insufficient ${dto.leaveType} leave balance. Available: ${typeBalance.available}, Requested: ${totalDays}`,
          );
        }
      }
    }

    // ── WFH-specific policy enforcement ──
    // Pulls the org's `wfh` category policy (if set up in policy-service)
    // and enforces `maxDaysPerMonth`. This is the only constraint we
    // can apply at apply-time without blowing up the existing leave
    // semantics — `allowedDays` (e.g. only Mon-Wed) and `requiresApproval`
    // are layered into the approval flow / UI, not the apply guard,
    // because the existing approval endpoint already enforces approval.
    // Org without a wfh policy: no cap, anything goes (matches the
    // current behaviour for orgs that haven't configured one).
    if (dto.leaveType === 'wfh' && orgId) {
      try {
        const wfhPolicy = await this.policyClient.getWfhPolicy(orgId);
        const maxPerMonth = wfhPolicy?.wfhConfig?.maxDaysPerMonth || 0;
        if (maxPerMonth > 0) {
          // Sum WFH days already used this calendar month (any status
          // except rejected/cancelled). Counting requested+approved
          // here so a stack of pending requests doesn't push the
          // employee over the cap once they're all approved.
          const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
          const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
          const usedFilter: any = {
            employeeId: userId,
            leaveType: 'wfh',
            isDeleted: false,
            status: { $in: ['pending', 'approved'] },
            startDate: { $lte: monthEnd },
            endDate: { $gte: monthStart },
          };
          if (orgId) usedFilter.organizationId = orgId;
          const existingWfh = await this.leaveModel.find(usedFilter).lean();
          const usedDaysInMonth = existingWfh.reduce((s, l) => s + (l.totalDays || 0), 0);
          if (usedDaysInMonth + totalDays > maxPerMonth) {
            throw new BadRequestException(
              `WFH cap exceeded for ${monthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}: max ${maxPerMonth} days/month, you already have ${usedDaysInMonth} pending/approved and are requesting ${totalDays} more.`,
            );
          }
        }
      } catch (err) {
        // Policy fetch failed (network blip, policy-service down). Don't
        // block the apply — the employee can still submit and the
        // approver remains the safety net. Log so ops can spot drift.
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(`WFH policy lookup failed for org ${orgId}: ${(err as any)?.message || err}`);
      }
    }

    const leaveData: any = {
      employeeId: userId,
      leaveType: dto.leaveType,
      startDate,
      endDate,
      totalDays,
      halfDay: dto.halfDay || { enabled: false },
      reason: dto.reason,
      status: 'pending',
    };
    if (orgId) leaveData.organizationId = orgId;

    const leave = new this.leaveModel(leaveData);

    await leave.save();
    this.logger.log(`Leave applied: ${leave._id} by ${userId} - ${dto.leaveType} (${totalDays} days)`);
    return leave;
  }

  async approveLeave(
    leaveId: string,
    dto: ApproveLeaveDto,
    approverId: string,
    orgId?: string,
    authCtx?: { orgRole?: string | null; roles?: string[] },
  ) {
    const findFilter: any = { _id: leaveId, isDeleted: false };
    if (orgId) findFilter.organizationId = orgId;

    const leave = await this.leaveModel.findOne(findFilter);
    if (!leave) throw new NotFoundException('Leave request not found');

    // SEC-1 (self-approval block): even a user with the hr/manager role
    // can't approve their OWN leave — that's maker-checker fraud. Only
    // owner / admin / super_admin / platform_admin can override (audit
    // trail still records who). This is defence-in-depth on top of the
    // controller-level @Roles guard.
    if (String(leave.employeeId) === String(approverId)) {
      const overrideRoles = new Set(['owner', 'admin', 'super_admin']);
      const canOverride = (authCtx?.orgRole && overrideRoles.has(authCtx.orgRole))
        || (Array.isArray(authCtx?.roles) && authCtx!.roles.some((r) => overrideRoles.has(r)));
      if (!canOverride) {
        throw new ForbiddenException('You cannot approve your own leave request — ask another manager/HR to action it.');
      }
    }

    if (leave.status !== 'pending') {
      throw new BadRequestException(`Cannot ${dto.status === 'approved' ? 'approve' : 'reject'} a leave that is already ${leave.status}`);
    }

    leave.status = dto.status;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();

    if (dto.status === 'rejected' && dto.rejectionReason) {
      leave.rejectionReason = dto.rejectionReason;
    }

    // If approved, deduct from balance
    if (dto.status === 'approved' && leave.leaveType !== 'lop') {
      const currentYear = leave.startDate.getFullYear();
      const balanceFilter: any = { employeeId: leave.employeeId, year: currentYear };
      if (orgId) balanceFilter.organizationId = orgId;

      const balance = await this.leaveBalanceModel.findOne(balanceFilter);

      if (balance) {
        const typeBalance = balance.balances.find(b => b.leaveType === leave.leaveType);
        if (typeBalance) {
          typeBalance.used += leave.totalDays;
          typeBalance.available = typeBalance.opening + typeBalance.accrued + typeBalance.adjusted + typeBalance.carriedForward - typeBalance.used;
          await balance.save();
        }
      }
    }

    await leave.save();

    // ── WFH side-effect: auto-create attendance records ──
    // When a `wfh` leave gets approved, the employee shouldn't have to
    // clock in remotely — the approval IS the work-from-home record.
    // Without this side-effect, payroll would treat unworked WFH days
    // as `absent` and dock pay (the calculation engine groups
    // ['present','late','wfh'] as "worked" — see payroll-service
    // payroll.service.ts line ~1176 — but only if attendance docs
    // with status='wfh' actually exist).
    //
    // Implementation note: writes go to `nexora_attendance.attendances`
    // via the existing connection's `useDb()` cache — same shared-Mongo
    // pattern the platform admin uses for cross-tenant stats. Failures
    // here log a warning but don't bubble; the leave approval is
    // already durable, and ops can backfill the attendance via the
    // manual-entry endpoint if the auto-create hits a race.
    if (dto.status === 'approved' && leave.leaveType === 'wfh') {
      try {
        await this.materialiseWfhAttendance(leave, orgId);
      } catch (err) {
        this.logger.warn(
          `WFH attendance materialisation failed for leave ${leaveId}: ${(err as any)?.message || err}`,
        );
      }
    }

    this.logger.log(`Leave ${dto.status}: ${leaveId} by approver ${approverId}`);
    return leave;
  }

  /**
   * Side-effect for approved WFH leaves: walk each date in the leave's
   * range and upsert an attendance record with status='wfh'. Idempotent
   * via the natural key `(organizationId, employeeId, date)` — if the
   * employee somehow already has an attendance record for that day
   * (e.g. they did clock in before the WFH was approved), we leave it
   * alone rather than overwriting actual clock-in data.
   *
   * Skips weekends? No — that's the WFH policy's responsibility (the
   * `wfhConfig.allowedDays` field). Here we materialise exactly what
   * the leave covers; future tightening can filter by the policy if
   * we want to block Saturday/Sunday WFH-day creation.
   */
  private async materialiseWfhAttendance(leave: any, orgId?: string) {
    if (!orgId) return;
    const conn = this.leaveModel.db;
    const attDb = conn.useDb('nexora_attendance', { useCache: true });
    const attendances = attDb.collection('attendances');

    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;

    let created = 0;
    let skipped = 0;
    const cursor = new Date(start);
    cursor.setUTCHours(0, 0, 0, 0);
    const endUtc = new Date(end);
    endUtc.setUTCHours(0, 0, 0, 0);

    while (cursor.getTime() <= endUtc.getTime()) {
      const dayStart = new Date(cursor);
      const dayEnd = new Date(cursor);
      dayEnd.setUTCHours(23, 59, 59, 999);

      // Don't overwrite an existing attendance for this date — could
      // be a real clock-in or an admin-created manual entry. The WFH
      // approval implies "we trust this day was worked"; if the
      // employee already proved it via clock-in, the existing record
      // wins.
      const existing = await attendances.findOne({
        organizationId: orgId,
        employeeId: leave.employeeId,
        date: { $gte: dayStart, $lte: dayEnd },
        isDeleted: { $ne: true },
      });
      if (existing) {
        skipped++;
      } else {
        await attendances.insertOne({
          organizationId: orgId,
          employeeId: leave.employeeId,
          date: dayStart,
          checkInTime: dayStart,
          checkOutTime: dayEnd,
          checkInIP: null,
          checkOutIP: null,
          checkInLocation: null,
          checkOutLocation: null,
          checkInMethod: 'wfh_auto',
          checkOutMethod: 'wfh_auto',
          totalWorkingHours: 8,
          effectiveWorkingHours: 8,
          overtimeHours: 0,
          status: 'wfh',
          isLateArrival: false,
          lateByMinutes: 0,
          isEarlyDeparture: false,
          earlyByMinutes: 0,
          isNightShift: false,
          entryType: 'system',
          isDeleted: false,
          notes: `Auto-created from approved WFH leave ${String(leave._id)}`,
          createdBy: 'leave-service',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        created++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    this.logger.log(
      `WFH attendance materialised for leave ${String(leave._id)}: created=${created}, skipped=${skipped}`,
    );
  }

  async cancelLeave(
    leaveId: string,
    dto: CancelLeaveDto,
    userId: string,
    orgId?: string,
    authCtx?: { orgRole?: string | null; roles?: string[] },
  ) {
    const findFilter: any = { _id: leaveId, isDeleted: false };
    if (orgId) findFilter.organizationId = orgId;

    const leave = await this.leaveModel.findOne(findFilter);
    if (!leave) throw new NotFoundException('Leave request not found');

    // SEC-1 (ownership gate): cancel is intentionally not role-gated at
    // the controller because an employee is allowed to withdraw their own
    // pending/approved leave. But we must stop `cancelLeave(anyoneId)`
    // from working — the QA probe showed a developer cancelling a
    // colleague's approved leave as a prank. Non-privileged callers can
    // only cancel leaves where `employeeId === userId`.
    const privilegedRoles = new Set(['owner', 'admin', 'super_admin', 'hr', 'manager']);
    const isPrivileged = (authCtx?.orgRole && privilegedRoles.has(authCtx.orgRole))
      || (Array.isArray(authCtx?.roles) && authCtx!.roles.some((r) => privilegedRoles.has(r)));
    if (!isPrivileged && String(leave.employeeId) !== String(userId)) {
      throw new ForbiddenException('You can only cancel your own leave requests.');
    }

    if (leave.status === 'cancelled') {
      throw new BadRequestException('Leave is already cancelled');
    }

    if (leave.status === 'rejected') {
      throw new BadRequestException('Cannot cancel a rejected leave');
    }

    const wasApproved = leave.status === 'approved';

    leave.status = 'cancelled';
    leave.cancellation = {
      cancelledAt: new Date(),
      cancelledBy: userId,
      reason: dto.reason,
    };

    // If was approved, restore balance
    if (wasApproved && leave.leaveType !== 'lop') {
      const currentYear = leave.startDate.getFullYear();
      const balanceFilter: any = { employeeId: leave.employeeId, year: currentYear };
      if (orgId) balanceFilter.organizationId = orgId;

      const balance = await this.leaveBalanceModel.findOne(balanceFilter);

      if (balance) {
        const typeBalance = balance.balances.find(b => b.leaveType === leave.leaveType);
        if (typeBalance) {
          typeBalance.used -= leave.totalDays;
          typeBalance.available = typeBalance.opening + typeBalance.accrued + typeBalance.adjusted + typeBalance.carriedForward - typeBalance.used;
          await balance.save();
        }
      }
    }

    await leave.save();
    this.logger.log(`Leave cancelled: ${leaveId} by ${userId}`);
    return leave;
  }

  async getMyLeaves(userId: string, query: LeaveQueryDto, orgId?: string) {
    const { leaveType, status, startDate, endDate, page = 1, limit = 20 } = query;

    const filter: any = { employeeId: userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (leaveType) filter.leaveType = leaveType;
    if (status) filter.status = status;
    if (startDate) filter.startDate = { $gte: new Date(startDate) };
    if (endDate) filter.endDate = { ...filter.endDate, $lte: new Date(endDate) };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.leaveModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.leaveModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAllLeaves(query: LeaveQueryDto, orgId?: string) {
    const { employeeId, leaveType, status, startDate, endDate, page = 1, limit = 20 } = query;

    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (employeeId) filter.employeeId = employeeId;
    if (leaveType) filter.leaveType = leaveType;
    if (status) filter.status = status;
    if (startDate) filter.startDate = { $gte: new Date(startDate) };
    if (endDate) filter.endDate = { ...filter.endDate, $lte: new Date(endDate) };

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.leaveModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.leaveModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getMyBalance(userId: string, year?: number, orgId?: string) {
    const targetYear = year || new Date().getFullYear();
    const balanceFilter: any = { employeeId: userId, year: targetYear };
    if (orgId) balanceFilter.organizationId = orgId;

    const balance = await this.leaveBalanceModel.findOne(balanceFilter);

    if (!balance) {
      // Auto-initialize if not found
      return this.initializeBalance(userId, targetYear, orgId);
    }

    return balance;
  }

  /**
   * Admin-only: fetch a specific employee's leave balance, enriched with
   * the `encashable` flag per leave type so callers (payroll F&F, HR
   * dashboards) can decide "which of these days are cashable at exit"
   * without re-resolving the policy themselves.
   *
   * `userId` here is the auth user id — the same value stored on
   * `LeaveBalance.employeeId`. Payroll callers have the HR `_id` and
   * must resolve to `userId` via hr-service before calling.
   */
  async getBalanceForUser(userId: string, year?: number, orgId?: string) {
    const targetYear = year || new Date().getFullYear();
    const balanceFilter: any = { employeeId: userId, year: targetYear };
    if (orgId) balanceFilter.organizationId = orgId;

    let balance = await this.leaveBalanceModel.findOne(balanceFilter);
    if (!balance) {
      balance = await this.initializeBalance(userId, targetYear, orgId);
    }

    // Build a leaveType → encashable lookup from the current policy.
    // policy-service first (post-#10 source of truth), legacy
    // LeavePolicy as fallback, empty lookup if nothing configured (in
    // which case no leave type is treated as encashable — conservative
    // default that avoids over-paying).
    const encashableByType: Record<string, boolean> = {};
    if (orgId) {
      const remote = await this.policyClient.getLeavePolicy(orgId);
      for (const lt of remote?.leaveConfig?.leaveTypes ?? []) {
        encashableByType[String(lt.type)] = !!lt.encashable;
      }
    }
    if (Object.keys(encashableByType).length === 0) {
      const policyFilter: any = { status: 'active' };
      if (orgId) policyFilter.organizationId = orgId;
      const legacy = await this.leavePolicyModel.findOne(policyFilter);
      for (const lt of legacy?.leaveTypes ?? []) {
        encashableByType[String(lt.type)] = !!lt.encashable;
      }
    }

    // Return balance with encashable flag attached per entry. Using
    // `.toObject()` so the returned shape serializes cleanly through
    // the controller → HTTP response without mongoose internals.
    const plain = balance.toObject ? balance.toObject() : balance;
    const balances = (plain.balances || []).map((b: any) => ({
      ...b,
      encashable: !!encashableByType[b.leaveType],
    }));
    return { ...plain, balances };
  }

  async initializeBalance(employeeId: string, year: number, orgId?: string) {
    // Check if already exists
    const existingFilter: any = { employeeId, year };
    if (orgId) existingFilter.organizationId = orgId;

    const existing = await this.leaveBalanceModel.findOne(existingFilter);
    if (existing) return existing;

    // #10 — Consolidation: prefer policy-service as the source of truth
    // for leave rules. The local `LeavePolicy` collection is kept for
    // historical data and as a fallback when policy-service is down or
    // when a tenant hasn't migrated their leave config yet. The admin
    // UX target is one config surface (policy-service); leave-service
    // just reads it here during balance allocation.
    let leaveTypes: Array<{ type: string; annualAllocation: number }> | null =
      null;

    if (orgId) {
      const remote = await this.policyClient.getLeavePolicy(orgId);
      if (remote?.leaveConfig?.leaveTypes?.length) {
        leaveTypes = remote.leaveConfig.leaveTypes.map((lt: any) => ({
          type: lt.type,
          annualAllocation: Number(lt.annualAllocation) || 0,
        }));
        this.logger.log(
          `Leave balance for ${employeeId}/${year}: using policy-service rules (${leaveTypes.length} types)`,
        );
      }
    }

    // Fallback: legacy local LeavePolicy collection
    if (!leaveTypes) {
      const policyFilter: any = { status: 'active' };
      if (orgId) policyFilter.organizationId = orgId;
      const policy = await this.leavePolicyModel.findOne(policyFilter);
      if (policy) {
        leaveTypes = policy.leaveTypes.map((lt) => ({
          type: lt.type,
          annualAllocation: lt.annualAllocation,
        }));
        this.logger.log(
          `Leave balance for ${employeeId}/${year}: using legacy local LeavePolicy`,
        );
      }
    }

    const balances = leaveTypes
      ? leaveTypes.map((lt) => ({
          leaveType: lt.type,
          opening: lt.annualAllocation,
          accrued: 0,
          used: 0,
          adjusted: 0,
          carriedForward: 0,
          available: lt.annualAllocation,
        }))
      : [
          { leaveType: 'casual', opening: 12, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 12 },
          { leaveType: 'sick', opening: 12, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 12 },
          { leaveType: 'earned', opening: 15, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 15 },
          { leaveType: 'wfh', opening: 24, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 24 },
          { leaveType: 'maternity', opening: 180, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 180 },
          { leaveType: 'paternity', opening: 15, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 15 },
          { leaveType: 'bereavement', opening: 5, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 5 },
          { leaveType: 'comp_off', opening: 0, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 0 },
          { leaveType: 'lop', opening: 0, accrued: 0, used: 0, adjusted: 0, carriedForward: 0, available: 0 },
        ];

    const balanceData: any = { employeeId, year, balances };
    if (orgId) balanceData.organizationId = orgId;

    const leaveBalance = new this.leaveBalanceModel(balanceData);
    await leaveBalance.save();
    this.logger.log(`Leave balance initialized for ${employeeId} year ${year}`);
    return leaveBalance;
  }

  async getTeamCalendar(departmentId: string, month: number, year: number, orgId?: string) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const leavesFilter: any = {
      isDeleted: false,
      status: 'approved',
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    };
    if (orgId) leavesFilter.organizationId = orgId;

    const leaves = await this.leaveModel.find(leavesFilter).lean();

    // Group by date
    const calendar: Record<string, any[]> = {};
    for (const leave of leaves) {
      const current = new Date(Math.max(leave.startDate.getTime(), startDate.getTime()));
      const end = new Date(Math.min(leave.endDate.getTime(), endDate.getTime()));

      while (current <= end) {
        const dateKey = current.toISOString().split('T')[0];
        if (!calendar[dateKey]) calendar[dateKey] = [];
        calendar[dateKey].push({
          employeeId: leave.employeeId,
          leaveType: leave.leaveType,
          halfDay: leave.halfDay,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    return calendar;
  }

  async getStats(startDate?: string, endDate?: string, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const [pending, approved, rejected, cancelled, totalDaysUsed] = await Promise.all([
      this.leaveModel.countDocuments({ ...filter, status: 'pending' }),
      this.leaveModel.countDocuments({ ...filter, status: 'approved' }),
      this.leaveModel.countDocuments({ ...filter, status: 'rejected' }),
      this.leaveModel.countDocuments({ ...filter, status: 'cancelled' }),
      this.leaveModel.aggregate([
        { $match: { ...filter, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$totalDays' } } },
      ]),
    ]);

    return {
      pending,
      approved,
      rejected,
      cancelled,
      total: pending + approved + rejected + cancelled,
      totalDaysUsed: totalDaysUsed[0]?.total || 0,
    };
  }

  // ── Leave Policies ──

  async createLeavePolicy(dto: CreateLeavePolicyDto, createdBy: string, orgId?: string) {
    const policyData: any = { ...dto, createdBy };
    if (orgId) policyData.organizationId = orgId;

    const policy = new this.leavePolicyModel(policyData);
    await policy.save();
    this.logger.log(`Leave policy created: ${policy.policyName}`);
    return policy;
  }

  async getLeavePolicies(orgId?: string) {
    const filter: any = {};
    if (orgId) filter.organizationId = orgId;

    return this.leavePolicyModel.find(filter).sort({ createdAt: -1 });
  }

  async getLeavePolicyById(id: string, orgId?: string) {
    const filter: any = { _id: id };
    if (orgId) filter.organizationId = orgId;

    const policy = await this.leavePolicyModel.findOne(filter);
    if (!policy) throw new NotFoundException('Leave policy not found');
    return policy;
  }

  async updateLeavePolicy(id: string, dto: UpdateLeavePolicyDto, orgId?: string) {
    const filter: any = { _id: id };
    if (orgId) filter.organizationId = orgId;

    const policy = await this.leavePolicyModel.findOneAndUpdate(filter, dto, { new: true });
    if (!policy) throw new NotFoundException('Leave policy not found');
    this.logger.log(`Leave policy updated: ${policy.policyName}`);
    return policy;
  }

  async deleteLeavePolicy(id: string, orgId?: string) {
    const filter: any = { _id: id };
    if (orgId) filter.organizationId = orgId;

    const policy = await this.leavePolicyModel.findOneAndDelete(filter) as any;
    if (!policy) throw new NotFoundException('Leave policy not found');
    this.logger.log(`Leave policy deleted: ${policy.policyName}`);
    return { message: 'Leave policy deleted successfully' };
  }

  // ── Helpers ──

  private calculateBusinessDays(startDate: Date, endDate: Date): number {
    let count = 0;
    const current = new Date(startDate);

    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }

    return count;
  }
}
