import { Injectable, Logger } from '@nestjs/common';
import {
  ISalaryStructure,
  ISalaryComponent,
} from './schemas/salary-structure.schema';
import {
  IEarningEntry,
  IDeductionEntry,
  IStatutoryEntry,
  IBonusEntry,
  ILoanDeductionEntry,
  IPayrollEntryTotals,
  IAttendanceSummary,
} from './schemas/payroll-entry.schema';

// ---------------------------------------------------------------------------
// Interfaces for method parameters
// ---------------------------------------------------------------------------

interface IPFConfig {
  applicable: boolean;
  employeeRate: number;
  employerRate: number;
  adminChargesRate: number;
  edliRate: number;
  wageCeiling: number; // in rupees
}

interface IESIConfig {
  applicable: boolean;
  employeeRate: number;
  employerRate: number;
  wageCeiling: number; // in rupees
}

interface ITDSConfig {
  applicable: boolean;
  regime: 'old' | 'new';
}

interface IPTConfig {
  applicable: boolean;
  state: string;
}

interface ILWFConfig {
  applicable: boolean;
  state: string;
}

interface IOvertimeConfig {
  applicable: boolean;
  rate: number;                    // weekday multiplier, default 2
  weekendRate?: number;             // defaults to `rate`
  holidayRate?: number;             // defaults to weekendRate ?? rate
  // Night-shift premium applied when the attendance record is flagged
  // `isNightShift` (resolved at clock-in from the shift policy). Takes
  // precedence over weekday/weekend/holiday — Factories Act §59 treats
  // night-shift hours as their own category. Defaults to `rate`.
  nightShiftMultiplier?: number;
  hoursPerDay?: number;             // standard shift length, default 8
  maxOvertimeHoursPerMonth?: number; // 0/undefined = no cap
  includeDA?: boolean;              // fold DA into hourly rate, default true
}

interface IOvertimeBreakdown {
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

// Per-run (and per-employee when overridden) LOP policy. Lets an org
// decide how half-days and absents fold into the deduction instead of
// the old hardcoded "1 absent = 1 LOP, half-day = ignored" behaviour.
interface ILopConfig {
  includeAbsentInLop: boolean;   // default true
  includeHalfDayInLop: boolean;  // default true
  halfDayLopFactor: number;      // default 0.5
}

interface IPayrollConfig {
  pfConfig: IPFConfig;
  esiConfig: IESIConfig;
  tdsConfig: ITDSConfig;
  ptConfig: IPTConfig;
  lwfConfig: ILWFConfig;
  overtime: IOvertimeConfig;
  lopConfig: ILopConfig;
}

interface IPayPeriod {
  month: number;
  year: number;
  startDate: Date;
  endDate: Date;
}

interface IInvestmentDeclarations {
  totalDeclared: number;
  totalVerified: number;
}

interface IArrearEntry {
  code: string;
  name: string;
  amount: number;
}

interface IAdhocBonus {
  type: string;
  description: string;
  amount: number;
  isTaxable: boolean;
}

interface IAdhocDeduction {
  code: string;
  name: string;
  amount: number;
}

interface ILoanDeduction {
  loanId: string;
  emiAmount: number;
  remainingBalance: number;
}

interface IComputePayrollParams {
  salaryStructure: ISalaryStructure;
  attendance: IAttendanceSummary;
  payrollConfig: IPayrollConfig;
  joiningDate?: Date;
  investmentDeclarations?: IInvestmentDeclarations;
  arrears?: IArrearEntry[];
  adhocBonuses?: IAdhocBonus[];
  adhocDeductions?: IAdhocDeduction[];
  loanDeductions?: ILoanDeduction[];
  payPeriod: IPayPeriod;
}

interface IPFResult {
  pfEmployee: number;
  pfEmployer: number;
  adminCharges: number;
  edli: number;
}

interface IESIResult {
  esiEmployee: number;
  esiEmployer: number;
}

interface ITDSResult {
  annualTax: number;
  monthlyTDS: number;
}

interface ICTCComponent {
  code: string;
  name: string;
  type: string;
  monthlyAmount: number;
  annualAmount: number;
  percentage?: number;
  calculationMethod: string;
}

interface ICTCBreakdown {
  components: ICTCComponent[];
  employerPF: number;
  employerESI: number;
  totalMonthlyGross: number;
  totalAnnualGross: number;
  totalMonthlyCTC: number;
  totalAnnualCTC: number;
}

interface IComputedPayrollResult {
  earnings: IEarningEntry[];
  deductions: IDeductionEntry[];
  statutory: IStatutoryEntry;
  bonuses: IBonusEntry[];
  loanDeductions: ILoanDeductionEntry[];
  totals: IPayrollEntryTotals;
  attendance: IAttendanceSummary;
  payPeriod: { month: number; year: number };
  netPayableInWords: string;
  // Per-bucket OT breakdown. Null when OT wasn't applicable this run.
  // processPayrollRun persists this on the PayrollEntry so the payslip
  // generator can synthesise distinct "Overtime (Weekend)" rows later.
  overtime: IOvertimeBreakdown | null;
}

// ---------------------------------------------------------------------------
// Number-to-words helpers (Indian system: lakh, crore)
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function twoDigitWords(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ' ' + ONES[o] : '');
}

function threeDigitWords(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rem = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(ONES[h] + ' Hundred');
  if (rem > 0) parts.push(twoDigitWords(rem));
  return parts.join(' and ');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PayrollCalculationService {
  private readonly logger = new Logger(PayrollCalculationService.name);

  // =========================================================================
  // Method 1: computeEmployeePayroll — main orchestrator
  // =========================================================================
  computeEmployeePayroll(params: IComputePayrollParams): IComputedPayrollResult {
    const {
      salaryStructure,
      attendance,
      payrollConfig,
      joiningDate,
      investmentDeclarations,
      arrears,
      adhocBonuses,
      adhocDeductions,
      loanDeductions,
      payPeriod,
    } = params;

    this.logger.log(
      `Computing payroll for employee ${salaryStructure.employeeId}, period ${payPeriod.month}/${payPeriod.year}`,
    );

    // --- 0. Policy-driven LOP days ---
    //
    // Historically `attendance.lopDays` was just the raw count of `absent`
    // records from attendance-service — half-days and any other nuance
    // were dropped. Make the engine consult `lopConfig` so:
    //   - half-days fold in as partial LOP (0.5 by default)
    //   - an org can explicitly opt absents *out* of LOP (rare, e.g. a
    //     paid-time-off-first policy) without touching attendance data
    // Everything else (joining proration, per-component rate) still keys
    // off this single number, so the rest of the method is unchanged.
    const effectiveLopDays = this.computeEffectiveLopDays(
      attendance,
      payrollConfig.lopConfig,
    );

    // --- 1. Earnings ---
    const earningComponents = salaryStructure.components.filter(
      (c) => c.type === 'earning',
    );
    const earnings = this.calculateEarnings(
      earningComponents,
      attendance.totalWorkingDays,
      effectiveLopDays,
      joiningDate,
      payPeriod,
    );

    // Apply arrears
    if (arrears && arrears.length > 0) {
      for (const arrear of arrears) {
        const existing = earnings.find((e) => e.code === arrear.code);
        if (existing) {
          existing.arrearAmount = arrear.amount;
          existing.actualAmount += arrear.amount;
        } else {
          earnings.push({
            code: arrear.code,
            name: arrear.name,
            fullAmount: 0,
            actualAmount: arrear.amount,
            arrearAmount: arrear.amount,
            isTaxable: true,
          });
        }
      }
    }

    const grossEarnings = earnings.reduce((sum, e) => sum + e.actualAmount, 0);
    const totalArrears = earnings.reduce((sum, e) => sum + e.arrearAmount, 0);

    // --- 2. Identify basic for PF / DA for overtime ---
    const basicComponent = earnings.find(
      (e) => e.code === 'BASIC' || e.code === 'basic',
    );
    const basicMonthly = basicComponent ? basicComponent.actualAmount : 0;

    const daComponent = earnings.find(
      (e) => e.code === 'DA' || e.code === 'da',
    );
    const daMonthly = daComponent ? daComponent.actualAmount : 0;

    // --- 3. LOP deduction (already reflected in prorated earnings, track for totals) ---
    // Use policy-driven `effectiveLopDays` so the display number matches
    // the actual proration applied above. Previously this block recomputed
    // from raw `attendance.lopDays` and the payslip's "LOP Deduction" line
    // diverged from the prorated earnings once half-days were involved.
    const fullGross = earnings.reduce((sum, e) => sum + e.fullAmount, 0);
    const displayLopDeduction = this.calculateLOP(
      fullGross,
      effectiveLopDays,
      attendance.totalWorkingDays,
    );

    // --- 4. Overtime ---
    // Policy-driven: weekday/weekend/holiday buckets each get their own
    // multiplier. Engine falls back to "all OT is weekday" when the
    // caller didn't categorise (preserves the old single-rate behaviour).
    // `includeDA` toggles whether DA folds into the hourly rate; some orgs
    // pay OT on basic alone and the engine used to assume basic+DA
    // unconditionally.
    let overtimePay = 0;
    let overtimeBreakdown: IOvertimeBreakdown | null = null;
    if (payrollConfig.overtime.applicable && attendance.overtimeHours > 0) {
      overtimeBreakdown = this.calculateOvertime(
        basicMonthly,
        daMonthly,
        attendance,
        payrollConfig.overtime,
      );
      overtimePay = overtimeBreakdown.totalPay;
    }

    // --- 5. Statutory: PF ---
    const pf = this.calculatePF(basicMonthly, payrollConfig.pfConfig);

    // --- 6. Statutory: ESI ---
    const esi = this.calculateESI(grossEarnings, payrollConfig.esiConfig);

    // --- 7. Statutory: Professional Tax ---
    const professionalTax = this.calculateProfessionalTax(
      grossEarnings,
      payrollConfig.ptConfig,
    );

    // --- 8. Statutory: TDS ---
    let monthlyTDS = 0;
    let annualTax = 0;
    if (payrollConfig.tdsConfig.applicable) {
      const annualTaxableEarnings = this.computeAnnualTaxableIncome(
        earnings,
        grossEarnings,
        adhocBonuses,
      );
      const tdsResult = this.calculateTDS(
        annualTaxableEarnings,
        payrollConfig.tdsConfig.regime,
        investmentDeclarations,
      );
      monthlyTDS = tdsResult.monthlyTDS;
      annualTax = tdsResult.annualTax;
    }

    // --- 9. LWF (Labour Welfare Fund) ---
    let lwf = 0;
    if (payrollConfig.lwfConfig.applicable) {
      lwf = this.calculateLWF(payrollConfig.lwfConfig.state, payPeriod.month);
    }

    // --- 10. Assemble statutory ---
    const statutory: IStatutoryEntry = {
      pfEmployee: pf.pfEmployee,
      pfEmployer: pf.pfEmployer,
      pfAdminCharges: pf.adminCharges,
      edli: pf.edli,
      esiEmployee: esi.esiEmployee,
      esiEmployer: esi.esiEmployer,
      professionalTax,
      lwf,
      tds: monthlyTDS,
    };

    const totalStatutoryEmployee =
      statutory.pfEmployee +
      statutory.esiEmployee +
      statutory.professionalTax +
      statutory.lwf +
      statutory.tds;

    // --- 11. Bonuses ---
    const bonuses: IBonusEntry[] = (adhocBonuses || []).map((b) => ({
      type: b.type,
      description: b.description,
      amount: b.amount,
      isTaxable: b.isTaxable,
    }));
    const totalBonuses = bonuses.reduce((sum, b) => sum + b.amount, 0);

    // --- 12. Ad-hoc deductions ---
    const deductions: IDeductionEntry[] = (adhocDeductions || []).map((d) => ({
      code: d.code,
      name: d.name,
      amount: d.amount,
      category: 'voluntary' as const,
    }));

    // Add statutory as deduction line items for payslip display
    if (statutory.pfEmployee > 0) {
      deductions.push({
        code: 'PF_EMPLOYEE',
        name: 'Provident Fund (Employee)',
        amount: statutory.pfEmployee,
        category: 'statutory',
      });
    }
    if (statutory.esiEmployee > 0) {
      deductions.push({
        code: 'ESI_EMPLOYEE',
        name: 'Employee State Insurance',
        amount: statutory.esiEmployee,
        category: 'statutory',
      });
    }
    if (statutory.professionalTax > 0) {
      deductions.push({
        code: 'PT',
        name: 'Professional Tax',
        amount: statutory.professionalTax,
        category: 'statutory',
      });
    }
    if (statutory.tds > 0) {
      deductions.push({
        code: 'TDS',
        name: 'Tax Deducted at Source',
        amount: statutory.tds,
        category: 'statutory',
      });
    }
    if (statutory.lwf > 0) {
      deductions.push({
        code: 'LWF',
        name: 'Labour Welfare Fund',
        amount: statutory.lwf,
        category: 'statutory',
      });
    }

    const totalVoluntaryDeductions = (adhocDeductions || []).reduce(
      (sum, d) => sum + d.amount,
      0,
    );

    // --- 13. Loan deductions ---
    const loanDeductionEntries: ILoanDeductionEntry[] = (loanDeductions || []).map(
      (l) => ({
        loanId: l.loanId,
        emiAmount: l.emiAmount,
        remainingBalance: l.remainingBalance,
      }),
    );
    const totalLoanDeductions = loanDeductionEntries.reduce(
      (sum, l) => sum + l.emiAmount,
      0,
    );

    // --- 14. Totals ---
    const totalDeductions =
      totalStatutoryEmployee + totalVoluntaryDeductions + totalLoanDeductions;

    const netPayable =
      grossEarnings + overtimePay + totalBonuses - totalDeductions;

    const totals: IPayrollEntryTotals = {
      grossEarnings,
      totalDeductions,
      totalStatutory: totalStatutoryEmployee,
      totalReimbursements: 0,
      totalBonuses,
      totalArrears,
      overtimePay,
      lopDeduction: displayLopDeduction,
      netPayable,
    };

    const netPayableInWords = this.numberToWords(netPayable);

    this.logger.log(
      `Payroll computed: gross=${grossEarnings}, deductions=${totalDeductions}, net=${netPayable}`,
    );

    // Echo the policy-resolved LOP back into the stored summary so the
    // payslip, downstream reports, and any audit log show the same
    // number the engine actually prorated against (not the raw absent
    // count). Keep the original `absentDays` / `halfDays` buckets intact.
    // Same story for OT: if the engine applied a cap, persist the capped
    // numbers so "actually paid" always reconciles with "actually
    // worked minus cap".
    const resolvedAttendance: IAttendanceSummary = {
      ...attendance,
      lopDays: effectiveLopDays,
      ...(overtimeBreakdown
        ? {
            overtimeHours:
              overtimeBreakdown.weekdayHours +
              overtimeBreakdown.weekendHours +
              overtimeBreakdown.holidayHours +
              overtimeBreakdown.nightShiftHours,
            weekdayOvertimeHours: overtimeBreakdown.weekdayHours,
            weekendOvertimeHours: overtimeBreakdown.weekendHours,
            holidayOvertimeHours: overtimeBreakdown.holidayHours,
            nightShiftOvertimeHours: overtimeBreakdown.nightShiftHours,
          }
        : {}),
    };

    return {
      earnings,
      deductions,
      statutory,
      bonuses,
      loanDeductions: loanDeductionEntries,
      totals,
      attendance: resolvedAttendance,
      payPeriod: { month: payPeriod.month, year: payPeriod.year },
      netPayableInWords,
      overtime: overtimeBreakdown,
    };
  }

  // =========================================================================
  // computeEffectiveLopDays — policy-driven LOP resolution
  // =========================================================================
  //
  // Fold the raw attendance buckets (absent, half-day) into a single LOP
  // day count using the org/employee `lopConfig`. Kept tiny on purpose —
  // the shape of this rule is going to grow (unpaid-leave-types, WFH
  // partial, shift-specific weights) and localising the logic means we
  // don't have to chase the arithmetic through calculateEarnings/LOP/
  // payslip rendering every time a new bucket is added.
  computeEffectiveLopDays(
    attendance: IAttendanceSummary,
    lopConfig?: ILopConfig,
  ): number {
    const cfg: ILopConfig = {
      includeAbsentInLop: lopConfig?.includeAbsentInLop ?? true,
      includeHalfDayInLop: lopConfig?.includeHalfDayInLop ?? true,
      halfDayLopFactor:
        typeof lopConfig?.halfDayLopFactor === 'number'
          ? lopConfig.halfDayLopFactor
          : 0.5,
    };

    const absentContribution = cfg.includeAbsentInLop
      ? attendance.absentDays ?? attendance.lopDays ?? 0
      : 0;
    const halfDayContribution = cfg.includeHalfDayInLop
      ? (attendance.halfDays ?? 0) * cfg.halfDayLopFactor
      : 0;

    const total = absentContribution + halfDayContribution;
    // Never exceed expected working days — a misconfigured policy
    // (e.g. halfDayLopFactor = 2) shouldn't turn earnings negative.
    const capped = Math.min(total, attendance.totalWorkingDays ?? total);
    return Math.max(0, capped);
  }

  // =========================================================================
  // Method 2: calculateEarnings
  // =========================================================================
  calculateEarnings(
    components: ISalaryComponent[],
    totalWorkingDays: number,
    lopDays: number,
    joiningDate?: Date,
    payPeriod?: IPayPeriod,
  ): IEarningEntry[] {
    const earnings: IEarningEntry[] = [];

    for (const comp of components) {
      if (comp.type !== 'earning') continue;

      const monthlyAmount = comp.monthlyAmount;
      let prorate = 1;

      // Mid-month joining proration
      if (joiningDate && payPeriod) {
        const joinDate = new Date(joiningDate);
        const periodStart = new Date(payPeriod.startDate);
        const periodEnd = new Date(payPeriod.endDate);

        if (joinDate > periodStart && joinDate <= periodEnd) {
          // Employee joined mid-month
          const totalDaysInPeriod = Math.ceil(
            (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1;
          const daysWorkedFromJoining = Math.ceil(
            (periodEnd.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1;
          prorate = daysWorkedFromJoining / totalDaysInPeriod;
        } else if (joinDate > periodEnd) {
          // Hasn't joined yet
          prorate = 0;
        }
      }

      // LOP proration (applied on top of mid-month proration)
      if (lopDays > 0 && totalWorkingDays > 0) {
        const lopFactor =
          (totalWorkingDays - lopDays) / totalWorkingDays;
        prorate = prorate * lopFactor;
      }

      const actualAmount = Math.round(monthlyAmount * prorate);

      earnings.push({
        code: comp.code,
        name: comp.name,
        fullAmount: monthlyAmount,
        actualAmount,
        arrearAmount: 0,
        isTaxable: comp.isTaxable,
      });
    }

    return earnings;
  }

  // =========================================================================
  // Method 3: calculatePF
  // =========================================================================
  calculatePF(basicMonthly: number, pfConfig: IPFConfig): IPFResult {
    if (!pfConfig.applicable) {
      return { pfEmployee: 0, pfEmployer: 0, adminCharges: 0, edli: 0 };
    }

    // Unit fix (Option B side-effect): `basicMonthly` arrives in RUPEES
    // (derived from salary-structure components which are also rupees),
    // and `pfConfig.wageCeiling` is already in rupees. Earlier code did
    // `wageCeiling * 100` assuming basicMonthly was in paise, which meant
    // the ceiling (₹15k → 1,500,000) was never lower than basic
    // (₹50,000 treated as rupees but compared to paise) and PF applied
    // on the full basic. With the ceiling now applied, PF for a ₹50k
    // basic at 12% becomes ₹1,800/mo instead of ₹6,000/mo.
    const pfWage = Math.min(basicMonthly, pfConfig.wageCeiling);

    const pfEmployee = Math.round(pfWage * pfConfig.employeeRate);
    const pfEmployer = Math.round(pfWage * pfConfig.employerRate);
    const adminCharges = Math.round(pfWage * pfConfig.adminChargesRate);
    const edli = Math.round(pfWage * pfConfig.edliRate);

    return { pfEmployee, pfEmployer, adminCharges, edli };
  }

  // =========================================================================
  // Method 4: calculateESI
  // =========================================================================
  calculateESI(grossMonthly: number, esiConfig: IESIConfig): IESIResult {
    if (!esiConfig.applicable) {
      return { esiEmployee: 0, esiEmployer: 0 };
    }

    // Unit fix: grossMonthly is already in rupees. Removing the /100
    // that was dividing it to "convert from paise" but actually turned
    // ₹95,000 → ₹950, which stayed below the ₹21,000 ceiling forever
    // so ESI applied even for highly-paid employees (wrong for India —
    // ESI only applies when gross is ≤ ₹21k).
    if (grossMonthly > esiConfig.wageCeiling) {
      return { esiEmployee: 0, esiEmployer: 0 };
    }

    const esiEmployee = Math.round(grossMonthly * esiConfig.employeeRate);
    const esiEmployer = Math.round(grossMonthly * esiConfig.employerRate);

    return { esiEmployee, esiEmployer };
  }

  // =========================================================================
  // Method 5: calculateProfessionalTax
  // =========================================================================
  calculateProfessionalTax(grossMonthly: number, ptConfig: IPTConfig): number {
    if (!ptConfig.applicable) return 0;

    // Unit fix: `grossMonthly` is in rupees (see the same fix note in
    // calculateESI). Earlier code divided by 100 pretending it was paise,
    // which made a ₹95,000 gross come out as ₹950 — every employee fell
    // into the lowest (zero-PT) slab and PT was stuck at ₹0 for everyone.
    const grossInRupees = grossMonthly;
    const state = (ptConfig.state || '').toLowerCase().trim();

    switch (state) {
      case 'maharashtra':
        return this.ptMaharashtra(grossInRupees);
      case 'karnataka':
        return this.ptKarnataka(grossInRupees);
      case 'tamil nadu':
      case 'tamilnadu':
        return this.ptTamilNadu(grossInRupees);
      case 'telangana':
        return this.ptTelangana(grossInRupees);
      case 'delhi':
        return 0; // Delhi does not levy professional tax
      case 'gujarat':
        return this.ptGujarat(grossInRupees);
      default:
        // Default to Maharashtra slabs
        this.logger.warn(
          `PT slabs not implemented for state "${ptConfig.state}", defaulting to Maharashtra`,
        );
        return this.ptMaharashtra(grossInRupees);
    }
  }

  // ---- PT slab implementations — now returning RUPEES to match the
  // rest of the pipeline. Earlier each function returned paise (e.g. 20000
  // = Rs 200) while the caller summed them straight into a rupees total,
  // producing ₹20,000/mo PT for Maharashtra. ----

  private ptMaharashtra(grossRupees: number): number {
    if (grossRupees <= 7500) return 0;
    if (grossRupees <= 10000) return 175;
    return 200; // Feb collects Rs 300 — handled via annual adjustment elsewhere
  }

  private ptKarnataka(grossRupees: number): number {
    if (grossRupees <= 15000) return 0;
    if (grossRupees <= 25000) return 150;
    return 200;
  }

  private ptTamilNadu(grossRupees: number): number {
    // Tamil Nadu collects half-yearly; monthly approximation.
    if (grossRupees <= 3500) return 0;
    if (grossRupees <= 5000) return 17; // approx Rs 97.5 half-yearly / 6
    if (grossRupees <= 7500) return 31;
    if (grossRupees <= 10000) return 63;
    if (grossRupees <= 12500) return 104;
    return 208;
  }

  private ptTelangana(grossRupees: number): number {
    if (grossRupees <= 15000) return 0;
    if (grossRupees <= 20000) return 150;
    return 200;
  }

  private ptGujarat(grossRupees: number): number {
    if (grossRupees <= 6000) return 0;
    if (grossRupees <= 9000) return 80;
    if (grossRupees <= 12000) return 150;
    return 200;
  }

  // =========================================================================
  // Method 6: calculateTDS
  // =========================================================================
  calculateTDS(
    annualTaxableIncome: number,
    regime: 'old' | 'new',
    investmentDeclarations?: IInvestmentDeclarations,
  ): ITDSResult {
    // annualTaxableIncome is in paise
    if (regime === 'old') {
      return this.calculateTDSOldRegime(annualTaxableIncome, investmentDeclarations);
    }
    return this.calculateTDSNewRegime(annualTaxableIncome);
  }

  private calculateTDSOldRegime(
    annualTaxableIncome: number,
    investmentDeclarations?: IInvestmentDeclarations,
  ): ITDSResult {
    // Standard deduction: Rs 50,000 = 5000000 paise
    const standardDeduction = 5000000;
    let taxable = annualTaxableIncome - standardDeduction;

    // Apply verified investment declarations
    if (investmentDeclarations && investmentDeclarations.totalVerified > 0) {
      // Cap 80C at Rs 1.5 lakh = 15000000 paise (simplified — actual has many sections)
      const maxExemption = 15000000;
      const exemption = Math.min(
        investmentDeclarations.totalVerified,
        maxExemption,
      );
      taxable -= exemption;
    }

    if (taxable <= 0) {
      return { annualTax: 0, monthlyTDS: 0 };
    }

    // Old regime slabs (FY 2025-26) — amounts in paise
    const slab1 = 25000000; // 2,50,000
    const slab2 = 50000000; // 5,00,000
    const slab3 = 100000000; // 10,00,000

    let tax = 0;

    if (taxable <= slab1) {
      tax = 0;
    } else if (taxable <= slab2) {
      tax = Math.round((taxable - slab1) * 0.05);
    } else if (taxable <= slab3) {
      tax = Math.round((slab2 - slab1) * 0.05 + (taxable - slab2) * 0.20);
    } else {
      tax = Math.round(
        (slab2 - slab1) * 0.05 +
        (slab3 - slab2) * 0.20 +
        (taxable - slab3) * 0.30,
      );
    }

    // Rebate u/s 87A: if taxable income <= 5,00,000, tax = 0
    if (taxable <= slab2) {
      tax = 0;
    }

    // Health and education cess: 4%
    const cess = Math.round(tax * 0.04);
    const annualTax = tax + cess;
    const monthlyTDS = Math.round(annualTax / 12);

    return { annualTax, monthlyTDS };
  }

  private calculateTDSNewRegime(annualTaxableIncome: number): ITDSResult {
    // Standard deduction: Rs 75,000 = 7500000 paise
    const standardDeduction = 7500000;
    let taxable = annualTaxableIncome - standardDeduction;

    if (taxable <= 0) {
      return { annualTax: 0, monthlyTDS: 0 };
    }

    // New regime slabs (FY 2025-26) — amounts in paise
    const slab1 = 30000000; //  3,00,000
    const slab2 = 70000000; //  7,00,000
    const slab3 = 100000000; // 10,00,000
    const slab4 = 120000000; // 12,00,000
    const slab5 = 150000000; // 15,00,000

    let tax = 0;

    if (taxable <= slab1) {
      tax = 0;
    } else if (taxable <= slab2) {
      tax = Math.round((taxable - slab1) * 0.05);
    } else if (taxable <= slab3) {
      tax = Math.round(
        (slab2 - slab1) * 0.05 +
        (taxable - slab2) * 0.10,
      );
    } else if (taxable <= slab4) {
      tax = Math.round(
        (slab2 - slab1) * 0.05 +
        (slab3 - slab2) * 0.10 +
        (taxable - slab3) * 0.15,
      );
    } else if (taxable <= slab5) {
      tax = Math.round(
        (slab2 - slab1) * 0.05 +
        (slab3 - slab2) * 0.10 +
        (slab4 - slab3) * 0.15 +
        (taxable - slab4) * 0.20,
      );
    } else {
      tax = Math.round(
        (slab2 - slab1) * 0.05 +
        (slab3 - slab2) * 0.10 +
        (slab4 - slab3) * 0.15 +
        (slab5 - slab4) * 0.20 +
        (taxable - slab5) * 0.30,
      );
    }

    // Rebate u/s 87A: if taxable income <= 7,00,000, tax = 0
    if (taxable <= slab2) {
      tax = 0;
    }

    // Health and education cess: 4%
    const cess = Math.round(tax * 0.04);
    const annualTax = tax + cess;
    const monthlyTDS = Math.round(annualTax / 12);

    return { annualTax, monthlyTDS };
  }

  // =========================================================================
  // Method 7: calculateLOP
  // =========================================================================
  calculateLOP(
    grossMonthly: number,
    lopDays: number,
    totalWorkingDays: number,
  ): number {
    if (lopDays <= 0 || totalWorkingDays <= 0) return 0;
    const perDayPay = Math.round(grossMonthly / totalWorkingDays);
    return perDayPay * lopDays;
  }

  // =========================================================================
  // Method 8: calculateOvertime — policy-driven, bucketed
  // =========================================================================
  //
  // Returns a full breakdown instead of a single number because:
  //   1. Payslip needs per-bucket rows ("Overtime (Weekend) @ 2.5x")
  //   2. Audit/reporting wants to see which buckets contributed what
  //   3. The monthly cap applies across buckets, so the breakdown must
  //      record which hours were capped — otherwise a finance user can't
  //      explain to the employee why 60 hours of OT only paid 50
  //
  // Falls back cleanly: if `attendance.weekday/weekend/holidayOvertimeHours`
  // are all undefined, we treat `attendance.overtimeHours` as pure weekday
  // OT (preserves legacy behaviour for older callers).
  calculateOvertime(
    basicMonthly: number,
    daMonthly: number,
    attendance: IAttendanceSummary,
    overtimeConfig: IOvertimeConfig,
  ): IOvertimeBreakdown {
    const zero: IOvertimeBreakdown = {
      weekdayHours: 0,
      weekendHours: 0,
      holidayHours: 0,
      nightShiftHours: 0,
      weekdayPay: 0,
      weekendPay: 0,
      holidayPay: 0,
      nightShiftPay: 0,
      totalPay: 0,
      hourlyRate: 0,
      capped: false,
    };

    const workingDays = attendance.totalWorkingDays ?? 0;
    const hoursPerDay = overtimeConfig.hoursPerDay ?? 8;
    if (workingDays <= 0 || hoursPerDay <= 0) return zero;

    // Bucketed hours, defaulting to "all weekday" if caller didn't split.
    const hasSplit =
      attendance.weekdayOvertimeHours !== undefined ||
      attendance.weekendOvertimeHours !== undefined ||
      attendance.holidayOvertimeHours !== undefined ||
      attendance.nightShiftOvertimeHours !== undefined;
    let weekdayHours = hasSplit
      ? attendance.weekdayOvertimeHours ?? 0
      : attendance.overtimeHours ?? 0;
    let weekendHours = hasSplit ? attendance.weekendOvertimeHours ?? 0 : 0;
    let holidayHours = hasSplit ? attendance.holidayOvertimeHours ?? 0 : 0;
    let nightShiftHours = hasSplit
      ? attendance.nightShiftOvertimeHours ?? 0
      : 0;

    // Monthly cap (shared across buckets). Apply in priority order —
    // night-shift > holiday > weekend > weekday — so the highest-premium
    // hours are paid first if the employee blew past the cap. Matches
    // what a finance team would do manually: "give them credit for the
    // big multipliers, trim the weekday hours."
    const cap = overtimeConfig.maxOvertimeHoursPerMonth ?? 0;
    let capped = false;
    if (cap > 0) {
      let remaining = cap;
      const take = (want: number): number => {
        const got = Math.min(want, remaining);
        remaining -= got;
        if (got < want) capped = true;
        return got;
      };
      nightShiftHours = take(nightShiftHours);
      holidayHours = take(holidayHours);
      weekendHours = take(weekendHours);
      weekdayHours = take(weekdayHours);
    }

    // Hourly rate. DA folds in by default; some orgs pay OT on basic
    // alone and the old engine assumed basic+DA unconditionally.
    const includeDA = overtimeConfig.includeDA ?? true;
    const wageForOT = includeDA ? basicMonthly + daMonthly : basicMonthly;
    const hourlyRate = Math.round(wageForOT / (workingDays * hoursPerDay));

    const weekdayRate = overtimeConfig.rate ?? 2;
    const weekendRate = overtimeConfig.weekendRate ?? weekdayRate;
    const holidayRate =
      overtimeConfig.holidayRate ?? weekendRate ?? weekdayRate;
    const nightShiftRate =
      overtimeConfig.nightShiftMultiplier ?? weekdayRate;

    const weekdayPay = Math.round(weekdayHours * hourlyRate * weekdayRate);
    const weekendPay = Math.round(weekendHours * hourlyRate * weekendRate);
    const holidayPay = Math.round(holidayHours * hourlyRate * holidayRate);
    const nightShiftPay = Math.round(
      nightShiftHours * hourlyRate * nightShiftRate,
    );
    const totalPay = weekdayPay + weekendPay + holidayPay + nightShiftPay;

    return {
      weekdayHours,
      weekendHours,
      holidayHours,
      nightShiftHours,
      weekdayPay,
      weekendPay,
      holidayPay,
      nightShiftPay,
      totalPay,
      hourlyRate,
      capped,
    };
  }

  // =========================================================================
  // Method 9: numberToWords
  // =========================================================================
  numberToWords(amountInPaise: number): string {
    if (amountInPaise === 0) return 'Rupees Zero Only';

    const isNegative = amountInPaise < 0;
    const absPaise = Math.abs(amountInPaise);
    const rupees = Math.floor(absPaise / 100);
    const paise = absPaise % 100;

    if (rupees === 0 && paise === 0) return 'Rupees Zero Only';

    const parts: string[] = [];

    if (rupees > 0) {
      parts.push('Rupees ' + this.convertRupeesToWords(rupees));
    }

    if (paise > 0) {
      if (rupees > 0) parts.push('and');
      parts.push(twoDigitWords(paise) + ' Paise');
    }

    const result = parts.join(' ') + ' Only';
    return isNegative ? 'Minus ' + result : result;
  }

  private convertRupeesToWords(n: number): string {
    if (n === 0) return '';

    // Indian system: Crore (10^7), Lakh (10^5), Thousand (10^3), Hundred (10^2)
    const crore = Math.floor(n / 10000000);
    const remaining1 = n % 10000000;
    const lakh = Math.floor(remaining1 / 100000);
    const remaining2 = remaining1 % 100000;
    const thousand = Math.floor(remaining2 / 1000);
    const remaining3 = remaining2 % 1000;

    const parts: string[] = [];

    if (crore > 0) {
      parts.push(twoDigitWords(crore) + ' Crore');
    }
    if (lakh > 0) {
      parts.push(twoDigitWords(lakh) + ' Lakh');
    }
    if (thousand > 0) {
      parts.push(twoDigitWords(thousand) + ' Thousand');
    }
    if (remaining3 > 0) {
      parts.push(threeDigitWords(remaining3));
    }

    return parts.join(' ');
  }

  // =========================================================================
  // Method 10: simulateCTCBreakdown
  // =========================================================================
  simulateCTCBreakdown(
    ctcAnnualPaise: number,
    orgComponents: ISalaryComponent[],
    pfConfig: IPFConfig,
    esiConfig: IESIConfig,
  ): ICTCBreakdown {
    const ctcMonthly = Math.round(ctcAnnualPaise / 12);

    // Step 1: Calculate basic
    const basicComponent = orgComponents.find(
      (c) => c.code === 'BASIC' || c.code === 'basic',
    );
    const basicPercentage = basicComponent?.percentage
      ? basicComponent.percentage / 100
      : 0.40;
    const basicAnnual = Math.round(ctcAnnualPaise * basicPercentage);
    const basicMonthly = Math.round(basicAnnual / 12);

    // Step 2: Calculate each component
    const components: ICTCComponent[] = [];
    let allocatedAnnual = 0;

    for (const comp of orgComponents) {
      if (comp.type !== 'earning') continue;

      let annualAmount = 0;

      switch (comp.calculationMethod) {
        case 'fixed':
          annualAmount = comp.annualAmount;
          break;
        case 'percentage_basic':
          annualAmount = Math.round(
            basicAnnual * ((comp.percentage || 0) / 100),
          );
          break;
        case 'percentage_ctc':
          annualAmount = Math.round(
            ctcAnnualPaise * ((comp.percentage || 0) / 100),
          );
          break;
        case 'percentage_gross':
          // Skip for now — gross depends on other components. Will resolve via special allowance.
          continue;
        default:
          annualAmount = comp.annualAmount;
      }

      const monthlyAmount = Math.round(annualAmount / 12);

      components.push({
        code: comp.code,
        name: comp.name,
        type: comp.type,
        monthlyAmount,
        annualAmount,
        percentage: comp.percentage,
        calculationMethod: comp.calculationMethod,
      });

      allocatedAnnual += annualAmount;
    }

    // Ensure basic is in the list
    if (!components.find((c) => c.code === 'BASIC' || c.code === 'basic')) {
      components.unshift({
        code: 'BASIC',
        name: 'Basic Salary',
        type: 'earning',
        monthlyAmount: basicMonthly,
        annualAmount: basicAnnual,
        percentage: basicPercentage * 100,
        calculationMethod: 'percentage_ctc',
      });
      allocatedAnnual += basicAnnual;
    }

    // Ensure HRA is present
    if (!components.find((c) => c.code === 'HRA' || c.code === 'hra')) {
      const hraAnnual = Math.round(basicAnnual * 0.50);
      components.push({
        code: 'HRA',
        name: 'House Rent Allowance',
        type: 'earning',
        monthlyAmount: Math.round(hraAnnual / 12),
        annualAmount: hraAnnual,
        percentage: 50,
        calculationMethod: 'percentage_basic',
      });
      allocatedAnnual += hraAnnual;
    }

    // Step 3: Employer contributions
    const employerPFAnnual = pfConfig.applicable
      ? Math.round(
          Math.min(basicMonthly, pfConfig.wageCeiling * 100) *
            pfConfig.employerRate *
            12,
        )
      : 0;

    const grossMonthlyEstimate = Math.round(
      (ctcAnnualPaise - employerPFAnnual) / 12,
    );
    const employerESIAnnual =
      esiConfig.applicable && grossMonthlyEstimate / 100 <= esiConfig.wageCeiling
        ? Math.round(grossMonthlyEstimate * esiConfig.employerRate * 12)
        : 0;

    // Step 4: Special Allowance = CTC - allocated - employer contributions
    const specialAllowanceAnnual =
      ctcAnnualPaise - allocatedAnnual - employerPFAnnual - employerESIAnnual;

    if (specialAllowanceAnnual > 0) {
      const existingSA = components.find(
        (c) => c.code === 'SPECIAL' || c.code === 'special_allowance',
      );
      if (existingSA) {
        existingSA.annualAmount = specialAllowanceAnnual;
        existingSA.monthlyAmount = Math.round(specialAllowanceAnnual / 12);
      } else {
        components.push({
          code: 'SPECIAL',
          name: 'Special Allowance',
          type: 'earning',
          monthlyAmount: Math.round(specialAllowanceAnnual / 12),
          annualAmount: specialAllowanceAnnual,
          calculationMethod: 'fixed',
        });
      }
    }

    const totalAnnualGross = components.reduce(
      (sum, c) => sum + c.annualAmount,
      0,
    );
    const totalMonthlyGross = components.reduce(
      (sum, c) => sum + c.monthlyAmount,
      0,
    );

    return {
      components,
      employerPF: employerPFAnnual,
      employerESI: employerESIAnnual,
      totalMonthlyGross,
      totalAnnualGross,
      totalMonthlyCTC: ctcMonthly,
      totalAnnualCTC: ctcAnnualPaise,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Compute annual taxable income from monthly earnings for TDS projection.
   */
  private computeAnnualTaxableIncome(
    earnings: IEarningEntry[],
    grossMonthly: number,
    adhocBonuses?: IAdhocBonus[],
  ): number {
    const taxableMonthly = earnings
      .filter((e) => e.isTaxable)
      .reduce((sum, e) => sum + e.actualAmount, 0);

    const taxableBonusAnnual = (adhocBonuses || [])
      .filter((b) => b.isTaxable)
      .reduce((sum, b) => sum + b.amount, 0);

    // Project annual income = monthly taxable * 12 + annual bonuses
    return taxableMonthly * 12 + taxableBonusAnnual;
  }

  /**
   * LWF calculation by state. LWF is typically collected in specific months
   * (June and December for most states). Returns amount in paise.
   */
  private calculateLWF(state: string, month: number): number {
    const s = (state || '').toLowerCase().trim();

    switch (s) {
      case 'maharashtra':
        // Maharashtra: employee Rs 25, collected in June and December
        if (month === 6 || month === 12) return 2500;
        return 0;
      case 'karnataka':
        // Karnataka: employee Rs 20 per annum, collected in December
        if (month === 12) return 2000;
        return 0;
      case 'tamil nadu':
      case 'tamilnadu':
        // Tamil Nadu: employee contribution varies; simplified to Rs 20 per annum
        if (month === 12) return 2000;
        return 0;
      case 'telangana':
        // Telangana: employee Rs 2 per month
        return 200;
      case 'delhi':
        // Delhi: Rs 1 per month (employee)
        return 100;
      case 'gujarat':
        // Gujarat: employee Rs 6 per half year (June, December)
        if (month === 6 || month === 12) return 600;
        return 0;
      default:
        return 0;
    }
  }
}
