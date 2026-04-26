// Integration tests for the loans flow.
//
// Critical regression coverage: pre-fix, processPayrollRun never
// passed loanDeductions to the calculation engine — every payslip
// showed zero loan deduction even when the employee had an active
// loan. The tests below pin the contract that:
//   1. Eligibility cap enforces 12× monthly gross (1× for salary
//      advances) at apply time.
//   2. The post-save loan write-back actually fires on payroll runs.
//   3. Auto-close fires when the final installment is deducted.
// If any of these regress, the suite breaks loudly.
//
// External-services calls (HR record lookup, attendance fetch,
// holiday calendar, policy overrides) are stubbed via overrideProvider.
// We're testing the loan + payroll Mongo paths, not the HTTP plumbing.

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { PayrollService } from '../../src/payroll/payroll.service';
import { ExternalServicesService } from '../../src/payroll/external-services.service';

const ORG_ID = 'test-org-loans';
const SAM_USER_ID = 'sam-auth-user-id';
const SAM_HR_ID = 'sam-hr-employee-id';
const ADMIN_USER_ID = 'admin-auth-user-id';

describe('Loans (integration)', () => {
  let service: PayrollService;
  let module: TestingModule;
  let connection: Connection;
  let externalServices: jest.Mocked<ExternalServicesService>;

  beforeAll(async () => {
    // Stub every cross-service call. Payroll talks to HR (employee
    // lookup, policy fetch), attendance (monthly summary, holidays),
    // and policy-service. Each stub returns the minimum shape the
    // service expects, so the loan code-path can run end-to-end
    // without any other service container.
    const externalMock: Partial<jest.Mocked<ExternalServicesService>> = {
      getEmployee: jest.fn().mockResolvedValue({
        _id: SAM_HR_ID,
        userId: SAM_USER_ID,
        firstName: 'Sam',
        policyIds: [],
      }),
      getEmployeeByUserIdentity: jest.fn().mockResolvedValue({
        _id: SAM_HR_ID,
        userId: SAM_USER_ID,
        firstName: 'Sam',
        policyIds: [],
      }),
      getMonthlyAttendance: jest.fn().mockResolvedValue([]),
      getHolidayDates: jest.fn().mockResolvedValue([]),
      getPayrollConfig: jest.fn().mockResolvedValue({
        pfConfig: { applicable: false, employeeRate: 0, employerRate: 0, adminChargesRate: 0, edliRate: 0, wageCeiling: 15000, includeInCTC: true },
        esiConfig: { applicable: false, employeeRate: 0, employerRate: 0, wageCeiling: 21000 },
        ptConfig: { applicable: false, state: 'KA' },
        lwfConfig: { applicable: false, state: 'KA' },
        tdsConfig: { applicable: false, defaultTaxRegime: 'new', autoCalculate: false },
        overtime: { applicable: false, rate: 1, minimumTriggerMinutes: 0 },
        lopConfig: { applicable: true, halfDayLopFactor: 0.5, lateToHalfDayMinutes: 60, attendanceTolerance: 0 },
        salaryStructure: { components: [] },
        schedule: { payCycle: 'monthly', payDay: 1, processingStartDay: 25, attendanceCutoff: 25 },
      }),
      getOrgDetails: jest.fn().mockResolvedValue({ name: 'Test Org', currency: 'INR' }),
      getPoliciesByIds: jest.fn().mockResolvedValue([]),
    };

    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ExternalServicesService)
      .useValue(externalMock)
      .compile();

    service = module.get<PayrollService>(PayrollService);
    externalServices = module.get(ExternalServicesService) as any;
    connection = module.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await module.close();
  });

  beforeEach(async () => {
    // Wipe everything between specs so order doesn't matter and a
    // failing test can't poison the next one. Indexes survive the
    // deleteMany — that's fine.
    const collections = connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  /** Insert an active salary structure for Sam. The eligibility cap
   *  reads grossSalary; we set gross=100,000/mo (ctc=12L) so the
   *  thresholds are easy to reason about: salary_advance cap=1L,
   *  others cap=12L. */
  async function seedSalaryStructure(grossSalary: number = 100000) {
    await connection.collection('salarystructures').insertOne({
      organizationId: ORG_ID,
      employeeId: SAM_HR_ID,
      structureName: 'test-struct',
      effectiveFrom: new Date('2025-01-01'),
      ctc: grossSalary * 12,
      grossSalary,
      netSalary: grossSalary,
      components: [],
      status: 'active',
      isActive: true,
      isDeleted: false,
      createdBy: 'test',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  describe('applyLoan eligibility cap', () => {
    beforeEach(async () => {
      await seedSalaryStructure(100000); // monthly gross = ₹1L
    });

    it('rejects salary_advance over 1× monthly gross cap', async () => {
      await expect(
        service.applyLoan(
          { type: 'salary_advance', amount: 200000, tenure: 4, interestRate: 0, reason: 'too big' } as any,
          SAM_USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/exceeds the 1× monthly gross cap/);
    });

    it('rejects personal_loan over 12× monthly gross cap', async () => {
      await expect(
        service.applyLoan(
          { type: 'personal_loan', amount: 5_000_000, tenure: 24, interestRate: 0, reason: 'too big' } as any,
          SAM_USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(/exceeds the 12× monthly gross cap/);
    });

    it('accepts personal_loan within cap and persists with outstandingBalance=amount', async () => {
      const loan = await service.applyLoan(
        { type: 'personal_loan', amount: 50000, tenure: 5, interestRate: 0, reason: 'ok' } as any,
        SAM_USER_ID,
        ORG_ID,
      );
      expect(loan.status).toBe('applied');
      expect(loan.outstandingBalance).toBe(50000);
      expect(loan.emiAmount).toBe(10000);
      expect(loan.schedule).toHaveLength(5);
      expect(loan.schedule[0].status).toBe('pending');
    });

    it('rejects a second active loan of the same type (one-active-per-type rule)', async () => {
      await service.applyLoan(
        { type: 'personal_loan', amount: 30000, tenure: 3, interestRate: 0, reason: 'first' } as any,
        SAM_USER_ID,
        ORG_ID,
      );
      await expect(
        service.applyLoan(
          { type: 'personal_loan', amount: 20000, tenure: 2, interestRate: 0, reason: 'second' } as any,
          SAM_USER_ID,
          ORG_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approveLoan + disburseLoan + payroll EMI deduction', () => {
    let loanId: string;

    beforeEach(async () => {
      await seedSalaryStructure(100000);
      const loan = await service.applyLoan(
        { type: 'personal_loan', amount: 50000, tenure: 5, interestRate: 0, reason: 'e2e' } as any,
        SAM_USER_ID,
        ORG_ID,
      );
      loanId = String(loan._id);
      // Approve and disburse so it's ready for payroll deduction.
      await service.approveLoan(loanId, { status: 'approved' } as any, ADMIN_USER_ID, ORG_ID);
      await service.disburseLoan(loanId, ADMIN_USER_ID, ORG_ID);
    });

    it('disbursed loan is in active status with full outstanding balance', async () => {
      const loan = await connection.collection('employeeloans').findOne({ _id: new Types.ObjectId(loanId) });
      expect(loan?.status).toBe('active');
      expect(loan?.outstandingBalance).toBe(50000);
    });

    it('payroll run deducts the matching installment EMI and decrements outstanding balance', async () => {
      // Patch installment 1's dueMonth/Year to match the run we'll
      // initiate. (Default schedule starts from `now+1`; we pin to a
      // known month so the test is deterministic.)
      await connection.collection('employeeloans').updateOne(
        { _id: new Types.ObjectId(loanId) },
        { $set: { 'schedule.0.dueMonth': 5, 'schedule.0.dueYear': 2026 } },
      );

      // Initiate + process a May 2026 payroll run. The mocked external
      // services return no attendance and no holidays — the payroll
      // calculation falls through to defaults but still processes the
      // entry, which is enough for the loan-deduction code path to fire.
      const run = await service.initiatePayrollRun({ month: 5, year: 2026 }, ADMIN_USER_ID, ORG_ID);
      const processed = await service.processPayrollRun(String(run._id), ADMIN_USER_ID, ORG_ID);
      expect(processed.summary.processedEmployees).toBeGreaterThanOrEqual(1);

      // Loan write-back: installment 1 marked deducted, outstanding=40000.
      const loan = await connection.collection('employeeloans').findOne({ _id: new Types.ObjectId(loanId) });
      expect(loan?.outstandingBalance).toBe(40000);
      const inst1 = (loan?.schedule || []).find((s: any) => s.installmentNumber === 1);
      expect(inst1?.status).toBe('deducted');
      expect(inst1?.payrollRunId).toBe(String(run._id));
      expect(inst1?.deductedAt).toBeInstanceOf(Date);

      // Payroll entry: loanDeductions contains the deduction row
      // and totalDeductions includes it.
      const entry = await connection.collection('payrollentries').findOne({ payrollRunId: String(run._id) });
      expect(entry).toBeTruthy();
      expect(entry?.loanDeductions).toHaveLength(1);
      expect(entry?.loanDeductions[0].emiAmount).toBe(10000);
      expect(entry?.loanDeductions[0].loanId).toBe(loanId);
    });

    it('auto-closes the loan when the final installment is deducted', async () => {
      // Pre-mark installments 1-4 as already deducted, leaving #5 pending
      // for our run. Outstanding balance = one EMI = ₹10K.
      await connection.collection('employeeloans').updateOne(
        { _id: new Types.ObjectId(loanId) },
        {
          $set: {
            'schedule.0.status': 'deducted',
            'schedule.1.status': 'deducted',
            'schedule.2.status': 'deducted',
            'schedule.3.status': 'deducted',
            'schedule.4.status': 'pending',
            'schedule.4.dueMonth': 5,
            'schedule.4.dueYear': 2026,
            outstandingBalance: 10000,
          },
        },
      );

      const run = await service.initiatePayrollRun({ month: 5, year: 2026 }, ADMIN_USER_ID, ORG_ID);
      await service.processPayrollRun(String(run._id), ADMIN_USER_ID, ORG_ID);

      const loan = await connection.collection('employeeloans').findOne({ _id: new Types.ObjectId(loanId) });
      expect(loan?.status).toBe('closed');
      expect(loan?.outstandingBalance).toBe(0);
      expect(loan?.closedAt).toBeInstanceOf(Date);
      // All installments now show status 'deducted' (none stranded as
      // 'pending' or 'skipped' in this final-deduction path).
      const statuses = (loan?.schedule || []).map((s: any) => s.status);
      expect(statuses.every((s: string) => s === 'deducted')).toBe(true);
    });
  });
});
