import { Schema, Document } from 'mongoose';

export interface IOnboardingChecklistItem {
  taskId: string;
  title: string;
  category: string;
  description?: string;
  assignedTo?: string;
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: string;
  isRequired: boolean;
  dueDate?: Date;
  notes?: string;
}

export interface IOnboardingDocument {
  type: string;
  title: string;
  url?: string;
  status: string;
  verifiedBy?: string;
  verifiedAt?: Date;
  rejectionReason?: string;
}

export interface IOnboardingAuditEntry {
  action: string;
  performedBy: string;
  performedAt: Date;
  notes?: string;
}

export interface IOnboarding extends Document {
  organizationId: string;
  employeeId: string;
  status: string;
  startDate: Date;
  targetCompletionDate: Date;
  actualCompletionDate?: Date;
  checklist: IOnboardingChecklistItem[];
  documents: IOnboardingDocument[];
  buddyId?: string;
  welcomeKitSent: boolean;
  welcomeKitSentAt?: Date;
  probationEndDate?: Date;
  confirmationDate?: Date;
  confirmationStatus?: string;
  auditTrail: IOnboardingAuditEntry[];
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OnboardingSchema = new Schema<IOnboarding>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    startDate: { type: Date, required: true },
    targetCompletionDate: { type: Date, required: true },
    actualCompletionDate: { type: Date, default: null },
    checklist: [
      {
        taskId: { type: String, required: true },
        title: { type: String, required: true },
        category: {
          type: String,
          required: true,
          enum: ['documents', 'it_setup', 'training', 'compliance', 'welcome', 'other'],
        },
        description: { type: String, default: null },
        assignedTo: { type: String, default: null },
        isCompleted: { type: Boolean, default: false },
        completedAt: { type: Date, default: null },
        completedBy: { type: String, default: null },
        isRequired: { type: Boolean, default: true },
        dueDate: { type: Date, default: null },
        notes: { type: String, default: null },
      },
    ],
    documents: [
      {
        type: {
          type: String,
          required: true,
          enum: ['aadhaar', 'pan', 'passport', 'bank_proof', 'education', 'experience', 'offer_letter', 'nda', 'photo', 'other'],
        },
        title: { type: String, required: true },
        url: { type: String, default: null },
        status: {
          type: String,
          enum: ['pending', 'uploaded', 'verified', 'rejected'],
          default: 'pending',
        },
        verifiedBy: { type: String, default: null },
        verifiedAt: { type: Date, default: null },
        rejectionReason: { type: String, default: null },
      },
    ],
    buddyId: { type: String, default: null },
    welcomeKitSent: { type: Boolean, default: false },
    welcomeKitSentAt: { type: Date, default: null },
    probationEndDate: { type: Date, default: null },
    confirmationDate: { type: Date, default: null },
    confirmationStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'extended', 'terminated'],
      default: null,
    },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, required: true },
        performedAt: { type: Date, required: true },
        notes: { type: String, default: null },
      },
    ],
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

OnboardingSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
OnboardingSchema.index({ organizationId: 1, status: 1 });
OnboardingSchema.index({ isDeleted: 1 });
