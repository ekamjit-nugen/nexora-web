import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ILeave } from './schemas/leave.schema';
import { ILeaveBalance } from './schemas/leave-balance.schema';
import { ILeavePolicy } from './schemas/leave-policy.schema';
import {
  ApplyLeaveDto, ApproveLeaveDto, CancelLeaveDto, LeaveQueryDto,
  CreateLeavePolicyDto, UpdateLeavePolicyDto,
} from './dto/index';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectModel('Leave') private leaveModel: Model<ILeave>,
    @InjectModel('LeaveBalance') private leaveBalanceModel: Model<ILeaveBalance>,
    @InjectModel('LeavePolicy') private leavePolicyModel: Model<ILeavePolicy>,
  ) {}

  // ── Leave Requests ──

  async applyLeave(dto: ApplyLeaveDto, userId: string, orgId?: string) {
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

  async approveLeave(leaveId: string, dto: ApproveLeaveDto, approverId: string, orgId?: string) {
    const findFilter: any = { _id: leaveId, isDeleted: false };
    if (orgId) findFilter.organizationId = orgId;

    const leave = await this.leaveModel.findOne(findFilter);
    if (!leave) throw new NotFoundException('Leave request not found');

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
    this.logger.log(`Leave ${dto.status}: ${leaveId} by approver ${approverId}`);
    return leave;
  }

  async cancelLeave(leaveId: string, dto: CancelLeaveDto, userId: string, orgId?: string) {
    const findFilter: any = { _id: leaveId, isDeleted: false };
    if (orgId) findFilter.organizationId = orgId;

    const leave = await this.leaveModel.findOne(findFilter);
    if (!leave) throw new NotFoundException('Leave request not found');

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

  async initializeBalance(employeeId: string, year: number, orgId?: string) {
    // Check if already exists
    const existingFilter: any = { employeeId, year };
    if (orgId) existingFilter.organizationId = orgId;

    const existing = await this.leaveBalanceModel.findOne(existingFilter);
    if (existing) return existing;

    // Get active policy
    const policyFilter: any = { status: 'active' };
    if (orgId) policyFilter.organizationId = orgId;

    const policy = await this.leavePolicyModel.findOne(policyFilter);

    const balances = policy
      ? policy.leaveTypes.map(lt => ({
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
