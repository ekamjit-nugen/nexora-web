import {
  Injectable,
  Logger,
  BadRequestException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { IBankTransaction } from './schemas/bank-transaction.schema';
import { IPayrollEntry } from './schemas/payroll-entry.schema';

interface PayoutRequest {
  amount: number; // paise
  currency: string;
  mode: 'NEFT' | 'RTGS' | 'IMPS' | 'UPI';
  purpose: string;
  reference: string;
  narration?: string;
  fundAccount: {
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
  };
  idempotencyKey: string;
}

interface PayoutResult {
  success: boolean;
  providerTransactionId?: string;
  providerFundAccountId?: string;
  status: 'pending' | 'processing' | 'processed' | 'failed';
  failureReason?: string;
}

// Abstract adapter interface — plug in Cashfree/Decentro by implementing this
interface IPayoutProvider {
  name: string;
  initiatePayout(req: PayoutRequest): Promise<PayoutResult>;
  getPayoutStatus(providerTransactionId: string): Promise<PayoutResult>;
}

// Razorpay adapter
class RazorpayProvider implements IPayoutProvider {
  name = 'razorpay';
  private keyId: string;
  private keySecret: string;
  private accountNumber: string;
  private logger = new Logger('RazorpayProvider');

  constructor(config: ConfigService) {
    this.keyId = config.get('RAZORPAY_KEY_ID') || '';
    this.keySecret = config.get('RAZORPAY_KEY_SECRET') || '';
    this.accountNumber = config.get('RAZORPAY_ACCOUNT_NUMBER') || '';
  }

  private getAuth(): string {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  async initiatePayout(req: PayoutRequest): Promise<PayoutResult> {
    if (!this.keyId || !this.keySecret || !this.accountNumber) {
      // SECURITY: Never write a fake "success" when real money is expected to
      // move. In production, missing credentials must fail closed so finance
      // sees the error instead of a phantom "processed" transaction.
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_ACCOUNT_NUMBER.',
        );
      }
      this.logger.warn('Razorpay not configured (dev/test) — returning mock pending status');
      return { success: true, status: 'pending', providerTransactionId: `mock_${Date.now()}` };
    }

    try {
      // Step 1: Create contact
      const contactRes = await fetch('https://api.razorpay.com/v1/contacts', {
        method: 'POST',
        headers: { 'Authorization': this.getAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: req.fundAccount.accountHolder,
          type: 'employee',
          reference_id: req.reference,
        }),
      });
      if (!contactRes.ok) throw new Error(`Contact create failed: ${contactRes.status}`);
      const contact: any = await contactRes.json();

      // Step 2: Create fund account
      const fundAccountRes = await fetch('https://api.razorpay.com/v1/fund_accounts', {
        method: 'POST',
        headers: { 'Authorization': this.getAuth(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: contact.id,
          account_type: 'bank_account',
          bank_account: {
            name: req.fundAccount.accountHolder,
            ifsc: req.fundAccount.ifsc,
            account_number: req.fundAccount.accountNumber,
          },
        }),
      });
      if (!fundAccountRes.ok) throw new Error(`Fund account create failed: ${fundAccountRes.status}`);
      const fundAccount: any = await fundAccountRes.json();

      // Step 3: Create payout
      const payoutRes = await fetch('https://api.razorpay.com/v1/payouts', {
        method: 'POST',
        headers: {
          'Authorization': this.getAuth(),
          'Content-Type': 'application/json',
          'X-Payout-Idempotency': req.idempotencyKey,
        },
        body: JSON.stringify({
          account_number: this.accountNumber,
          fund_account_id: fundAccount.id,
          amount: req.amount,
          currency: req.currency,
          mode: req.mode,
          purpose: req.purpose,
          queue_if_low_balance: true,
          reference_id: req.reference,
          narration: req.narration || 'Salary',
        }),
      });

      if (!payoutRes.ok) {
        const err: any = await payoutRes.json();
        return {
          success: false,
          status: 'failed',
          failureReason: err.error?.description || `HTTP ${payoutRes.status}`,
        };
      }

      const payout: any = await payoutRes.json();
      return {
        success: true,
        providerTransactionId: payout.id,
        providerFundAccountId: fundAccount.id,
        status: payout.status === 'processed' ? 'processed' : 'processing',
      };
    } catch (err: any) {
      this.logger.error(`Razorpay payout failed: ${err.message}`);
      return { success: false, status: 'failed', failureReason: err.message };
    }
  }

  async getPayoutStatus(providerTransactionId: string): Promise<PayoutResult> {
    if (!this.keyId || !this.keySecret) {
      return { success: true, status: 'processed', providerTransactionId };
    }
    try {
      const res = await fetch(`https://api.razorpay.com/v1/payouts/${providerTransactionId}`, {
        headers: { 'Authorization': this.getAuth() },
      });
      if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
      const data: any = await res.json();
      const statusMap: Record<string, 'pending' | 'processing' | 'processed' | 'failed'> = {
        'pending': 'pending',
        'queued': 'pending',
        'processing': 'processing',
        'processed': 'processed',
        'cancelled': 'failed',
        'rejected': 'failed',
        'reversed': 'failed',
      };
      return {
        success: true,
        status: statusMap[data.status] || 'pending',
        providerTransactionId,
      };
    } catch (err: any) {
      return { success: false, status: 'failed', failureReason: err.message, providerTransactionId };
    }
  }
}

// Manual provider — for non-integrated orgs (bank file upload workflow)
class ManualProvider implements IPayoutProvider {
  name = 'manual';
  async initiatePayout(_req: PayoutRequest): Promise<PayoutResult> {
    return { success: true, status: 'pending', providerTransactionId: `manual_${Date.now()}` };
  }
  async getPayoutStatus(providerTransactionId: string): Promise<PayoutResult> {
    return { success: true, status: 'pending', providerTransactionId };
  }
}

@Injectable()
export class BankPayoutService {
  private readonly logger = new Logger(BankPayoutService.name);
  private provider: IPayoutProvider;

  constructor(
    @InjectModel('BankTransaction') private bankTransactionModel: Model<IBankTransaction>,
    @InjectModel('PayrollEntry') private payrollEntryModel: Model<IPayrollEntry>,
    private configService: ConfigService,
  ) {
    const providerName = configService.get('PAYOUT_PROVIDER') || 'manual';
    if (providerName === 'razorpay') {
      this.provider = new RazorpayProvider(configService);
    } else {
      this.provider = new ManualProvider();
    }
    this.logger.log(`Bank payout provider: ${this.provider.name}`);
  }

  async initiateBulkPayout(
    payrollRunId: string,
    userId: string,
    orgId: string,
  ): Promise<{ initiated: number; failed: number; transactions: any[] }> {
    const entries = await this.payrollEntryModel.find({
      payrollRunId,
      organizationId: orgId,
      isDeleted: false,
      status: { $in: ['computed', 'reviewed', 'approved'] },
    }).lean();

    if (entries.length === 0) {
      throw new BadRequestException('No eligible payroll entries found');
    }

    let initiated = 0;
    let failed = 0;
    const transactions: any[] = [];

    for (const entry of entries) {
      const idempotencyKey = `${payrollRunId}_${entry.employeeId}`;
      let reserved: IBankTransaction | null = null;
      try {
        const netPayable = entry.totals?.netPayable || 0;
        if (netPayable <= 0) {
          this.logger.warn(`Skipping zero/negative payout for ${entry.employeeId}`);
          continue;
        }

        // Bank details should come from hr-service in production.
        const bankDetails = (entry as any).paymentDetails;
        if (
          !bankDetails ||
          !bankDetails.accountNumber ||
          bankDetails.accountNumber === 'XXXX' ||
          !bankDetails.ifsc
        ) {
          this.logger.warn(`Skipping employee ${entry.employeeId} — bank details incomplete`);
          failed++;
          continue;
        }

        // ATOMIC IDEMPOTENCY RESERVATION
        //
        // Use findOneAndUpdate with `upsert + $setOnInsert` to atomically
        // reserve the idempotency slot. This closes the race window between
        // "check" and "save" that previously allowed two concurrent callers
        // to both fire real Razorpay payouts.
        //
        // A document already in `processed`/`processing` is a no-op skip.
        // A document in `failed` state is reclaimed for retry inside the
        // same call by flipping it back to `pending`.
        const now = new Date();
        const reservation = await this.bankTransactionModel.findOneAndUpdate(
          { idempotencyKey },
          {
            $setOnInsert: {
              organizationId: orgId,
              payrollRunId,
              payrollEntryId: (entry as any)._id?.toString(),
              employeeId: entry.employeeId,
              amount: netPayable,
              status: 'pending',
              mode: 'NEFT',
              provider: this.provider.name,
              bankDetails: {
                accountNumber: String(bankDetails.accountNumber).slice(-4),
                ifsc: bankDetails.ifsc,
                accountHolder:
                  bankDetails.accountHolder || bankDetails.bankName || 'Employee',
              },
              initiatedAt: now,
              idempotencyKey,
              auditTrail: [
                {
                  action: 'payout_reserved',
                  performedBy: userId,
                  performedAt: now,
                  notes: 'Idempotency slot reserved',
                },
              ],
              createdBy: userId,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );

        if (!reservation) {
          // Should not happen with upsert + new:true, but guard anyway.
          failed++;
          continue;
        }

        if (reservation.status === 'processed' || reservation.status === 'processing') {
          this.logger.log(`Skipping already-${reservation.status} entry for ${entry.employeeId}`);
          transactions.push(reservation);
          continue;
        }
        if (reservation.status === 'failed') {
          this.logger.log(
            `Reclaiming failed transaction for ${entry.employeeId} (retry ${reservation.retryCount || 0})`,
          );
          reservation.status = 'pending';
          reservation.failureReason = undefined;
          reservation.failedAt = null as any;
          reservation.retryCount = (reservation.retryCount || 0) + 1;
          reservation.auditTrail.push({
            action: 'retry',
            performedBy: userId,
            performedAt: now,
            notes: `Bulk retry attempt ${reservation.retryCount}`,
          });
          await reservation.save();
        }

        reserved = reservation;

        const payoutReq: PayoutRequest = {
          amount: netPayable,
          currency: 'INR',
          mode: 'NEFT',
          purpose: 'salary',
          reference: `${payrollRunId}_${entry.employeeId}`,
          narration: `Salary - Payroll Run ${payrollRunId}`,
          fundAccount: {
            accountNumber: bankDetails.accountNumber,
            ifsc: bankDetails.ifsc,
            accountHolder:
              bankDetails.accountHolder || bankDetails.bankName || 'Employee',
          },
          idempotencyKey,
        };

        const result = await this.provider.initiatePayout(payoutReq);

        reserved.status = result.status;
        reserved.providerTransactionId = result.providerTransactionId;
        reserved.providerFundAccountId = result.providerFundAccountId;
        reserved.processedAt = result.status === 'processed' ? new Date() : reserved.processedAt;
        if (result.status === 'failed') {
          reserved.failedAt = new Date();
          reserved.failureReason = result.failureReason;
        }
        reserved.auditTrail.push({
          action: 'payout_initiated',
          performedBy: userId,
          performedAt: new Date(),
          notes: `Status: ${result.status}`,
        });
        await reserved.save();

        transactions.push(reserved);
        if (result.success) initiated++;
        else failed++;
      } catch (err: any) {
        this.logger.error(
          `Failed to initiate payout for ${entry.employeeId}: ${err.message}`,
        );
        // If we reserved a slot but the provider call / save threw, mark the
        // reservation as failed so it can be retried later via retryPayout().
        if (reserved) {
          try {
            reserved.status = 'failed';
            reserved.failedAt = new Date();
            reserved.failureReason = err.message || 'Unknown error';
            reserved.auditTrail.push({
              action: 'payout_errored',
              performedBy: userId,
              performedAt: new Date(),
              notes: err.message || 'Unknown error',
            });
            await reserved.save();
          } catch (saveErr: any) {
            this.logger.error(
              `Failed to persist error state for ${entry.employeeId}: ${saveErr.message}`,
            );
          }
        }
        failed++;
        // Re-throw provider-config errors so bulk payout fails loudly instead
        // of silently marking every employee as failed.
        if (err instanceof ServiceUnavailableException) {
          throw err;
        }
      }
    }

    this.logger.log(`Bulk payout: ${initiated} initiated, ${failed} failed`);
    return { initiated, failed, transactions };
  }

  async retryPayout(transactionId: string, userId: string, orgId: string): Promise<IBankTransaction> {
    // Atomically claim the retry slot so concurrent retry calls can't
    // double-fire a second provider payout for the same failed transaction.
    const now = new Date();
    const tx = await this.bankTransactionModel.findOneAndUpdate(
      {
        _id: transactionId,
        organizationId: orgId,
        isDeleted: false,
        status: 'failed',
        $expr: { $lt: ['$retryCount', '$maxRetries'] },
      },
      {
        $inc: { retryCount: 1 },
        $set: { status: 'pending', failureReason: null, failedAt: null },
        $push: {
          auditTrail: {
            action: 'retry',
            performedBy: userId,
            performedAt: now,
            notes: 'Manual retry claim',
          },
        },
      },
      { new: true },
    );

    if (!tx) {
      // Either not found, not failed, or max retries exceeded — give the
      // caller a specific error per case for clarity.
      const existing = await this.bankTransactionModel.findOne({
        _id: transactionId,
        organizationId: orgId,
        isDeleted: false,
      });
      if (!existing) throw new BadRequestException('Transaction not found');
      if (existing.status !== 'failed') {
        throw new ConflictException(`Cannot retry transaction in status "${existing.status}"`);
      }
      throw new BadRequestException('Max retries exceeded');
    }

    // Fetch the original payroll entry to re-derive amount and bank details.
    // We re-read from the authoritative source instead of trusting the
    // potentially stale tx fields.
    const entry = await this.payrollEntryModel.findOne({
      _id: tx.payrollEntryId,
      organizationId: orgId,
    }).lean();

    if (!entry) {
      tx.status = 'failed';
      tx.failedAt = new Date();
      tx.failureReason = 'Payroll entry no longer exists';
      await tx.save();
      throw new BadRequestException('Payroll entry not found for this transaction');
    }

    const bankDetails = (entry as any).paymentDetails;
    if (!bankDetails?.accountNumber || !bankDetails?.ifsc) {
      tx.status = 'failed';
      tx.failedAt = new Date();
      tx.failureReason = 'Bank details incomplete';
      await tx.save();
      throw new BadRequestException('Bank details incomplete on payroll entry');
    }

    const payoutReq: PayoutRequest = {
      amount: tx.amount,
      currency: 'INR',
      mode: 'NEFT',
      purpose: 'salary',
      reference: `${tx.payrollRunId}_${tx.employeeId}_r${tx.retryCount}`,
      narration: `Salary retry - Payroll Run ${tx.payrollRunId}`,
      fundAccount: {
        accountNumber: bankDetails.accountNumber,
        ifsc: bankDetails.ifsc,
        accountHolder: bankDetails.accountHolder || bankDetails.bankName || 'Employee',
      },
      // New idempotency key per retry attempt — the original key is
      // permanently claimed by the original failed attempt record.
      idempotencyKey: `${tx.idempotencyKey}_r${tx.retryCount}`,
    };

    try {
      const result = await this.provider.initiatePayout(payoutReq);
      tx.status = result.status;
      tx.providerTransactionId = result.providerTransactionId || tx.providerTransactionId;
      tx.providerFundAccountId = result.providerFundAccountId || tx.providerFundAccountId;
      if (result.status === 'processed') tx.processedAt = new Date();
      if (result.status === 'failed') {
        tx.failedAt = new Date();
        tx.failureReason = result.failureReason;
      }
      tx.auditTrail.push({
        action: 'retry_result',
        performedBy: userId,
        performedAt: new Date(),
        notes: `Retry ${tx.retryCount} status: ${result.status}`,
      });
      await tx.save();
      return tx;
    } catch (err: any) {
      tx.status = 'failed';
      tx.failedAt = new Date();
      tx.failureReason = err.message || 'Unknown error';
      tx.auditTrail.push({
        action: 'retry_errored',
        performedBy: userId,
        performedAt: new Date(),
        notes: err.message || 'Unknown error',
      });
      await tx.save();
      throw err;
    }
  }

  async syncPayoutStatus(transactionId: string, orgId: string): Promise<IBankTransaction> {
    const tx = await this.bankTransactionModel.findOne({ _id: transactionId, organizationId: orgId });
    if (!tx) throw new BadRequestException('Transaction not found');
    if (!tx.providerTransactionId) throw new BadRequestException('No provider transaction to sync');

    const result = await this.provider.getPayoutStatus(tx.providerTransactionId);
    tx.status = result.status;
    if (result.status === 'processed' && !tx.processedAt) tx.processedAt = new Date();
    if (result.status === 'failed' && !tx.failedAt) {
      tx.failedAt = new Date();
      tx.failureReason = result.failureReason;
    }
    await tx.save();
    return tx;
  }

  async getTransactions(payrollRunId: string, orgId: string) {
    return this.bankTransactionModel
      .find({ payrollRunId, organizationId: orgId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
  }

  /**
   * Generate a bank-file CSV for the given payroll run.
   *
   * B-H22: Previously exported the FULL bank account number, which
   * violates PCI/RBI data-minimization rules and exposes finance staff to
   * data-leak liability. By default we mask all but the last 4 digits.
   * A caller with explicit write authority can request unmasked output
   * via `options.unmasked = true` — but that path must be gated by a
   * privileged RBAC role at the controller level and audited.
   */
  async generateBankFile(
    payrollRunId: string,
    orgId: string,
    options?: { unmasked?: boolean; actorUserId?: string },
  ): Promise<string> {
    const entries = await this.payrollEntryModel.find({
      payrollRunId,
      organizationId: orgId,
      isDeleted: false,
    }).lean();

    const unmasked = options?.unmasked === true;
    if (unmasked) {
      this.logger.warn(
        `[AUDIT] Unmasked bank file generated for payrollRun=${payrollRunId} org=${orgId} by user=${options?.actorUserId || 'unknown'}`,
      );
    }

    const maskAccount = (account: string): string => {
      if (!account) return '';
      const s = String(account);
      if (s.length <= 4) return '*'.repeat(s.length);
      return '*'.repeat(s.length - 4) + s.slice(-4);
    };
    const csvEscape = (v: unknown): string => {
      const s = String(v ?? '');
      if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = 'Sr No,Employee ID,Beneficiary Name,Account Number,IFSC,Amount,Transaction Type,Remarks';
    const rows = entries.map((e, idx) => {
      const details = (e as any).paymentDetails || {};
      const account = unmasked ? (details.accountNumber || '') : maskAccount(details.accountNumber || '');
      return [
        idx + 1,
        csvEscape(e.employeeId),
        csvEscape(details.accountHolder || ''),
        csvEscape(account),
        csvEscape(details.ifsc || ''),
        ((e.totals?.netPayable || 0) / 100).toFixed(2),
        'NEFT',
        csvEscape(`Salary-${payrollRunId}`),
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }
}
