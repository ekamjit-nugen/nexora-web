/**
 * PayrollPublicApi — cross-module surface of the payroll module.
 *
 * Payroll is mostly DOWNSTREAM (it consumes hr/auth/attendance/leave),
 * so this surface is small. Upstream consumers today:
 *   - notification-service: subscribes to 'payroll.run.finalized' and
 *     'payroll.run.paid' events to send payslip-distribution emails.
 *   - frontend: calls payroll's HTTP routes directly via the gateway,
 *     not through this public API.
 *
 * Most of the value of payroll's public-api is the EVENTS it publishes
 * (re-exported via index.ts), not the methods.
 */
export interface PayrollRunSummary {
  runId: string;
  organizationId: string;
  month: number;
  year: number;
  status: string;
  totalEmployees: number;
  totalGross: number;
  totalNet: number;
  finalizedAt: Date | null;
  paidAt: Date | null;
}

export interface PayslipSummary {
  payslipId: string;
  payrollRunId: string;
  employeeId: string;
  organizationId: string;
  month: number;
  year: number;
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  pdfUrl: string | null;
}

export interface PayrollPublicApi {
  /** Lookup a finalized run summary by id. */
  getPayrollRun(runId: string, organizationId: string): Promise<PayrollRunSummary | null>;

  /** List payslips for an employee — used by self-service my-payslips view. */
  getPayslipsForEmployee(
    employeeId: string,
    organizationId: string,
    opts?: { year?: number; limit?: number },
  ): Promise<PayslipSummary[]>;
}

export const PAYROLL_PUBLIC_API = Symbol('PAYROLL_PUBLIC_API');
