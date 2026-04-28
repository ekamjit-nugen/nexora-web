import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAttendance } from './schemas/attendance.schema';
import { IShift } from './schemas/shift.schema';
import { IPolicy } from './schemas/policy.schema';
import { IAlert } from './schemas/alert.schema';
import { IHoliday } from './schemas/holiday.schema';
import { PolicyClientService } from './policy-client.service';
import {
  ManualEntryDto, AttendanceQueryDto,
  CreateShiftDto, UpdateShiftDto,
  CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto,
} from './dto/index';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  // Roles that cannot check-in/check-out — they manage attendance, not
  // track their own. Two separate sets because role models differ:
  //   • EXCLUDED_TOP_ROLES → values that appear in `user.roles[]`
  //     (platform-level roles like super_admin / admin).
  //   • EXCLUDED_ORG_ROLES → values that appear in `orgmembership.role`
  //     (per-tenant roles like owner / admin). Adding 'owner' here so
  //     a tenant owner (Varun on Nugen) doesn't get a Clock-In button
  //     on their dashboard — they review their team's attendance via
  //     the Approvals tab. HR and managers are deliberately NOT
  //     excluded; they're individual contributors who track their own
  //     hours alongside their approval duties.
  private readonly EXCLUDED_TOP_ROLES = ['admin', 'super_admin'];
  private readonly EXCLUDED_ORG_ROLES = ['admin', 'owner'];

  constructor(
    @InjectModel('Attendance', 'nexora_attendance') private attendanceModel: Model<IAttendance>,
    @InjectModel('Shift', 'nexora_attendance') private shiftModel: Model<IShift>,
    @InjectModel('Policy', 'nexora_attendance') private policyModel: Model<IPolicy>,
    @InjectModel('Alert', 'nexora_attendance') private alertModel: Model<IAlert>,
    @InjectModel('Holiday', 'nexora_attendance') private holidayModel: Model<IHoliday>,
    private readonly policyClient: PolicyClientService,
  ) {}

  private getTodayDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  private validateNotAdmin(roles: string[], orgRole?: string | null) {
    if (roles && roles.some((r) => this.EXCLUDED_TOP_ROLES.includes(r))) {
      throw new ForbiddenException('Admin users do not track attendance. Use employee or HR accounts.');
    }
    if (orgRole && this.EXCLUDED_ORG_ROLES.includes(orgRole)) {
      throw new ForbiddenException('Owners and org admins do not clock in. Use the Approvals tab to review your team.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // Shift-aware status resolution (#9) — policy-service backed (#10)
  //
  // The old pipeline set `status = 'present'` on every clock-in and left a
  // "day-end job would recalculate" comment that never shipped. #9 built
  // the classification. #10 moves the source of truth to policy-service
  // so the admin doesn't maintain the same shift config in both places.
  //
  // Resolution order:
  //   1. Policies attached to the employee via `employee.policyIds[]`
  //      (explicit override — highest priority, matches payroll-service
  //      semantics for per-employee overrides).
  //   2. Policies in policy-service with `applicableTo:'specific'` and
  //      `applicableIds` containing the employee's HR _id.
  //   3. Policies in policy-service with `applicableTo:'all'` (org-wide
  //      default shift).
  //   4. Fallback: the attendance-service local `Policy` collection,
  //      for tenants that haven't migrated their shift config yet (and
  //      for graceful degradation when policy-service is unreachable).
  //
  // Only policies in categories `working_hours`, `attendance`, or `shift`
  // with a populated `workTiming.startTime` qualify.
  // ─────────────────────────────────────────────────────────────────────
  private async resolveShiftPolicy(
    employeeId: string,
    orgId?: string,
  ): Promise<IPolicy | null> {
    // Only policy-service has org + employee-wide reach. If we don't have
    // an orgId (shouldn't happen post-Option B but keep the guard), skip
    // straight to the legacy local lookup.
    if (orgId) {
      const fromPolicyService = await this.resolveShiftPolicyFromPolicyService(
        employeeId,
        orgId,
      );
      if (fromPolicyService) return fromPolicyService;
    }
    return this.resolveShiftPolicyFromLocalCollection(employeeId, orgId);
  }

  private async resolveShiftPolicyFromPolicyService(
    employeeId: string,
    orgId: string,
  ): Promise<IPolicy | null> {
    // Attendance-service's `employeeId` is the auth user id (JWT sub);
    // policy-service's `applicableIds[]` and employee.policyIds[] key off
    // the HR employee `_id`. Join them through hr-service.
    const hrEmployee = await this.policyClient.getEmployeeByUserId(
      employeeId,
      orgId,
    );

    const policies = await this.policyClient.listActivePolicies(orgId);
    const shiftPolicies = policies.filter(
      (p) =>
        p &&
        ['working_hours', 'attendance', 'shift'].includes(p.category) &&
        p.workTiming?.startTime,
    );
    if (shiftPolicies.length === 0) return null;

    const hrId = hrEmployee?._id;
    const attachedIds = hrEmployee?.policyIds || [];

    // Tier 1: policies explicitly attached to this employee via
    // HR.policyIds[] — matches how payroll-service picks up per-employee
    // overrides (#6/7/8). Deterministic: latest effectiveFrom wins.
    const attached = shiftPolicies
      .filter((p) => attachedIds.includes(String(p._id)))
      .sort((a, b) => this.byEffectiveFromDesc(a, b));
    if (attached[0]) return this.asLocalPolicy(attached[0]);

    // Tier 2: specific-to-employee applicability.
    const specific = shiftPolicies.filter(
      (p) =>
        p.applicableTo === 'specific' &&
        hrId &&
        Array.isArray(p.applicableIds) &&
        p.applicableIds.map(String).includes(hrId),
    );
    if (specific[0]) return this.asLocalPolicy(specific[0]);

    // Tier 3: applicableTo='all' — org-wide default. Pick the most
    // recently updated one when multiple exist.
    const general = shiftPolicies
      .filter((p) => p.applicableTo === 'all')
      .sort((a, b) => this.byUpdatedAtDesc(a, b));
    if (general[0]) return this.asLocalPolicy(general[0]);

    return null;
  }

  /**
   * Legacy path: reads from attendance-service's own Policy collection.
   * Deprecated in favour of policy-service (#10) but preserved as a
   * fallback so clock-ins don't break when policy-service is down or
   * when the tenant hasn't migrated their shift config yet.
   */
  private async resolveShiftPolicyFromLocalCollection(
    employeeId: string,
    orgId?: string,
  ): Promise<IPolicy | null> {
    const filter: any = {
      isDeleted: false,
      isActive: true,
      isTemplate: false,
      $or: [
        { applicableTo: 'all' },
        { applicableTo: 'specific', applicableIds: employeeId },
      ],
    };
    if (orgId) filter.organizationId = orgId;

    const policies = await this.policyModel
      .find(filter)
      .sort({ applicableTo: -1, updatedAt: -1 });

    for (const p of policies) {
      if (p.workTiming && p.workTiming.startTime) return p;
    }
    return null;
  }

  /**
   * Shim a policy-service document into the `IPolicy` shape expected by
   * `computeShiftStatusFields`. Only the fields the resolver actually
   * touches (workTiming.*, _id) are mapped — the rest of IPolicy is
   * unused on this path and doesn't need to be constructed.
   */
  private asLocalPolicy(remote: any): IPolicy {
    return {
      _id: remote._id,
      workTiming: remote.workTiming || {},
    } as unknown as IPolicy;
  }

  private byEffectiveFromDesc(a: any, b: any): number {
    const ta = a.effectiveFrom ? new Date(a.effectiveFrom).getTime() : 0;
    const tb = b.effectiveFrom ? new Date(b.effectiveFrom).getTime() : 0;
    return tb - ta;
  }

  private byUpdatedAtDesc(a: any, b: any): number {
    const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return tb - ta;
  }

  /**
   * Resolve `isLateArrival` / `lateByMinutes` / `status` / `isNightShift`
   * against a policy's `workTiming`. Pure function — no DB writes so it
   * can be called from both clock-in (where `totalWorkingHours` is
   * unknown) and clock-out (where it's known).
   *
   * Defaults chosen to match common Indian IT-services practice:
   *   - 30 min late after grace → half_day
   *   - Worked hours < 4 → half_day regardless of late
   * Admins override per-policy via `lateToHalfDayMinutes` and
   * `minHoursForPresent`.
   */
  private computeShiftStatusFields(
    policy: IPolicy | null,
    checkInTime: Date,
    totalWorkingHours?: number,
  ): {
    isLateArrival: boolean;
    lateByMinutes: number;
    isEarlyDeparture: boolean;
    earlyByMinutes: number;
    status: 'present' | 'late' | 'half_day';
    isNightShift: boolean;
    appliedShiftPolicyId: string | null;
  } {
    const fallback = {
      isLateArrival: false,
      lateByMinutes: 0,
      isEarlyDeparture: false,
      earlyByMinutes: 0,
      status: 'present' as const,
      isNightShift: false,
      appliedShiftPolicyId: null,
    };
    if (!policy || !policy.workTiming?.startTime) return fallback;

    const wt = policy.workTiming;
    const [sh, sm] = wt.startTime.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(sm)) return fallback;

    const gracePadMin = wt.graceMinutes ?? 15;
    const lateToHalfDay = wt.lateToHalfDayMinutes ?? 30;
    const minHoursPresent = wt.minHoursForPresent ?? 4;
    const isNightShift =
      wt.isNightShift === true ||
      this.detectNightShiftWindow(wt.startTime, wt.endTime);

    // Reference "expected start" — timezone-aware (previously used
    // container-local `setHours(sh, sm)`, which is UTC in Docker and
    // produced a 5.5-hour drift against `Asia/Kolkata` policies).
    // `expectedStartInTz` returns a UTC Date representing the first
    // moment of `startTime` on check-in's *local* calendar date in
    // the policy's timezone. Falls back to container-local when
    // timezone is missing/invalid so old policies don't start failing.
    const tz = wt.timezone || 'Asia/Kolkata';
    let expectedStart = this.expectedStartInTz(checkInTime, sh, sm, tz);

    // If this is a night shift and the employee clocks in well before
    // the start (e.g. 20:00 when shift starts 22:00), the diff is
    // negative-large. Reference yesterday's start instead so
    // `lateByMinutes` reflects "early to tonight's shift", not
    // "mysteriously ahead of tomorrow's shift".
    let lateMs = checkInTime.getTime() - expectedStart.getTime();
    if (isNightShift && lateMs < -12 * 3600_000) {
      expectedStart = new Date(expectedStart.getTime() - 24 * 3600_000);
      lateMs = checkInTime.getTime() - expectedStart.getTime();
    }

    const lateMinutesRaw = Math.round(lateMs / 60_000);
    const lateBeyondGrace = Math.max(0, lateMinutesRaw - gracePadMin);
    const isLate = lateBeyondGrace > 0;

    // Early-departure detection runs only when we have clock-out data.
    let isEarly = false;
    let earlyMin = 0;
    if (
      typeof totalWorkingHours === 'number' &&
      (wt.minWorkingHours ?? 8) > 0
    ) {
      const shortfall = (wt.minWorkingHours ?? 8) - totalWorkingHours;
      if (shortfall > 0) {
        isEarly = true;
        earlyMin = Math.round(shortfall * 60);
      }
    }

    // Status resolution — policy-driven, layered:
    //   1. Worked less than minHoursForPresent → half_day (even if on time)
    //   2. Late beyond lateToHalfDay threshold → half_day
    //   3. Late beyond grace but under threshold → late
    //   4. Otherwise → present
    let status: 'present' | 'late' | 'half_day' = 'present';
    if (
      typeof totalWorkingHours === 'number' &&
      totalWorkingHours < minHoursPresent
    ) {
      status = 'half_day';
    } else if (lateBeyondGrace >= lateToHalfDay) {
      status = 'half_day';
    } else if (isLate) {
      status = 'late';
    }

    return {
      isLateArrival: isLate,
      lateByMinutes: isLate ? lateMinutesRaw : 0,
      isEarlyDeparture: isEarly,
      earlyByMinutes: earlyMin,
      status,
      isNightShift,
      appliedShiftPolicyId: String(policy._id),
    };
  }

  // startTime > endTime (string compare, HH:MM) → window wraps midnight.
  // Caller should still trust the explicit `isNightShift` bool first.
  private detectNightShiftWindow(startTime?: string, endTime?: string): boolean {
    if (!startTime || !endTime) return false;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if (!Number.isFinite(sh) || !Number.isFinite(eh)) return false;
    const startMin = sh * 60 + (sm || 0);
    const endMin = eh * 60 + (em || 0);
    return endMin <= startMin;
  }

  /**
   * Return a UTC `Date` representing the first moment of `startHH:startMM`
   * on check-in's *local* calendar date in the given timezone.
   *
   * Example: if the user clocks in at 15:18 UTC on 2026-04-23 (which is
   * 20:48 on the same date in Asia/Kolkata) and the policy says shift
   * starts at 09:00 Asia/Kolkata — we want to return 09:00 IST on
   * 2026-04-23 = 03:30 UTC 2026-04-23, not 09:00 UTC (which would be a
   * 5.5-hour drift).
   *
   * Uses `Intl.DateTimeFormat` + `Date.UTC` (no external deps).
   */
  private expectedStartInTz(
    checkInTime: Date,
    startHH: number,
    startMM: number,
    tz: string,
  ): Date {
    try {
      // 1. Get the calendar date (Y-M-D) as it appears in the target tz.
      const dateParts = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(checkInTime);
      const dm: Record<string, string> = {};
      for (const p of dateParts) dm[p.type] = p.value;

      // 2. Construct as if the tz wall-clock were UTC — a "naive" Date.
      const naiveUtcMs = Date.UTC(
        Number(dm.year),
        Number(dm.month) - 1,
        Number(dm.day),
        startHH,
        startMM,
        0,
      );

      // 3. Subtract the tz's UTC offset at that instant to get the real
      // UTC equivalent of "startHH:startMM in tz on that date".
      const offsetMin = this.tzOffsetMinutes(tz, new Date(naiveUtcMs));
      return new Date(naiveUtcMs - offsetMin * 60_000);
    } catch (e) {
      // Fallback: container-local behaviour (old bug, but at least
      // won't crash). Logged so ops can see bad tz values from policies.
      this.logger.warn(
        `Timezone resolution failed for "${tz}": ${e.message} — falling back to container-local`,
      );
      const fallback = new Date(checkInTime);
      fallback.setHours(startHH, startMM, 0, 0);
      return fallback;
    }
  }

  /**
   * Minutes the given IANA timezone is offset from UTC at a given instant.
   * Positive east (Asia/Kolkata → +330). DST-aware because Intl handles it.
   */
  private tzOffsetMinutes(tz: string, at: Date): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(at);
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    // Map "00:00:00" that some engines emit for midnight on hourCycle h23
    const hour = m.hour === '24' ? '00' : m.hour;
    const asUtc = Date.UTC(
      Number(m.year),
      Number(m.month) - 1,
      Number(m.day),
      Number(hour),
      Number(m.minute),
      Number(m.second),
    );
    return Math.round((asUtc - at.getTime()) / 60_000);
  }

  // ── Check In ──
  // `location` is captured from the browser's Geolocation API at clock-in.
  // It's optional — employees who deny the permission can still check in,
  // but the record gets stored with `checkInLocation: null` and the
  // attendance UI surfaces a "no location" badge to admins. This matters
  // for any org running geo-fence policies (workPreferences.attendance.
  // officeLocations) — a no-location record skips the geo-fence check
  // rather than failing closed, since dropping the check-in over a
  // permission denial would block legitimate users.
  async checkIn(
    userId: string,
    roles: string[],
    ip: string,
    method: string = 'web',
    orgId?: string,
    location?: { latitude: number; longitude: number; accuracy?: number; address?: string } | null,
    orgRole?: string | null,
  ) {
    this.validateNotAdmin(roles, orgRole);

    const { start, end } = this.getTodayDateRange();

    const existingFilter: any = {
      employeeId: userId,
      date: { $gte: start, $lte: end },
      isDeleted: false,
    };
    if (orgId) existingFilter.organizationId = orgId;

    const existing = await this.attendanceModel.findOne(existingFilter);

    // Find the latest record for today (there can be multiple sessions)
    const openSessionFilter: any = {
      employeeId: userId,
      date: { $gte: start, $lte: end },
      checkOutTime: null,
      isDeleted: false,
    };
    if (orgId) openSessionFilter.organizationId = orgId;

    const openSession = await this.attendanceModel.findOne(openSessionFilter);

    if (openSession) {
      throw new ConflictException('You are already clocked in. Please clock out first.');
    }
    // If all previous sessions are clocked out, allow a new clock-in

    const nowDate = new Date();

    // Resolve shift policy + classify status at clock-in. `half_day`
    // can't be decided yet (no working hours), so clock-in only sets
    // `present` or `late`; clock-out revisits and may demote to
    // `half_day` based on total hours.
    const shiftPolicy = await this.resolveShiftPolicy(userId, orgId);
    const shiftFields = this.computeShiftStatusFields(shiftPolicy, nowDate);

    const attendanceData: any = {
      employeeId: userId,
      date: start,
      checkInTime: nowDate,
      checkInIP: ip,
      checkInLocation: location || null,
      checkInMethod: method,
      entryType: 'system',
      status: shiftFields.status,
      isLateArrival: shiftFields.isLateArrival,
      lateByMinutes: shiftFields.lateByMinutes,
      isNightShift: shiftFields.isNightShift,
      appliedShiftPolicyId: shiftFields.appliedShiftPolicyId,
      createdBy: userId,
    };
    if (orgId) attendanceData.organizationId = orgId;

    const attendance = new this.attendanceModel(attendanceData);

    await attendance.save();
    this.logger.log(
      `Check-in recorded for ${userId} → status=${shiftFields.status} late=${shiftFields.lateByMinutes}min night=${shiftFields.isNightShift}`,
    );

    // Check policy compliance and generate alerts
    try {
      await this.checkPolicyCompliance(userId, attendance.checkInTime, orgId);
    } catch (err) {
      this.logger.warn(`Policy compliance check failed for ${userId}: ${err.message}`);
    }

    return attendance;
  }

  // ── Check Out ──
  // See checkIn() for the geolocation rationale — same null-tolerant
  // policy applies on the way out.
  async checkOut(
    userId: string,
    roles: string[],
    ip: string,
    method: string = 'web',
    orgId?: string,
    location?: { latitude: number; longitude: number; accuracy?: number; address?: string } | null,
    orgRole?: string | null,
  ) {
    this.validateNotAdmin(roles, orgRole);

    const { start, end } = this.getTodayDateRange();

    // Find the open (un-clocked-out) session for today
    const filter: any = {
      employeeId: userId,
      date: { $gte: start, $lte: end },
      checkOutTime: null,
      isDeleted: false,
    };
    if (orgId) filter.organizationId = orgId;

    const attendance = await this.attendanceModel.findOne(filter);

    if (!attendance) {
      throw new NotFoundException('No active clock-in found for today. Please clock in first.');
    }

    const checkOutTime = new Date();
    const checkInTime = new Date(attendance.checkInTime);
    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const totalWorkingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutIP = ip;
    attendance.checkOutLocation = location || null;
    attendance.checkOutMethod = method;
    attendance.totalWorkingHours = totalWorkingHours;

    // Re-classify now that working hours are known. Clock-in set
    // `present` or `late`; clock-out may demote to `half_day` if worked
    // hours fell below the policy's `minHoursForPresent` or if the
    // employee was late beyond `lateToHalfDayMinutes`. Also populates
    // early-departure fields against the policy's `minWorkingHours`.
    const shiftPolicy = await this.resolveShiftPolicy(userId, orgId);
    const shiftFields = this.computeShiftStatusFields(
      shiftPolicy,
      attendance.checkInTime,
      totalWorkingHours,
    );
    attendance.status = shiftFields.status;
    attendance.isLateArrival = shiftFields.isLateArrival;
    attendance.lateByMinutes = shiftFields.lateByMinutes;
    attendance.isEarlyDeparture = shiftFields.isEarlyDeparture;
    attendance.earlyByMinutes = shiftFields.earlyByMinutes;
    attendance.isNightShift = shiftFields.isNightShift;
    attendance.appliedShiftPolicyId = shiftFields.appliedShiftPolicyId;

    await attendance.save();
    this.logger.log(
      `Check-out for ${userId}: ${totalWorkingHours}h → status=${shiftFields.status} early=${shiftFields.earlyByMinutes}min night=${shiftFields.isNightShift}`,
    );
    return attendance;
  }

  // ── Queries ──

  async getMyAttendance(userId: string, startDate?: string, endDate?: string, orgId?: string) {
    const filter: any = { employeeId: userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    return this.attendanceModel.find(filter).sort({ date: -1 });
  }

  async getAllAttendance(query: AttendanceQueryDto, orgId?: string) {
    const { employeeId, startDate, endDate, status, page = 1, limit = 20 } = query;
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.attendanceModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  // ── Manual Entry (requires HR/admin approval) ──
  async createManualEntry(dto: ManualEntryDto, userId: string, orgId?: string) {
    const employeeId = dto.employeeId || userId;

    // Parse date — supports "2026-03-18" or full ISO
    const dateParts = dto.date.split('T')[0].split('-');
    const dateStart = new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]), 0, 0, 0, 0);

    const existingFilter: any = {
      employeeId,
      date: dateStart,
      isDeleted: false,
    };
    if (orgId) existingFilter.organizationId = orgId;

    const existing = await this.attendanceModel.findOne(existingFilter);

    if (existing) {
      throw new ConflictException('Attendance record already exists for this date');
    }

    // Parse check-in/out times — supports "09:00", "09:00:00", or full ISO
    const parseTime = (dateStr: string, timeStr: string): Date => {
      if (timeStr.includes('T')) return new Date(timeStr);
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(dateStart);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const checkInTime = parseTime(dto.date, dto.checkInTime);
    const checkOutTime = parseTime(dto.date, dto.checkOutTime);

    if (checkOutTime <= checkInTime) {
      throw new BadRequestException('Check-out time must be after check-in time');
    }

    const diffMs = checkOutTime.getTime() - checkInTime.getTime();
    const totalWorkingHours = parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2));
    const effectiveWorkingHours = parseFloat(Math.max(totalWorkingHours - 1, 0).toFixed(2));
    const overtimeHours = parseFloat(Math.max(effectiveWorkingHours - 8, 0).toFixed(2));

    const attendanceData: any = {
      employeeId,
      date: dateStart,
      checkInTime,
      checkOutTime,
      checkInMethod: 'web',
      checkOutMethod: 'web',
      totalWorkingHours,
      effectiveWorkingHours,
      overtimeHours,
      status: dto.status || 'present',
      entryType: 'manual',
      approvalStatus: 'pending',
      notes: dto.reason,
      createdBy: userId,
    };
    if (orgId) attendanceData.organizationId = orgId;

    const attendance = new this.attendanceModel(attendanceData);

    await attendance.save();
    this.logger.log(`Manual entry created (pending approval) for employee: ${employeeId} on ${dto.date}`);
    return attendance;
  }

  // ── Approve / Reject manual entry (HR/admin only) ──
  async approveManualEntry(
    attendanceId: string,
    approved: boolean,
    approverId: string,
    rejectionReason?: string,
    orgId?: string,
    authCtx?: { orgRole?: string | null; roles?: string[] },
  ) {
    const filter: any = {
      _id: attendanceId,
      entryType: 'manual',
      approvalStatus: 'pending',
      isDeleted: false,
    };
    if (orgId) filter.organizationId = orgId;

    const attendance = await this.attendanceModel.findOne(filter);

    if (!attendance) {
      throw new NotFoundException('Manual entry not found or already processed');
    }

    // SEC-2 (self-approval block): a manager can't approve an attendance
    // entry they submitted themselves — that's the fraud vector of
    // backdating/fabricating entries and rubber-stamping your own.
    // Admins/owners can override (audit trail records who did it).
    if (String(attendance.employeeId) === String(approverId)) {
      const overrideRoles = new Set(['owner', 'admin', 'super_admin']);
      const canOverride = (authCtx?.orgRole && overrideRoles.has(authCtx.orgRole))
        || (Array.isArray(authCtx?.roles) && authCtx!.roles.some((r) => overrideRoles.has(r)));
      if (!canOverride) {
        throw new ForbiddenException('You cannot approve your own attendance entry — ask another manager/HR to action it.');
      }
    }

    attendance.approvalStatus = approved ? 'approved' : 'rejected';
    attendance.approvedBy = approverId;
    attendance.approvedAt = new Date();
    if (!approved && rejectionReason) {
      attendance.rejectionReason = rejectionReason;
    }

    await attendance.save();
    this.logger.log(`Manual entry ${approved ? 'approved' : 'rejected'} for ${attendance.employeeId} by ${approverId}`);
    return attendance;
  }

  // ── Get pending manual entries (for HR/admin) ──
  async getPendingManualEntries(page = 1, limit = 20, orgId?: string) {
    const filter: any = { entryType: 'manual', approvalStatus: 'pending', isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.attendanceModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getTodayStatus(userId: string, orgId?: string) {
    const { start, end } = this.getTodayDateRange();

    // Get all today's sessions sorted by clock-in time ascending
    const sessionsFilter: any = { employeeId: userId, date: { $gte: start, $lte: end }, isDeleted: false, entryType: { $ne: 'manual' } };
    if (orgId) sessionsFilter.organizationId = orgId;

    const sessions = await this.attendanceModel
      .find(sessionsFilter)
      .sort({ checkInTime: 1 });

    if (sessions.length === 0) {
      return { checkedIn: false, checkedOut: false, hasOpenSession: false, record: null, sessions: [], totalHoursToday: 0, sessionCount: 0, firstClockIn: null };
    }

    const latest = sessions[sessions.length - 1];
    const isOpen = !latest.checkOutTime;

    // Sum total hours across all completed sessions + running current session
    let totalHoursToday = 0;
    for (const s of sessions) {
      if (s.totalWorkingHours) {
        totalHoursToday += s.totalWorkingHours;
      } else if (!s.checkOutTime && s.checkInTime) {
        // Open session — add elapsed time
        const elapsed = (new Date().getTime() - new Date(s.checkInTime).getTime()) / (1000 * 60 * 60);
        totalHoursToday += elapsed;
      }
    }

    return {
      checkedIn: true,
      checkedOut: !isOpen,
      hasOpenSession: isOpen,
      record: latest,
      sessions,
      totalHoursToday: parseFloat(totalHoursToday.toFixed(2)),
      sessionCount: sessions.length,
      firstClockIn: sessions[0].checkInTime,
    };
  }

  async getStats(startDate?: string, endDate?: string, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const pendingFilter: any = { entryType: 'manual', approvalStatus: 'pending', isDeleted: false };
    if (orgId) pendingFilter.organizationId = orgId;

    const [present, late, absent, halfDay, wfh, leave, pendingApprovals, total] = await Promise.all([
      this.attendanceModel.countDocuments({ ...filter, status: 'present' }),
      this.attendanceModel.countDocuments({ ...filter, status: 'late' }),
      this.attendanceModel.countDocuments({ ...filter, status: 'absent' }),
      this.attendanceModel.countDocuments({ ...filter, status: 'half_day' }),
      this.attendanceModel.countDocuments({ ...filter, status: 'wfh' }),
      this.attendanceModel.countDocuments({ ...filter, status: 'leave' }),
      this.attendanceModel.countDocuments(pendingFilter),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { total, present, late, absent, halfDay, wfh, leave, pendingApprovals };
  }

  // ── Shifts CRUD ──

  async createShift(dto: CreateShiftDto, userId: string, orgId?: string) {
    const shiftData: any = { ...dto, createdBy: userId };
    if (orgId) shiftData.organizationId = orgId;
    const shift = new this.shiftModel(shiftData);
    await shift.save();
    this.logger.log(`Shift created: ${shift.shiftName}`);
    return shift;
  }

  async getShifts(orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.shiftModel.find(filter).sort({ shiftName: 1 });
  }

  async getShiftById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const shift = await this.shiftModel.findOne(filter);
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async updateShift(id: string, dto: UpdateShiftDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const shift = await this.shiftModel.findOneAndUpdate(filter, dto, { new: true });
    if (!shift) throw new NotFoundException('Shift not found');
    return shift;
  }

  async deleteShift(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const shift = await this.shiftModel.findOneAndUpdate(filter, { isDeleted: true, isActive: false }, { new: true });
    if (!shift) throw new NotFoundException('Shift not found');
    return { message: 'Shift deleted successfully' };
  }

  // ── Policies CRUD ──

  async createPolicy(dto: CreatePolicyDto, userId: string, orgId?: string) {
    const policyData: any = { ...dto, createdBy: userId };
    if (orgId) policyData.organizationId = orgId;
    const policy = new this.policyModel(policyData);
    await policy.save();
    this.logger.log(`Policy created: ${policy.policyName}`);
    return policy;
  }

  async getPolicies(query: PolicyQueryDto, orgId?: string) {
    const { type, category, applicableTo, isTemplate, isActive, page = 1, limit = 50 } = query;
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (applicableTo) filter.applicableTo = applicableTo;
    if (isTemplate !== undefined) filter.isTemplate = isTemplate;
    if (isActive !== undefined) filter.isActive = isActive;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.policyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.policyModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getPolicyById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const policy = await this.policyModel.findOne(filter);
    if (!policy) throw new NotFoundException('Policy not found');
    return policy;
  }

  async updatePolicy(id: string, dto: UpdatePolicyDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const policy = await this.policyModel.findOneAndUpdate(
      filter,
      { $set: dto },
      { new: true },
    );
    if (!policy) throw new NotFoundException('Policy not found');
    this.logger.log(`Policy updated: ${policy.policyName}`);
    return policy;
  }

  async deletePolicy(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const policy = await this.policyModel.findOneAndUpdate(
      filter,
      { isDeleted: true, isActive: false },
      { new: true },
    );
    if (!policy) throw new NotFoundException('Policy not found');
    return { message: 'Policy deleted successfully' };
  }

  async getTemplates(orgId?: string) {
    const filter: any = { isTemplate: true, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.policyModel.find(filter).sort({ templateName: 1 });
  }

  async createFromTemplate(templateId: string, overrides: Partial<CreatePolicyDto>, userId: string, orgId?: string) {
    const templateFilter: any = { _id: templateId, isTemplate: true, isDeleted: false };
    if (orgId) templateFilter.organizationId = orgId;
    const template = await this.policyModel.findOne(templateFilter);
    if (!template) throw new NotFoundException('Template not found');

    const templateObj = template.toObject();
    delete templateObj._id;
    delete templateObj.__v;
    delete templateObj.createdAt;
    delete templateObj.updatedAt;

    const policyData: any = {
      ...templateObj,
      ...overrides,
      isTemplate: false,
      templateName: null,
      policyName: overrides.policyName || `${template.policyName} (Copy)`,
      createdBy: userId,
    };
    if (orgId) policyData.organizationId = orgId;

    const policy = new this.policyModel(policyData);
    await policy.save();
    this.logger.log(`Policy created from template "${template.templateName}": ${policy.policyName}`);
    return policy;
  }

  // ── Policy Compliance ──

  async checkPolicyCompliance(userId: string, clockInTime: Date, orgId?: string): Promise<IAlert[]> {
    // Find applicable policies for this user
    const policyFilter: any = {
      isDeleted: false,
      isActive: true,
      isTemplate: false,
      $or: [
        { applicableTo: 'all' },
        { applicableTo: 'specific', applicableIds: userId },
      ],
    };
    if (orgId) policyFilter.organizationId = orgId;

    const policies = await this.policyModel.find(policyFilter);

    const alerts: IAlert[] = [];
    const now = clockInTime instanceof Date ? clockInTime : new Date(clockInTime);

    for (const policy of policies) {
      if (!policy.workTiming || !policy.alerts) continue;

      const { startTime, graceMinutes } = policy.workTiming;
      if (!startTime) continue;

      // Parse policy start time
      const [startH, startM] = startTime.split(':').map(Number);
      const policyStart = new Date(now);
      policyStart.setHours(startH, startM, 0, 0);

      // Add grace period
      const graceEnd = new Date(policyStart.getTime() + (graceMinutes || 0) * 60 * 1000);

      // Check late arrival
      if (policy.alerts.lateArrival && now > graceEnd) {
        const lateMinutes = Math.round((now.getTime() - policyStart.getTime()) / (1000 * 60));
        const severity = lateMinutes > 60 ? 'critical' : lateMinutes > 30 ? 'warning' : 'info';
        const alertData: any = {
          employeeId: userId,
          policyId: policy._id,
          alertType: 'late_arrival',
          message: `Late arrival by ${lateMinutes} minutes. Policy "${policy.policyName}" expects clock-in by ${startTime}.`,
          date: now,
          severity,
        };
        if (orgId) alertData.organizationId = orgId;
        const alert = new this.alertModel(alertData);
        await alert.save();
        alerts.push(alert);
      }
    }

    return alerts;
  }

  // ── Alerts ──

  async getAlerts(query: { employeeId?: string; alertType?: string; acknowledged?: boolean; page?: number; limit?: number }, orgId?: string) {
    const { employeeId, alertType, acknowledged, page = 1, limit = 20 } = query;
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (employeeId) filter.employeeId = employeeId;
    if (alertType) filter.alertType = alertType;
    if (acknowledged !== undefined) filter.acknowledged = acknowledged;

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.alertModel.find(filter).sort({ date: -1 }).skip(skip).limit(limit),
      this.alertModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getMyAlerts(userId: string, orgId?: string) {
    const filter: any = { employeeId: userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.alertModel.find(filter).sort({ date: -1 }).limit(50);
  }

  async acknowledgeAlert(alertId: string, userId: string, orgId?: string) {
    const filter: any = { _id: alertId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const alert = await this.alertModel.findOne(filter);
    if (!alert) throw new NotFoundException('Alert not found');

    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    await alert.save();
    this.logger.log(`Alert ${alertId} acknowledged by ${userId}`);
    return alert;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Holiday calendar CRUD
  //
  // Year-scoped by design: most orgs browse one FY at a time and
  // redeclare from scratch each year (regional holidays shift with
  // lunar calendars). The year field is denormalized on insert so we
  // don't have to index by `date.$year` at query time.
  // ─────────────────────────────────────────────────────────────────────

  async listHolidays(orgId: string, year?: number): Promise<IHoliday[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const filter: any = { organizationId: orgId, isDeleted: false };
    if (year) filter.year = year;
    return this.holidayModel.find(filter).sort({ date: 1 });
  }

  async createHoliday(
    dto: {
      date: string;         // ISO yyyy-mm-dd
      name: string;
      type?: string;
      description?: string;
    },
    userId: string,
    orgId: string,
  ): Promise<IHoliday> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    if (!dto.date || !dto.name?.trim()) {
      throw new BadRequestException('date and name are required');
    }

    // Normalize to UTC midnight so (orgId, date) uniqueness works
    // regardless of what timezone the admin's client submitted.
    // Accepts both full ISO ("2026-01-26T00:00:00Z") and date-only
    // ("2026-01-26"). A date-only string parses as UTC already.
    const d = new Date(dto.date);
    if (isNaN(d.getTime())) {
      throw new BadRequestException(`Invalid date: ${dto.date}`);
    }
    const utcDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const year = utcDay.getUTCFullYear();

    // Idempotent-ish: if a soft-deleted record exists for the same
    // date, revive it instead of failing on the partial unique index.
    const existing = await this.holidayModel.findOne({
      organizationId: orgId,
      date: utcDay,
    });
    if (existing) {
      if (!existing.isDeleted) {
        throw new ConflictException(
          `A holiday already exists on ${utcDay.toISOString().slice(0, 10)}: "${existing.name}"`,
        );
      }
      existing.isDeleted = false;
      existing.name = dto.name.trim();
      existing.type = (dto.type as any) || 'national';
      existing.description = dto.description?.trim() || null;
      existing.year = year;
      return existing.save();
    }

    const holiday = new this.holidayModel({
      organizationId: orgId,
      date: utcDay,
      name: dto.name.trim(),
      type: dto.type || 'national',
      description: dto.description?.trim() || null,
      year,
      createdBy: userId,
    });
    await holiday.save();
    this.logger.log(
      `Holiday created: ${holiday.name} on ${utcDay.toISOString().slice(0, 10)} by ${userId}`,
    );
    return holiday;
  }

  async deleteHoliday(id: string, userId: string, orgId: string): Promise<{ ok: true }> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const holiday = await this.holidayModel.findOne({
      _id: id,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!holiday) throw new NotFoundException('Holiday not found');
    holiday.isDeleted = true;
    await holiday.save();
    this.logger.log(
      `Holiday deleted: ${holiday.name} on ${holiday.date.toISOString().slice(0, 10)} by ${userId}`,
    );
    return { ok: true };
  }

  /**
   * Bulk fetch holidays intersecting a date range. Used by payroll
   * during processPayrollRun to reclassify absents-on-holiday before
   * LOP computation. Returns UTC-midnight ISO date strings for easy
   * `has(date)` lookups.
   */
  async getHolidaysInRange(
    orgId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<string[]> {
    const rows = await this.holidayModel
      .find({
        organizationId: orgId,
        isDeleted: false,
        date: { $gte: startDate, $lte: endDate },
      })
      .select('date')
      .lean();
    return rows.map((r: any) => (r.date as Date).toISOString().slice(0, 10));
  }
}
