import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LeavePublicApi, LeaveDaysSummary } from './leave-public-api';
import { LEAVE_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class LeavePublicApiImpl implements LeavePublicApi {
  constructor(
    @InjectModel('Leave', LEAVE_DB) private readonly leaveModel: Model<any>,
  ) {}

  async getLeavesSummary(
    organizationId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<LeaveDaysSummary> {
    const rows: any[] = await this.leaveModel.find({
      organizationId,
      employeeId,
      status: 'approved',
      isDeleted: { $ne: true },
      // overlap check: leave window touches the payroll period.
      fromDate: { $lte: periodEnd },
      toDate: { $gte: periodStart },
    }).lean();

    let paid = 0, lop = 0;
    const approvedLeaves: any[] = [];
    for (const r of rows) {
      // clip the leave to the payroll window
      const start = r.fromDate > periodStart ? r.fromDate : periodStart;
      const end = r.toDate < periodEnd ? r.toDate : periodEnd;
      const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
      if (r.isPaid) paid += days; else lop += days;
      approvedLeaves.push({
        leaveType: r.leaveType,
        fromDate: r.fromDate,
        toDate: r.toDate,
        days,
        isPaid: !!r.isPaid,
      });
    }
    return {
      organizationId,
      employeeId,
      periodStart,
      periodEnd,
      paidLeaveDays: paid,
      lopLeaveDays: lop,
      approvedLeaves,
    };
  }
}
