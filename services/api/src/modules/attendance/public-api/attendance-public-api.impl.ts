import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AttendancePublicApi, AttendanceDaysSummary } from './attendance-public-api';
import { ATTENDANCE_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class AttendancePublicApiImpl implements AttendancePublicApi {
  constructor(
    @InjectModel('Attendance', ATTENDANCE_DB) private readonly attendanceModel: Model<any>,
  ) {}

  async getDaysSummary(
    organizationId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AttendanceDaysSummary> {
    // Group + count attendance rows in the period. Mirrors what the
    // legacy attendance HTTP endpoint computes — kept lean here so the
    // method returns exactly the shape payroll's calc engine needs.
    const rows: any[] = await this.attendanceModel.find({
      organizationId,
      employeeId,
      date: { $gte: periodStart, $lte: periodEnd },
      isDeleted: { $ne: true },
    }).lean();

    let presentDays = 0, absentDays = 0, halfDays = 0;
    let lopDays = 0, paidLeaveDays = 0, holidays = 0, weekoffs = 0;
    let overtimeHours = 0;
    for (const r of rows) {
      switch (r.status) {
        case 'present':       presentDays++; break;
        case 'absent':        absentDays++; break;
        case 'half_day':      halfDays++; break;
        case 'lop':           lopDays++; break;
        case 'paid_leave':    paidLeaveDays++; break;
        case 'holiday':       holidays++; break;
        case 'weekoff':       weekoffs++; break;
      }
      overtimeHours += Number(r.overtimeHours || 0);
    }
    // Total working days = period span minus weekoffs and holidays.
    const totalCalDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86_400_000) + 1;
    const totalWorkingDays = Math.max(0, totalCalDays - weekoffs - holidays);

    return {
      organizationId,
      employeeId,
      periodStart,
      periodEnd,
      totalWorkingDays,
      presentDays,
      absentDays,
      halfDays,
      lopDays,
      paidLeaveDays,
      holidays,
      weekoffs,
      overtimeHours,
    };
  }
}
