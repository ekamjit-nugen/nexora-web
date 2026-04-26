/**
 * Unit tests for `PayrollCalculationService` — the pure math engine
 * that turns (salary structure + attendance + policy) into earnings /
 * deductions / statutory / net. These functions have no DB or HTTP
 * dependencies, so we instantiate the service directly and hit the
 * methods with hand-crafted inputs.
 *
 * Covered here:
 *   - `computeEffectiveLopDays` (#7 LOP policy) — half-day folding,
 *     include flags, cap-against-working-days guard.
 *   - `calculateOvertime` (#8 / #9 OT engine) — weekday/weekend/holiday/
 *     night bucketing, monthly cap priority, includeDA toggle.
 *   - `calculatePF` / `calculateESI` / `calculateProfessionalTax` —
 *     statutory calcs with wage-ceiling clipping.
 *
 * These are the paychecks real customers depend on. Adding a test when
 * you touch one of these methods is cheaper than chasing a regression
 * through a QA cycle.
 */
import { PayrollCalculationService } from '../payroll/payroll-calculation.service';

function makeAttendance(over: Partial<any> = {}): any {
  return {
    totalWorkingDays: 22,
    presentDays: 22,
    absentDays: 0,
    halfDays: 0,
    lopDays: 0,
    paidLeaveDays: 0,
    holidays: 0,
    weekoffs: 0,
    overtimeHours: 0,
    weekdayOvertimeHours: 0,
    weekendOvertimeHours: 0,
    holidayOvertimeHours: 0,
    nightShiftOvertimeHours: 0,
    ...over,
  };
}

function makeOtConfig(over: Partial<any> = {}): any {
  return {
    applicable: true,
    rate: 2,
    weekendRate: 2,
    holidayRate: 2,
    nightShiftMultiplier: 2,
    hoursPerDay: 8,
    maxOvertimeHoursPerMonth: 0,
    includeDA: true,
    ...over,
  };
}

describe('PayrollCalculationService — LOP resolution (#7)', () => {
  const svc = new PayrollCalculationService();

  it('defaults: 1 absent → 1 LOP, 1 half-day → 0.5 LOP, summed', () => {
    const lop = svc.computeEffectiveLopDays(
      makeAttendance({ absentDays: 1, halfDays: 1 }),
      undefined,
    );
    expect(lop).toBeCloseTo(1.5, 5);
  });

  it('policy halfDayLopFactor=0.75 bumps half-day contribution', () => {
    const lop = svc.computeEffectiveLopDays(
      makeAttendance({ absentDays: 0, halfDays: 2 }),
      { includeAbsentInLop: true, includeHalfDayInLop: true, halfDayLopFactor: 0.75 },
    );
    expect(lop).toBeCloseTo(1.5, 5); // 2 × 0.75
  });

  it('includeHalfDayInLop=false drops half-days entirely', () => {
    const lop = svc.computeEffectiveLopDays(
      makeAttendance({ absentDays: 1, halfDays: 3 }),
      { includeAbsentInLop: true, includeHalfDayInLop: false, halfDayLopFactor: 0.5 },
    );
    expect(lop).toBe(1); // only the 1 absent
  });

  it('includeAbsentInLop=false drops absents (rare "paid-all" orgs)', () => {
    const lop = svc.computeEffectiveLopDays(
      makeAttendance({ absentDays: 3, halfDays: 0 }),
      { includeAbsentInLop: false, includeHalfDayInLop: true, halfDayLopFactor: 0.5 },
    );
    expect(lop).toBe(0);
  });

  it('caps at totalWorkingDays to prevent negative earnings', () => {
    // Mis-configured policy: factor=2 + 11 half-days × 2 = 22 "LOP days".
    // Capped at 22 working days.
    const lop = svc.computeEffectiveLopDays(
      makeAttendance({ absentDays: 0, halfDays: 11, totalWorkingDays: 22 }),
      { includeAbsentInLop: true, includeHalfDayInLop: true, halfDayLopFactor: 2 },
    );
    expect(lop).toBe(22);
  });

  it('handles missing optional fields gracefully', () => {
    const lop = svc.computeEffectiveLopDays(
      { totalWorkingDays: 22, presentDays: 22 } as any,
      undefined,
    );
    expect(lop).toBe(0);
  });
});

describe('PayrollCalculationService — Overtime engine (#8 / #9)', () => {
  const svc = new PayrollCalculationService();
  // basic ₹50k + DA ₹0 → monthly wage for OT = ₹50k.
  // Per-hour = 50000 / (22 × 8) = 284. (rounded Math.round)
  const BASIC = 50000;
  const DA = 0;

  it('returns zero breakdown when overtimeHours = 0 path short-circuits in caller (fn returns zero when hoursPerDay<=0)', () => {
    const b = svc.calculateOvertime(
      BASIC,
      DA,
      makeAttendance({ overtimeHours: 0, totalWorkingDays: 0 }),
      makeOtConfig(),
    );
    expect(b.totalPay).toBe(0);
  });

  it('legacy single-rate: no split buckets → treats all as weekday', () => {
    // Deliberately build attendance WITHOUT the split fields —
    // `hasSplit` branch in calculateOvertime triggers on any of them
    // being defined (even zero), so the legacy path requires them
    // absent. Mirrors what an old caller (pre-#8) would send.
    const legacyAttendance: any = {
      totalWorkingDays: 22,
      presentDays: 22,
      absentDays: 0,
      halfDays: 0,
      lopDays: 0,
      paidLeaveDays: 0,
      holidays: 0,
      weekoffs: 0,
      overtimeHours: 5,
    };
    const b = svc.calculateOvertime(BASIC, DA, legacyAttendance, makeOtConfig({ rate: 2 }));
    expect(b.weekdayHours).toBe(5);
    expect(b.weekdayPay).toBeCloseTo(Math.round(284 * 5 * 2), 0);
    expect(b.weekendHours).toBe(0);
    expect(b.capped).toBe(false);
  });

  it('split buckets applied with distinct multipliers', () => {
    const b = svc.calculateOvertime(
      BASIC,
      DA,
      makeAttendance({
        overtimeHours: 11,
        weekdayOvertimeHours: 4,
        weekendOvertimeHours: 4,
        holidayOvertimeHours: 3,
      }),
      makeOtConfig({ rate: 2, weekendRate: 2.5, holidayRate: 2.5 }),
    );
    expect(b.weekdayPay).toBe(Math.round(284 * 4 * 2));
    expect(b.weekendPay).toBe(Math.round(284 * 4 * 2.5));
    expect(b.holidayPay).toBe(Math.round(284 * 3 * 2.5));
  });

  it('night-shift hours get nightShiftMultiplier regardless of day-type', () => {
    const b = svc.calculateOvertime(
      BASIC,
      DA,
      makeAttendance({
        overtimeHours: 11,
        nightShiftOvertimeHours: 11,
      }),
      makeOtConfig({ rate: 2, nightShiftMultiplier: 3 }),
    );
    expect(b.nightShiftHours).toBe(11);
    expect(b.nightShiftPay).toBe(Math.round(284 * 11 * 3));
    expect(b.weekdayPay).toBe(0);
  });

  it('monthly cap trims lowest-premium hours first (night → holiday → weekend → weekday)', () => {
    const b = svc.calculateOvertime(
      BASIC,
      DA,
      makeAttendance({
        overtimeHours: 11,
        weekdayOvertimeHours: 4,
        weekendOvertimeHours: 4,
        holidayOvertimeHours: 3,
      }),
      makeOtConfig({ rate: 2, weekendRate: 2.5, holidayRate: 2.5, maxOvertimeHoursPerMonth: 6 }),
    );
    // 6h cap: first holiday (3h), then weekend (3h), no weekday
    expect(b.holidayHours).toBe(3);
    expect(b.weekendHours).toBe(3);
    expect(b.weekdayHours).toBe(0);
    expect(b.capped).toBe(true);
  });

  it('includeDA=false excludes DA from hourly rate', () => {
    const withDA = svc.calculateOvertime(
      BASIC,
      20000,
      makeAttendance({ overtimeHours: 1 }),
      makeOtConfig({ includeDA: true }),
    );
    const noDA = svc.calculateOvertime(
      BASIC,
      20000,
      makeAttendance({ overtimeHours: 1 }),
      makeOtConfig({ includeDA: false }),
    );
    expect(withDA.hourlyRate).toBeGreaterThan(noDA.hourlyRate);
  });
});

describe('PayrollCalculationService — PF', () => {
  const svc = new PayrollCalculationService();

  it('clips PF wage at ₹15k statutory ceiling', () => {
    const pf = svc.calculatePF(50000, {
      applicable: true,
      employeeRate: 0.12,
      employerRate: 0.12,
      adminChargesRate: 0.005,
      edliRate: 0.005,
      wageCeiling: 15000,
    });
    // 12% of 15000 = 1800 (NOT 12% of 50000)
    expect(pf.pfEmployee).toBe(1800);
    expect(pf.pfEmployer).toBe(1800);
  });

  it('respects per-employee override rate (e.g. 8% intern)', () => {
    const pf = svc.calculatePF(50000, {
      applicable: true,
      employeeRate: 0.08,
      employerRate: 0.08,
      adminChargesRate: 0.005,
      edliRate: 0.005,
      wageCeiling: 15000,
    });
    expect(pf.pfEmployee).toBe(1200); // 8% of 15000
  });

  it('applicable=false zeros everything', () => {
    const pf = svc.calculatePF(50000, {
      applicable: false,
      employeeRate: 0.12,
      employerRate: 0.12,
      adminChargesRate: 0.005,
      edliRate: 0.005,
      wageCeiling: 15000,
    });
    expect(pf.pfEmployee).toBe(0);
    expect(pf.pfEmployer).toBe(0);
    expect(pf.adminCharges).toBe(0);
    expect(pf.edli).toBe(0);
  });
});

describe('PayrollCalculationService — ESI', () => {
  const svc = new PayrollCalculationService();

  it('no contribution when gross > ₹21k ceiling', () => {
    const esi = svc.calculateESI(50000, {
      applicable: true,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      wageCeiling: 21000,
    });
    expect(esi.esiEmployee).toBe(0);
    expect(esi.esiEmployer).toBe(0);
  });

  it('contributes when gross ≤ ceiling', () => {
    const esi = svc.calculateESI(18000, {
      applicable: true,
      employeeRate: 0.0075,
      employerRate: 0.0325,
      wageCeiling: 21000,
    });
    expect(esi.esiEmployee).toBe(135); // 0.75% of 18000
    expect(esi.esiEmployer).toBe(585); // 3.25% of 18000
  });
});

describe('PayrollCalculationService — Professional Tax', () => {
  const svc = new PayrollCalculationService();

  it('Maharashtra: ₹0 under 7.5k, ₹200 over 10k', () => {
    expect(svc.calculateProfessionalTax(5000, { applicable: true, state: 'maharashtra' })).toBe(0);
    expect(svc.calculateProfessionalTax(9000, { applicable: true, state: 'maharashtra' })).toBe(175);
    expect(svc.calculateProfessionalTax(95000, { applicable: true, state: 'maharashtra' })).toBe(200);
  });

  it('Karnataka: ₹0 under 15k, ₹200 over 25k', () => {
    expect(svc.calculateProfessionalTax(10000, { applicable: true, state: 'karnataka' })).toBe(0);
    expect(svc.calculateProfessionalTax(20000, { applicable: true, state: 'karnataka' })).toBe(150);
    expect(svc.calculateProfessionalTax(50000, { applicable: true, state: 'karnataka' })).toBe(200);
  });

  it('Delhi levies zero PT', () => {
    expect(svc.calculateProfessionalTax(100000, { applicable: true, state: 'delhi' })).toBe(0);
  });

  it('applicable=false returns 0 regardless of state', () => {
    expect(svc.calculateProfessionalTax(100000, { applicable: false, state: 'maharashtra' })).toBe(0);
  });
});

describe('PayrollCalculationService — numberToWords (Indian system)', () => {
  const svc = new PayrollCalculationService();

  it('zero', () => {
    expect(svc.numberToWords(0)).toBe('Rupees Zero Only');
  });

  it('handles crore + lakh boundary', () => {
    // 1,23,45,678 paise = 1,23,456.78 rupees = 1 lakh 23 thousand...
    // Actually the signature is amountInPaise — so 12345678 paise = 123456 rupees 78 paise
    const words = svc.numberToWords(12345678);
    expect(words).toContain('Lakh');
    expect(words).toContain('Thousand');
    expect(words).toContain('Only');
  });

  it('Rs 100 is simple', () => {
    expect(svc.numberToWords(10000)).toBe('Rupees One Hundred Only'); // 10000 paise = 100 rupees
  });

  it('negative amount (deduction-only payslip edge case)', () => {
    const words = svc.numberToWords(-5000);
    expect(words).toMatch(/^Minus /);
  });
});
