import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PayrollPublicApi,
  PayrollRunSummary,
  PayslipSummary,
} from './payroll-public-api';
import { PAYROLL_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class PayrollPublicApiImpl implements PayrollPublicApi {
  constructor(
    @InjectModel('PayrollRun', PAYROLL_DB) private readonly runModel: Model<any>,
    @InjectModel('Payslip', PAYROLL_DB) private readonly payslipModel: Model<any>,
  ) {}

  async getPayrollRun(runId: string, organizationId: string): Promise<PayrollRunSummary | null> {
    const r: any = await this.runModel.findOne({
      _id: runId,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    if (!r) return null;
    return {
      runId: String(r._id),
      organizationId: String(r.organizationId),
      month: r.payPeriod?.month,
      year: r.payPeriod?.year,
      status: r.status,
      totalEmployees: r.summary?.totalEmployees || 0,
      totalGross: r.summary?.totalGross || 0,
      totalNet: r.summary?.totalNet || 0,
      finalizedAt: r.finalizedAt || null,
      paidAt: r.paidAt || null,
    };
  }

  async getPayslipsForEmployee(
    employeeId: string,
    organizationId: string,
    opts: { year?: number; limit?: number } = {},
  ): Promise<PayslipSummary[]> {
    const filter: any = { employeeId, organizationId, isDeleted: { $ne: true } };
    if (opts.year) filter['payPeriod.year'] = opts.year;
    const rows: any[] = await this.payslipModel
      .find(filter)
      .sort({ 'payPeriod.year': -1, 'payPeriod.month': -1 })
      .limit(Math.min(opts.limit || 24, 60))
      .lean();
    return rows.map((p) => ({
      payslipId: String(p._id),
      payrollRunId: String(p.payrollRunId),
      employeeId: String(p.employeeId),
      organizationId: String(p.organizationId),
      month: p.payPeriod?.month,
      year: p.payPeriod?.year,
      grossEarnings: p.totals?.grossEarnings || 0,
      totalDeductions: p.totals?.totalDeductions || 0,
      netPayable: p.totals?.netPayable || 0,
      pdfUrl: p.pdfUrl || null,
    }));
  }
}
