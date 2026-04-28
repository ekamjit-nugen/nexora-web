import { Schema, Document } from 'mongoose';

export interface IAttendanceSummary {
  totalWorkingDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  lopDays: number;
  paidLeaveDays: number;
  holidays: number;
  weekoffs: number;
  overtimeHours: number;
  // Policy-aware OT split. The engine applies distinct multipliers per
  // bucket (weekday 2x, weekend/holiday 2.5x per Factories Act, night
  // shift gets a separate premium). When these are unset the engine
  // treats all `overtimeHours` as weekday. When callers pre-bucketize
  // (processPayrollRun does) the sum must match `overtimeHours` —
  // invariant relied on by downstream reports. `nightShiftOvertimeHours`
  // is orthogonal to day-type — it takes precedence when the record's
  // `isNightShift` flag is set at clock-in.
  weekdayOvertimeHours?: number;
  weekendOvertimeHours?: number;
  holidayOvertimeHours?: number;
  nightShiftOvertimeHours?: number;
}

export interface IEarningEntry {
  code: string;
  name: string;
  fullAmount: number;
  actualAmount: number;
  arrearAmount: number;
  isTaxable: boolean;
}

export interface IDeductionEntry {
  code: string;
  name: string;
  amount: number;
  category: string;
}

export interface IStatutoryEntry {
  pfEmployee: number;
  pfEmployer: number;
  pfAdminCharges: number;
  edli: number;
  esiEmployee: number;
  esiEmployer: number;
  professionalTax: number;
  lwf: number;
  tds: number;
}

export interface IReimbursementEntry {
  expenseClaimId: string;
  category: string;
  amount: number;
}

export interface IBonusEntry {
  type: string;
  description: string;
  amount: number;
  isTaxable: boolean;
}

export interface ILoanDeductionEntry {
  loanId: string;
  emiAmount: number;
  remainingBalance: number;
}

// Per-bucket OT breakdown. Persisted on the PayrollEntry so the payslip
// generator can render distinct earnings rows and a finance auditor can
// reconstruct "how did we arrive at this OT amount" without rerunning
// the engine. `capped: true` means the monthly cap clipped some hours —
// UI should surface this so the employee knows their extra hours
// weren't lost to a silent bug.
export interface IOvertimeDetail {
  weekdayHours: number;
  weekendHours: number;
  holidayHours: number;
  nightShiftHours: number;
  weekdayPay: number;
  weekendPay: number;
  holidayPay: number;
  nightShiftPay: number;
  totalPay: number;
  hourlyRate: number;
  capped: boolean;
}

export interface IPayrollEntryTotals {
  grossEarnings: number;
  totalDeductions: number;
  totalStatutory: number;
  totalReimbursements: number;
  totalBonuses: number;
  totalArrears: number;
  overtimePay: number;
  lopDeduction: number;
  netPayable: number;
}

export interface IPaymentDetails {
  mode?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  transactionRef?: string;
  paidAt?: Date;
}

export interface IPayrollEntry extends Document {
  organizationId?: string;
  payrollRunId: string;
  employeeId: string;
  salaryStructureId: string;
  payPeriod: { month: number; year: number };
  attendance: IAttendanceSummary;
  earnings: IEarningEntry[];
  deductions: IDeductionEntry[];
  statutory: IStatutoryEntry;
  reimbursements: IReimbursementEntry[];
  bonuses: IBonusEntry[];
  loanDeductions: ILoanDeductionEntry[];
  overtime?: IOvertimeDetail | null;
  totals: IPayrollEntryTotals;
  paymentDetails: IPaymentDetails;
  payslipUrl?: string;
  status: string;
  holdReason?: string;
  notes?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const PayrollEntrySchema = new Schema<IPayrollEntry>(
  {
    organizationId: { type: String, default: null, index: true },
    payrollRunId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    salaryStructureId: { type: String, required: true },
    payPeriod: {
      month: { type: Number, required: true, min: 1, max: 12 },
      year: { type: Number, required: true },
    },
    attendance: {
      totalWorkingDays: { type: Number, default: 0 },
      presentDays: { type: Number, default: 0 },
      absentDays: { type: Number, default: 0 },
      halfDays: { type: Number, default: 0 },
      lopDays: { type: Number, default: 0 },
      paidLeaveDays: { type: Number, default: 0 },
      holidays: { type: Number, default: 0 },
      weekoffs: { type: Number, default: 0 },
      overtimeHours: { type: Number, default: 0 },
      weekdayOvertimeHours: { type: Number, default: 0 },
      weekendOvertimeHours: { type: Number, default: 0 },
      holidayOvertimeHours: { type: Number, default: 0 },
      nightShiftOvertimeHours: { type: Number, default: 0 },
    },
    earnings: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        fullAmount: { type: Number, default: 0 },
        actualAmount: { type: Number, default: 0 },
        arrearAmount: { type: Number, default: 0 },
        isTaxable: { type: Boolean, default: true },
      },
    ],
    deductions: [
      {
        code: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, default: 0 },
        category: {
          type: String,
          required: true,
          enum: ['statutory', 'voluntary', 'recovery'],
        },
      },
    ],
    statutory: {
      pfEmployee: { type: Number, default: 0 },
      pfEmployer: { type: Number, default: 0 },
      pfAdminCharges: { type: Number, default: 0 },
      edli: { type: Number, default: 0 },
      esiEmployee: { type: Number, default: 0 },
      esiEmployer: { type: Number, default: 0 },
      professionalTax: { type: Number, default: 0 },
      lwf: { type: Number, default: 0 },
      tds: { type: Number, default: 0 },
    },
    reimbursements: [
      {
        expenseClaimId: { type: String, required: true },
        category: { type: String, required: true },
        amount: { type: Number, default: 0 },
      },
    ],
    bonuses: [
      {
        type: { type: String, required: true },
        description: { type: String, default: null },
        amount: { type: Number, default: 0 },
        isTaxable: { type: Boolean, default: true },
      },
    ],
    loanDeductions: [
      {
        loanId: { type: String, required: true },
        emiAmount: { type: Number, default: 0 },
        remainingBalance: { type: Number, default: 0 },
      },
    ],
    overtime: {
      weekdayHours: { type: Number, default: 0 },
      weekendHours: { type: Number, default: 0 },
      holidayHours: { type: Number, default: 0 },
      nightShiftHours: { type: Number, default: 0 },
      weekdayPay: { type: Number, default: 0 },
      weekendPay: { type: Number, default: 0 },
      holidayPay: { type: Number, default: 0 },
      nightShiftPay: { type: Number, default: 0 },
      totalPay: { type: Number, default: 0 },
      hourlyRate: { type: Number, default: 0 },
      capped: { type: Boolean, default: false },
    },
    totals: {
      grossEarnings: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalStatutory: { type: Number, default: 0 },
      totalReimbursements: { type: Number, default: 0 },
      totalBonuses: { type: Number, default: 0 },
      totalArrears: { type: Number, default: 0 },
      overtimePay: { type: Number, default: 0 },
      lopDeduction: { type: Number, default: 0 },
      netPayable: { type: Number, default: 0 },
    },
    paymentDetails: {
      // `mode` defaulted to `null` with `enum: [...]` caused every process run
      // to fail Mongoose validation — no employee could be processed until an
      // explicit mode was set, and the UI didn't surface where. Default to
      // `bank_transfer` (the overwhelmingly common case); actual mode gets
      // overwritten when the bank-payout flow syncs transactions.
      mode: {
        type: String,
        enum: ['bank_transfer', 'cheque', 'cash'],
        default: 'bank_transfer',
      },
      bankName: { type: String, default: null },
      accountNumber: { type: String, default: null },
      ifsc: { type: String, default: null },
      transactionRef: { type: String, default: null },
      paidAt: { type: Date, default: null },
    },
    payslipUrl: { type: String, default: null },
    status: {
      type: String,
      enum: ['draft', 'computed', 'reviewed', 'approved', 'paid', 'on_hold'],
      default: 'draft',
    },
    holdReason: { type: String, default: null },
    notes: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

PayrollEntrySchema.index({ organizationId: 1, payrollRunId: 1, employeeId: 1 }, { unique: true });
PayrollEntrySchema.index({ employeeId: 1, 'payPeriod.year': 1, 'payPeriod.month': 1 });
PayrollEntrySchema.index({ payrollRunId: 1, status: 1 });
PayrollEntrySchema.index({ isDeleted: 1 });
