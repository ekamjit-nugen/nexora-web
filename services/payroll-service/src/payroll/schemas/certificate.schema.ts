import { Schema, Document } from 'mongoose';

export interface ICertificate extends Document {
  organizationId: string;
  employeeId: string;
  courseId: string;
  enrollmentId: string;
  certificateNumber: string;
  courseName: string;
  employeeName: string;
  issuedAt: Date;
  validUntil?: Date;
  score?: number;
  completionDays?: number;
  verificationCode: string;
  issuedBy: string;
  isRevoked: boolean;
  revokedAt?: Date;
  revokedReason?: string;
  downloadCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const CertificateSchema = new Schema<ICertificate>(
  {
    organizationId: { type: String, required: true, index: true },
    employeeId: { type: String, required: true, index: true },
    courseId: { type: String, required: true },
    enrollmentId: { type: String, required: true },
    certificateNumber: { type: String, required: true, unique: true },
    courseName: { type: String, required: true },
    employeeName: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    validUntil: { type: Date, default: null },
    score: { type: Number, default: null },
    completionDays: { type: Number, default: null },
    verificationCode: { type: String, required: true },
    issuedBy: { type: String, required: true },
    isRevoked: { type: Boolean, default: false },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: null },
    downloadCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CertificateSchema.index({ organizationId: 1, employeeId: 1 });
CertificateSchema.index({ verificationCode: 1 });
