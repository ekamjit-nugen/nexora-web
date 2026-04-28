/**
 * AttendancePublicApi — what other modules can ask attendance for.
 *
 * Today's known consumers:
 *   - payroll-service: getDaysSummary (presentDays, lopDays for the
 *     period — used in joining-date proration + LOP deductions).
 */
export interface AttendanceDaysSummary {
  organizationId: string;
  employeeId: string;
  periodStart: Date;
  periodEnd: Date;
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  lopDays: number;
  paidLeaveDays: number;
  holidays: number;
  weekoffs: number;
  overtimeHours: number;
}

export interface AttendancePublicApi {
  /** Per-employee attendance roll-up for a period — drives payroll. */
  getDaysSummary(
    organizationId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<AttendanceDaysSummary>;
}

export const ATTENDANCE_PUBLIC_API = Symbol('ATTENDANCE_PUBLIC_API');
