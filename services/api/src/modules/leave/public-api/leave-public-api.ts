/**
 * LeavePublicApi — what other modules can ask leave for.
 *
 * Today's known consumer: payroll. Payroll's calc engine needs to know
 * which days an employee was on PAID leave (no LOP) vs LOP leave for
 * the period being processed.
 */
export interface LeaveDaysSummary {
  organizationId: string;
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  paidLeaveDays: number;
  lopLeaveDays: number;
  approvedLeaves: Array<{
    leaveType: string;
    fromDate: Date;
    toDate: Date;
    days: number;
    isPaid: boolean;
  }>;
}

export interface LeavePublicApi {
  getLeavesSummary(
    organizationId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<LeaveDaysSummary>;
}

export const LEAVE_PUBLIC_API = Symbol('LEAVE_PUBLIC_API');
