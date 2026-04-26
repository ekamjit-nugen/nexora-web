// Integration tests for the bank file validator + generator.
//
// Why this is the highest-priority bank-file regression test: the
// pre-fix codebase silently skipped employees with malformed bank
// details (no IFSC validation, no account-length check, no holder
// check). Finance teams discovered the gaps post-disbursement during
// reconciliation. The validator now surfaces exactly which employees
// would be excluded — these tests pin that contract so any future
// regression (e.g. weakening the IFSC regex or dropping the
// holder-required rule) breaks the suite.
//
// Strategy: boot the full Nest module (mongo-memory-server backed),
// seed PayrollEntry docs with controlled paymentDetails, then call
// the BankPayoutService directly. We don't mock the validator —
// it's pure logic; the value of the integration test is that the
// real Mongoose models, real connection, real entry shape all play
// nicely together.

import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../../src/app.module';
import { BankPayoutService } from '../../src/payroll/bank-payout.service';

const ORG_ID = 'test-org-001';
const RUN_ID = 'test-run-001';

describe('Bank file validation (integration)', () => {
  let service: BankPayoutService;
  let module: TestingModule;
  let connection: Connection;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    service = module.get<BankPayoutService>(BankPayoutService);
    // AppModule uses MongooseModule.forRootAsync which doesn't set the
    // global `mongoose.connection` — pull the actual connection from
    // the DI container instead.
    connection = module.get<Connection>(getConnectionToken());
  });

  afterAll(async () => {
    await connection.close();
    await module.close();
  });

  beforeEach(async () => {
    // Wipe payroll-entries between tests so each spec sees a clean
    // slate. We don't need to recreate indexes — Mongoose handles that
    // on first connect via `MongooseModule.forFeature`.
    await connection.collection('payrollentries').deleteMany({});
  });

  /** Seed a payrollentry directly via the raw collection so we can
   *  control the exact shape of paymentDetails (the schema's defaults
   *  would otherwise normalise away the test-case-specific quirks). */
  async function seedEntry(overrides: {
    employeeId: string;
    netPayable: number;
    accountHolder?: string;
    accountNumber?: string;
    ifsc?: string;
  }) {
    await connection.collection('payrollentries').insertOne({
      payrollRunId: RUN_ID,
      organizationId: ORG_ID,
      employeeId: overrides.employeeId,
      payPeriod: { month: 5, year: 2026 },
      paymentDetails: {
        accountHolder: overrides.accountHolder,
        accountNumber: overrides.accountNumber,
        ifsc: overrides.ifsc,
      },
      totals: { netPayable: overrides.netPayable, totalDeductions: 0, grossEarnings: overrides.netPayable, totalStatutory: 0 },
      attendance: {},
      earnings: [],
      deductions: [],
      statutory: {},
      reimbursements: [],
      bonuses: [],
      loanDeductions: [],
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  describe('validateBankFile', () => {
    it('flags a row with missing IFSC, missing holder, and short account number', async () => {
      await seedEntry({
        employeeId: 'emp-1',
        netPayable: 4000000,
        accountHolder: '',
        accountNumber: '12345',
        ifsc: '',
      });
      const report = await service.validateBankFile(RUN_ID, ORG_ID);
      expect(report.summary.total).toBe(1);
      expect(report.summary.invalid).toBe(1);
      expect(report.summary.valid).toBe(0);
      expect(report.invalid[0].reasons).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Account number ".*" is not 9–18 digits\./),
          'IFSC missing.',
          'Account holder name missing.',
        ]),
      );
    });

    it('flags a row with a malformed IFSC (wrong format)', async () => {
      await seedEntry({
        employeeId: 'emp-2',
        netPayable: 5000000,
        accountHolder: 'Sam Smith',
        accountNumber: '12345678901',
        ifsc: 'WRONGFORMAT',
      });
      const report = await service.validateBankFile(RUN_ID, ORG_ID);
      expect(report.summary.invalid).toBe(1);
      expect(report.invalid[0].reasons[0]).toMatch(/IFSC ".*" doesn't match the standard format/);
    });

    it('accepts a row with a valid HDFC IFSC + 11-digit account', async () => {
      await seedEntry({
        employeeId: 'emp-3',
        netPayable: 5000000,
        accountHolder: 'Sam Smith',
        accountNumber: '12345678901',
        ifsc: 'HDFC0001234',
      });
      const report = await service.validateBankFile(RUN_ID, ORG_ID);
      expect(report.summary.valid).toBe(1);
      expect(report.summary.invalid).toBe(0);
      expect(report.valid[0].accountMasked).toBe('*******8901');
      expect(report.valid[0].ifsc).toBe('HDFC0001234');
      expect(report.summary.validAmount).toBe(5000000);
    });

    it('skips entries with zero or negative net payable', async () => {
      await seedEntry({
        employeeId: 'emp-zero',
        netPayable: 0,
        accountHolder: 'Sam',
        accountNumber: '12345678901',
        ifsc: 'HDFC0001234',
      });
      const report = await service.validateBankFile(RUN_ID, ORG_ID);
      expect(report.summary.invalid).toBe(1);
      expect(report.invalid[0].reasons).toContain('Net payable is zero or negative — nothing to disburse.');
    });

    it('lower-cases IFSC then re-validates (stored lowercase still passes when format is correct)', async () => {
      await seedEntry({
        employeeId: 'emp-lower',
        netPayable: 5000000,
        accountHolder: 'Test',
        accountNumber: '123456789',
        ifsc: 'hdfc0001234',
      });
      const report = await service.validateBankFile(RUN_ID, ORG_ID);
      // Validator uppercases internally before regex match, so a
      // lowercase stored value should pass.
      expect(report.summary.valid).toBe(1);
      expect(report.valid[0].ifsc).toBe('HDFC0001234');
    });
  });

  describe('generateBankFile', () => {
    it('CSV body contains only valid rows, banner shows the skipped count', async () => {
      await seedEntry({
        employeeId: 'emp-good',
        netPayable: 5000000,
        accountHolder: 'Sam Smith',
        accountNumber: '12345678901',
        ifsc: 'HDFC0001234',
      });
      await seedEntry({
        employeeId: 'emp-bad',
        netPayable: 4000000,
        accountHolder: '',
        accountNumber: '12345',
        ifsc: 'WRONGFORMAT',
      });

      const csv = await service.generateBankFile(RUN_ID, ORG_ID);
      const lines = csv.split('\n');

      // First line is the banner ONLY when there are skips.
      expect(lines[0]).toMatch(/^# Generated .+ included=1 skipped=1 \| total=50000\.00 INR$/);
      expect(lines[1]).toBe(
        'Sr No,Employee ID,Beneficiary Name,Account Number,IFSC,Amount,Transaction Type,Remarks',
      );
      expect(lines[2]).toMatch(/^1,emp-good,Sam Smith,\*\*\*\*\*\*\*8901,HDFC0001234,50000\.00,NEFT,Salary-/);
      // Bad entry must NOT appear in body
      expect(csv).not.toContain('emp-bad');
    });

    it('omits the banner when every entry is valid (legacy header-first layout)', async () => {
      await seedEntry({
        employeeId: 'emp-good',
        netPayable: 5000000,
        accountHolder: 'Sam',
        accountNumber: '12345678901',
        ifsc: 'HDFC0001234',
      });

      const csv = await service.generateBankFile(RUN_ID, ORG_ID);
      const lines = csv.split('\n');
      expect(lines[0]).toBe(
        'Sr No,Employee ID,Beneficiary Name,Account Number,IFSC,Amount,Transaction Type,Remarks',
      );
      // No `#` line at the top.
      expect(lines[0].startsWith('#')).toBe(false);
    });

    it('returns just a header when no entries exist (clean empty file, not malformed)', async () => {
      const csv = await service.generateBankFile(RUN_ID, ORG_ID);
      expect(csv).toBe(
        'Sr No,Employee ID,Beneficiary Name,Account Number,IFSC,Amount,Transaction Type,Remarks',
      );
    });
  });
});
