import { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  organizationId?: string;
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  phone?: string;
  dateOfBirth?: Date;
  gender?: string;
  departmentId?: string;
  designationId?: string;
  teamId?: string;
  reportingManagerId?: string;
  employmentType: string;
  joiningDate: Date;
  probationEndDate?: Date;
  confirmationDate?: Date;
  exitDate?: Date;
  exitReason?: string;
  location?: string;
  timezone?: string;
  skills: string[];
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
  address?: {
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountHolder: string;
  };
  documents: Array<{
    type: string;
    url: string;
    uploadedAt: Date;
    verified: boolean;
  }>;
  status: string;
  isActive: boolean;
  isDeleted: boolean;
  policyIds?: string[];
  deletedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const EmployeeSchema = new Schema<IEmployee>(
  {
    organizationId: { type: String, default: null, index: true },
    userId: { type: String, required: true, unique: true, index: true },
    employeeId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    avatar: { type: String, default: null },
    phone: { type: String, default: null },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ['male', 'female', 'other', null], default: null },
    departmentId: { type: String, default: null, index: true },
    designationId: { type: String, default: null },
    teamId: { type: String, default: null },
    reportingManagerId: { type: String, default: null, index: true },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    joiningDate: { type: Date, required: true },
    probationEndDate: { type: Date, default: null },
    confirmationDate: { type: Date, default: null },
    exitDate: { type: Date, default: null },
    exitReason: { type: String, default: null },
    location: { type: String, default: null },
    timezone: { type: String, default: 'Asia/Kolkata' },
    skills: [{ type: String }],
    emergencyContact: {
      name: String,
      relation: String,
      phone: String,
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zip: String,
    },
    bankDetails: {
      bankName: String,
      accountNumber: String,
      ifsc: String,
      accountHolder: String,
    },
    documents: [
      {
        type: { type: String },
        url: String,
        uploadedAt: { type: Date, default: Date.now },
        verified: { type: Boolean, default: false },
      },
    ],
    // Status is validated dynamically against the per-org EmployeeStatus catalog
    // (see HrService.ensureEmployeeStatusValid). Kept as a plain string here so
    // orgs can define custom statuses without a schema migration.
    status: {
      type: String,
      default: 'active',
    },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    policyIds: { type: [String], default: [] },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

EmployeeSchema.index({ firstName: 'text', lastName: 'text', email: 'text', skills: 'text' });
EmployeeSchema.index({ isDeleted: 1, isActive: 1 });
EmployeeSchema.index({ departmentId: 1, status: 1 });
