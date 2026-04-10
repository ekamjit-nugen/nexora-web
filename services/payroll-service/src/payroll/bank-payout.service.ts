import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
    if (!this.keyId || !this.keySecret) {
      this.logger.warn('Razorpay not configured, returning mock pending status');
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
      try {
        const idempotencyKey = `${payrollRunId}_${entry.employeeId}`;

        // Idempotency check — skip if already processed/processing
        const existing = await this.bankTransactionModel.findOne({ idempotencyKey });
        if (existing) {
          if (existing.status === 'processed' || existing.status === 'processing') {
            this.logger.log(`Skipping already-processed entry for ${entry.employeeId}`);
            continue;
          }
        }

        const netPayable = entry.totals?.netPayable || 0;
        if (netPayable <= 0) {
          this.logger.warn(`Skipping zero/negative payout for ${entry.employeeId}`);
          continue;
        }

        // Bank details should come from hr-service in production
        const bankDetails = (entry as any).paymentDetails || {
          accountNumber: 'XXXX',
          ifsc: 'UNKNOWN',
          accountHolder: 'Unknown',
        };
        if (!bankDetails.accountNumber || bankDetails.accountNumber === 'XXXX' || !bankDetails.ifsc) {
          this.logger.warn(`Skipping employee ${entry.employeeId} — bank details incomplete`);
          failed++;
          continue;
        }

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
            accountHolder: bankDetails.accountHolder || bankDetails.bankName || 'Employee',
          },
          idempotencyKey,
        };

        const result = await this.provider.initiatePayout(payoutReq);

        const tx = new this.bankTransactionModel({
          organizationId: orgId,
          payrollRunId,
          payrollEntryId: (entry as any)._id?.toString(),
          employeeId: entry.employeeId,
          amount: netPayable,
          status: result.status,
          mode: 'NEFT',
          provider: this.provider.name,
          providerTransactionId: result.providerTransactionId,
          providerFundAccountId: result.providerFundAccountId,
          bankDetails: {
            accountNumber: String(bankDetails.accountNumber).slice(-4),
            ifsc: bankDetails.ifsc,
            accountHolder: bankDetails.accountHolder || bankDetails.bankName || 'Employee',
          },
          initiatedAt: new Date(),
          processedAt: result.status === 'processed' ? new Date() : null,
          failedAt: result.status === 'failed' ? new Date() : null,
          failureReason: result.failureReason,
          idempotencyKey,
          auditTrail: [{
            action: 'payout_initiated',
            performedBy: userId,
            performedAt: new Date(),
            notes: `Status: ${result.status}`,
          }],
          createdBy: userId,
        });

        await tx.save();
        transactions.push(tx);
        if (result.success) initiated++;
        else failed++;
      } catch (err: any) {
        this.logger.error(`Failed to initiate payout for ${entry.employeeId}: ${err.message}`);
        failed++;
      }
    }

    this.logger.log(`Bulk payout: ${initiated} initiated, ${failed} failed`);
    return { initiated, failed, transactions };
  }

  async retryPayout(transactionId: string, userId: string, orgId: string): Promise<IBankTransaction> {
    const tx = await this.bankTransactionModel.findOne({
      _id: transactionId,
      organizationId: orgId,
      isDeleted: false,
    });
    if (!tx) throw new BadRequestException('Transaction not found');
    if (tx.status !== 'failed') throw new BadRequestException('Can only retry failed transactions');
    if (tx.retryCount >= tx.maxRetries) throw new BadRequestException('Max retries exceeded');

    tx.retryCount++;
    tx.status = 'pending';
    tx.failureReason = undefined;
    tx.auditTrail.push({
      action: 'retry',
      performedBy: userId,
      performedAt: new Date(),
      notes: `Retry attempt ${tx.retryCount}`,
    });

    await tx.save();
    return tx;
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

  async generateBankFile(payrollRunId: string, orgId: string): Promise<string> {
    const entries = await this.payrollEntryModel.find({
      payrollRunId,
      organizationId: orgId,
      isDeleted: false,
    }).lean();

    const header = 'Sr No,Employee ID,Beneficiary Name,Account Number,IFSC,Amount,Transaction Type,Remarks';
    const rows = entries.map((e, idx) => {
      const details = (e as any).paymentDetails || {};
      return [
        idx + 1,
        e.employeeId,
        details.accountHolder || '',
        details.accountNumber || '',
        details.ifsc || '',
        ((e.totals?.netPayable || 0) / 100).toFixed(2),
        'NEFT',
        `Salary-${payrollRunId}`,
      ].join(',');
    });
    return [header, ...rows].join('\n');
  }
}
