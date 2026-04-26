import { Schema, Document } from 'mongoose';

export interface IInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface IInvoice extends Document {
  organizationId?: string;
  invoiceNumber: string;
  clientId: string;
  projectId?: string;
  templateId?: string;
  templateName?: string;
  issueDate: Date;
  dueDate: Date;
  items: IInvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discount: number;
  discountType: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: string;
  paymentTerms: number;
  paymentMethod?: string;
  paymentNotes?: string;
  notes?: string;
  terms?: string;
  sentAt?: Date;
  sentTo?: string;
  emailCount: number;
  brandName?: string;
  brandLogo?: string;
  brandAddress?: string;
  signature?: string;
  isRecurring: boolean;
  recurringInterval?: string;
  recurringEmail?: string;
  recurringNextDate?: Date;
  recurringEndDate?: Date;
  isDeleted: boolean;
  createdBy?: string;
  updatedBy?: string;
  // Lifecycle tracking — populated by InvoiceLifecycleService daily.
  // Drives the colored badges on the invoice list, the dashboard stats
  // cards, and the rules for when reminder notifications fire.
  // Computed as a function of (dueDate, status, amountPaid):
  //   • upcoming    : dueDate > today + 7 days, unpaid
  //   • due_soon    : dueDate within 2..7 days, unpaid
  //   • due_today   : dueDate is today or tomorrow, unpaid
  //   • overdue     : dueDate < today, unpaid (also flips status → overdue)
  //   • paid        : amountPaid >= total
  // null when invoice is draft/cancelled (lifecycle doesn't apply).
  lifecycleState?: 'upcoming' | 'due_soon' | 'due_today' | 'overdue' | 'paid' | null;
  daysUntilDue?: number;        // negative ⇒ overdue
  overdueDays?: number;         // 0 if not overdue
  lastLifecycleScanAt?: Date;
  // Reminder bookkeeping — incremented on every send (manual or automated).
  // The cron uses lastReminderSentAt to throttle weekly nudges so a single
  // overdue invoice doesn't spam the creator's inbox every day.
  lastReminderSentAt?: Date | null;
  reminderCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    rate: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
    taxRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

export const InvoiceSchema = new Schema<IInvoice>(
  {
    organizationId: { type: String, default: null, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    clientId: { type: String, required: true, index: true },
    projectId: { type: String, default: null, index: true },
    templateId: { type: String, default: null },
    templateName: { type: String, default: null },
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    items: [InvoiceItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    taxTotal: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'fixed',
    },
    total: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    paymentTerms: { type: Number, default: 30 },
    paymentMethod: { type: String, default: null },
    paymentNotes: { type: String, default: null },
    notes: { type: String, default: null },
    terms: { type: String, default: null },
    sentAt: { type: Date, default: null },
    sentTo: { type: String, default: null },
    emailCount: { type: Number, default: 0 },
    brandName: { type: String, default: null },
    brandLogo: { type: String, default: null },
    brandAddress: { type: String, default: null },
    signature: { type: String, default: null },
    isRecurring: { type: Boolean, default: false },
    recurringInterval: {
      type: String,
      enum: ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'],
      default: null,
    },
    recurringEmail: { type: String, default: null },
    recurringNextDate: { type: Date, default: null },
    recurringEndDate: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    lifecycleState: {
      type: String,
      enum: ['upcoming', 'due_soon', 'due_today', 'overdue', 'paid', null],
      default: null,
    },
    daysUntilDue: { type: Number, default: null },
    overdueDays: { type: Number, default: 0 },
    lastLifecycleScanAt: { type: Date, default: null },
    lastReminderSentAt: { type: Date, default: null },
    reminderCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

InvoiceSchema.index({ organizationId: 1, invoiceNumber: 1 }, { unique: true });
InvoiceSchema.index({ isDeleted: 1, status: 1 });
InvoiceSchema.index({ dueDate: 1, status: 1 });
InvoiceSchema.index({ clientId: 1, isDeleted: 1 });
InvoiceSchema.index({ invoiceNumber: 'text' });
// Lifecycle dashboard query: "show me all overdue invoices for this org,
// newest dueDate first" — heavily used by the Invoices page stats cards.
InvoiceSchema.index({ organizationId: 1, lifecycleState: 1, dueDate: -1 });
