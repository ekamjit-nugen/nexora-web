import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAttendance } from './schemas/attendance.schema';
import { IShift } from './schemas/shift.schema';
import { IPolicy } from './schemas/policy.schema';
import { IAlert } from './schemas/alert.schema';
import {
  ManualEntryDto, AttendanceQueryDto,
  CreateShiftDto, UpdateShiftDto,
  CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto,
} from './dto/index';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  // Roles that cannot check-in/check-out (they manage, not track)
  private readonly EXCLUDED_ROLES = ['admin', 'super_admin'];

  constructor(
    @InjectModel('Attendance') private attendanceModel: Model<IAttendance>,
    @InjectModel('Shift') private shiftModel: Model<IShift>,
    @InjectModel('Policy') private policyModel: Model<IPolicy>,
    @InjectModel('Alert') private alertModel: Model<IAlert>,
  ) {}

  private getTodayDateRange(): { start: Date; end: Date } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start, end };
  }

  private validateNotAdmin(roles: string[]) {
    if (roles && roles.some(r => this.EXCLUDED_ROLES.includes(r))) {
      throw new ForbiddenException('Admin users do not track attendance. Use employee or HR accounts.');
    }
  }

  // ── Check In ──
  async checkIn(userId: string, roles: string[], ip: string, method: string = 'web', orgId?: string) {
    this.validateNotAdmin(roles);

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

    const attendanceData: any = {
      employeeId: userId,
      date: start,
      checkInTime: new Date(),
      checkInIP: ip,
      checkInMethod: method,
      entryType: 'system',
      status: 'present',
      createdBy: userId,
    };
    if (orgId) attendanceData.organizationId = orgId;

    const attendance = new this.attendanceModel(attendanceData);

    await attendance.save();
    this.logger.log(`Check-in recorded for user: ${userId}`);

    // Check policy compliance and generate alerts
    try {
      await this.checkPolicyCompliance(userId, attendance.checkInTime, orgId);
    } catch (err) {
      this.logger.warn(`Policy compliance check failed for ${userId}: ${err.message}`);
    }

    return attendance;
  }

  // ── Check Out ──
  async checkOut(userId: string, roles: string[], ip: string, method: string = 'web', orgId?: string) {
    this.validateNotAdmin(roles);

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

    // Per-session: just record raw hours, no status judgment
    // Status (present/half_day/absent) is determined at day-end across all sessions
    attendance.checkOutTime = checkOutTime;
    attendance.checkOutIP = ip;
    attendance.checkOutMethod = method;
    attendance.totalWorkingHours = totalWorkingHours;
    attendance.status = 'present'; // default — day-end job would recalculate

    await attendance.save();
    this.logger.log(`Check-out recorded for user: ${userId}, worked: ${totalWorkingHours}h`);
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
  async approveManualEntry(attendanceId: string, approved: boolean, approverId: string, rejectionReason?: string, orgId?: string) {
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
}
