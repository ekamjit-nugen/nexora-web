import { Schema, Document, model } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type SetupStage = 'otp_verified' | 'org_created' | 'profile_complete' | 'complete' | 'invited';

export interface IUserPreferences {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  timezone?: string;
  notifications?: {
    email?: boolean;
    inApp?: boolean;
    desktop?: boolean;
  };
}

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isEmailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpiry?: Date;
  phoneNumber?: string;
  isPhoneVerified: boolean;
  phoneVerificationToken?: string;
  phoneVerificationExpiry?: Date;
  jobTitle?: string;
  department?: string;
  mfaEnabled: boolean;
  mfaMethod?: 'TOTP' | 'SMS' | 'EMAIL';
  mfaSecret?: string;
  mfaBackupCodes?: string[];
  lastLogin?: Date;
  lastLoginIp?: string;
  loginAttempts: number;
  lockUntil?: Date;
  isActive: boolean;
  deletedAt?: Date;
  setupStage: SetupStage;
  defaultOrganizationId?: string;
  lastOrgId?: string;
  organizations: string[];
  roles: string[];
  permissions: string[];
  oauthProviders?: {
    google?: { id: string; email: string };
    microsoft?: { id: string; email: string };
    saml?: { id: string; email: string };
  };
  isPlatformAdmin: boolean;
  preferences?: IUserPreferences;
  otp?: string;
  otpExpiresAt?: Date;
  otpAttempts?: number;
  otpLastRequestedAt?: Date;
  otpRequestCount?: number;
  gdprDeletionRequested?: boolean;
  gdprDeletionRequestedAt?: Date;
  gdprDeletionScheduledAt?: Date;
  gdprDeletionReason?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isAccountLocked(): boolean;
}

export const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: false, // Not required for OAuth users
      minlength: 8,
      select: false, // Don't return password by default
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationToken: {
      type: String,
      select: false,
    },
    emailVerificationExpiry: {
      type: Date,
      select: false,
    },
    jobTitle: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: null,
    },
    phoneNumber: {
      type: String,
      default: null,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    phoneVerificationToken: {
      type: String,
      select: false,
    },
    phoneVerificationExpiry: {
      type: Date,
      select: false,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaMethod: {
      type: String,
      enum: ['TOTP', 'SMS', 'EMAIL', null],
      default: null,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    mfaBackupCodes: [
      {
        type: String,
        select: false,
      },
    ],
    lastLogin: {
      type: Date,
      default: null,
    },
    lastLoginIp: {
      type: String,
      default: null,
    },
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    setupStage: {
      type: String,
      enum: ['otp_verified', 'org_created', 'profile_complete', 'complete', 'invited'],
      default: 'otp_verified',
      index: true,
    },
    defaultOrganizationId: {
      type: String,
      default: null,
    },
    lastOrgId: {
      type: String,
      default: null,
    },
    organizations: [{ type: String }],
    roles: {
      type: [String],
      default: ['user'],
    },
    permissions: [String],
    oauthProviders: {
      google: {
        id: String,
        email: String,
      },
      microsoft: {
        id: String,
        email: String,
      },
      saml: {
        id: String,
        email: String,
      },
    },
    isPlatformAdmin: {
      type: Boolean,
      default: false,
      index: true,
    },
    preferences: {
      theme: { type: String, enum: ['light', 'dark', 'system'], default: 'system' },
      language: { type: String, default: 'en' },
      timezone: { type: String, default: null },
      notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        desktop: { type: Boolean, default: false },
      },
    },
    otp: { type: String, select: false, default: null },
    otpExpiresAt: { type: Date, select: false, default: null },
    otpAttempts: { type: Number, select: false, default: 0 },
    otpLastRequestedAt: { type: Date, select: false, default: null },
    otpRequestCount: { type: Number, select: false, default: 0 },
    gdprDeletionRequested: { type: Boolean, default: false },
    gdprDeletionRequestedAt: { type: Date, default: null },
    gdprDeletionScheduledAt: { type: Date, default: null, index: true },
    gdprDeletionReason: { type: String, default: null },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ 'oauthProviders.google.id': 1 });
UserSchema.index({ 'oauthProviders.microsoft.id': 1 });
UserSchema.index({ 'oauthProviders.saml.id': 1 });
UserSchema.index({ deletedAt: 1 });
UserSchema.index({ lockUntil: 1 });

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

// Method to check if account is locked
UserSchema.methods.isAccountLocked = function (): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

export const UserModel = model<IUser>('User', UserSchema);

/*
 * When: User document is created or password is updated
 * if: password field is modified
 * then: bcrypt hash the password before saving to database
 */
