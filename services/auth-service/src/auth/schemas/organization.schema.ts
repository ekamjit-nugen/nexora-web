import { Schema, Document } from 'mongoose';

// ── Feature Flags ──

export interface IFeatureFlag {
  enabled: boolean;
}

export interface IOrganizationFeatures {
  projects: IFeatureFlag;
  tasks: IFeatureFlag;
  sprints: IFeatureFlag;
  timesheets: IFeatureFlag;
  attendance: IFeatureFlag;
  leaves: IFeatureFlag;
  clients: IFeatureFlag;
  invoices: IFeatureFlag;
  reports: IFeatureFlag;
  chat: IFeatureFlag;
  calls: IFeatureFlag;
  ai: IFeatureFlag;
  assetManagement: IFeatureFlag;
  expenseManagement: IFeatureFlag;
  recruitment: IFeatureFlag;
}

// ── Settings sub-document ──

export interface IOrganizationSettings {
  timezone: string;
  currency: string;
  dateFormat: string;
  timeFormat?: string;
  numberFormat?: string;
  weekStartDay?: string;
  financialYearStart?: number;
}

// ── Business Details ──

export interface IAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

export interface IAuthorizedSignatory {
  name?: string;
  designation?: string;
  pan?: string;
  din?: string;
}

export interface IBankDetails {
  bankName?: string;
  branchName?: string;
  accountNumber?: string; // encrypted
  ifscCode?: string;
  accountType?: string;
  micrCode?: string;
  swiftCode?: string;
}

export interface IBusinessDetails {
  registeredAddress?: IAddress;
  communicationAddress?: IAddress & { sameAsRegistered?: boolean };
  pan?: string;
  gstin?: string;
  cin?: string;
  tan?: string;
  msmeRegistration?: string;
  iec?: string;
  shopsEstablishmentLicense?: string;
  contactEmail?: string;
  contactPhone?: string;
  alternatePhone?: string;
  hrEmail?: string;
  financeEmail?: string;
  authorizedSignatory?: IAuthorizedSignatory;
  bankDetails?: IBankDetails;
}

// ── Payroll Config ──

export interface IPFConfig {
  applicable?: boolean;
  registrationNumber?: string;
  registrationDate?: Date;
  employerRate?: number;
  employeeRate?: number;
  adminChargesRate?: number;
  edliRate?: number;
  wageCeiling?: number;
  includeInCTC?: boolean;
  vpfAllowed?: boolean;
}

export interface IESIConfig {
  applicable?: boolean;
  registrationNumber?: string;
  registrationDate?: Date;
  employerRate?: number;
  employeeRate?: number;
  wageCeiling?: number;
  dispensary?: string;
}

export interface ITDSConfig {
  applicable?: boolean;
  defaultTaxRegime?: string;
  autoCalculate?: boolean;
  investmentDeclarationEnabled?: boolean;
  investmentProofWindow?: { start?: Date; end?: Date };
}

export interface IPTConfig {
  applicable?: boolean;
  state?: string;
  registrationNumber?: string;
  deductionFrequency?: string;
}

export interface ILWFConfig {
  applicable?: boolean;
  state?: string;
  deductionFrequency?: string;
}

export interface ISalaryComponent {
  name?: string;
  code?: string;
  type?: string; // earning | deduction | employer | reimbursement
  calculationMethod?: string; // fixed | percentage_basic | percentage_ctc | percentage_gross
  defaultValue?: number;
  isTaxable?: boolean;
  taxExemptionLimit?: number;
  isPFEligible?: boolean;
  isESIEligible?: boolean;
  showInPayslip?: boolean;
  isDefault?: boolean;
  order?: number;
}

export interface IPayrollSchedule {
  payCycle?: string;
  payDay?: number;
  processingStartDay?: number;
  attendanceCutoff?: number;
  arrearsProcessing?: boolean;
  paymentModes?: string[];
}

export interface IPayrollConfig {
  pfConfig?: IPFConfig;
  esiConfig?: IESIConfig;
  tdsConfig?: ITDSConfig;
  ptConfig?: IPTConfig;
  lwfConfig?: ILWFConfig;
  salaryStructure?: { components?: ISalaryComponent[] };
  schedule?: IPayrollSchedule;
}

// ── Work Preferences ──

export interface IHoliday {
  name?: string;
  date?: Date;
  type?: string; // national | regional | restricted | company | optional
  applicableTo?: string;
  isOptional?: boolean;
}

export interface ILeaveType {
  name?: string;
  code?: string;
  annualQuota?: number;
  accrualMethod?: string;
  carryForward?: boolean;
  maxCarryForward?: number;
  encashable?: boolean;
  approvalRequired?: boolean;
  applicableTo?: string;
  prorateForMidYear?: boolean;
  genderSpecific?: string;
  minServiceMonths?: number;
  isDefault?: boolean;
}

export interface IWorkPreferences {
  workingDays?: string[];
  saturdayPattern?: string;
  workingHours?: {
    start?: string;
    end?: string;
    breakMinutes?: number;
    effectiveHours?: number;
  };
  flexibleTiming?: boolean;
  gracePeriodLate?: number;
  gracePeriodEarly?: number;
  halfDayThreshold?: number;
  overtime?: {
    applicable?: boolean;
    rate?: number;
    minimumTriggerMinutes?: number;
  };
  attendance?: {
    trackingMethods?: string[];
    geoFenceRadius?: number;
    officeLocations?: Array<{ name?: string; latitude?: number; longitude?: number; radius?: number }>;
    allowedIPRanges?: string[];
    autoCheckout?: boolean;
    autoCheckoutTime?: string;
    regularizationAllowed?: boolean;
    regularizationWindowDays?: number;
  };
  holidays?: IHoliday[];
  restrictedHolidays?: { totalAvailable?: number; employeeCanChoose?: number };
  leaveTypes?: ILeaveType[];
}

// ── Branding ──

export interface IBranding {
  logo?: string;
  icon?: string;
  logoDark?: string;
  logoAlignment?: string;
  primaryColor?: string;
  secondaryColor?: string;
  sidebarColor?: string;
  payslipHeader?: string;
  payslipFooter?: string;
  letterHeader?: string;
  letterFooter?: string;
}

// ── Notifications ──

export interface INotificationConfig {
  channels?: {
    inApp?: boolean;
    email?: boolean;
    desktopPush?: boolean;
    mobilePush?: boolean;
    internalChat?: boolean;
  };
  categories?: {
    attendance?: { inApp?: boolean; email?: boolean };
    leave?: { inApp?: boolean; email?: boolean };
    payroll?: { inApp?: boolean; email?: boolean };
    tasks?: { inApp?: boolean; email?: boolean };
    projects?: { inApp?: boolean; email?: boolean };
    members?: { inApp?: boolean; email?: boolean };
    system?: { inApp?: boolean; email?: boolean };
    announcements?: { inApp?: boolean; email?: boolean };
  };
  escalation?: {
    leavePendingReminderHours?: number;
    leaveAutoEscalationDays?: number;
    leaveAutoApproveDays?: number;
  };
}

// ── Main Organization Interface ──

export interface IOrganization extends Document {
  name: string;
  slug: string;
  industry: string;
  size: string;
  type?: string;
  country?: string;
  state?: string;
  city?: string;
  description?: string;
  foundedYear?: number;
  website?: string;
  plan: string;
  logo?: string;
  domain?: string;
  ownerId?: string;

  settings: IOrganizationSettings;
  features: IOrganizationFeatures;
  business?: IBusinessDetails;
  payroll?: IPayrollConfig;
  workPreferences?: IWorkPreferences;
  branding?: IBranding;
  notifications?: INotificationConfig;

  integrations?: Array<{
    provider?: string;
    status?: string;
    config?: Record<string, unknown>;
    lastSyncAt?: Date;
    connectedAt?: Date;
    connectedBy?: string;
  }>;
  webhooks?: Array<{
    url?: string;
    events?: string[];
    secretKey?: string;
    isActive?: boolean;
    lastTriggeredAt?: Date;
    failureCount?: number;
    createdAt?: Date;
  }>;

  onboardingCompleted: boolean;
  onboardingStep: number;
  isActive: boolean;
  isDeleted: boolean;
  createdBy: string;

  deletionRequested?: boolean;
  deletionRequestedAt?: Date;
  deletionRequestedBy?: string;
  deletionScheduledAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

// ── Mongoose Schema ──

export const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    industry: { type: String, default: 'other' },
    size: {
      type: String,
      enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
      default: '1-10',
    },
    plan: {
      type: String,
      enum: ['free', 'starter', 'professional', 'enterprise'],
      default: 'free',
    },
    type: { type: String, default: null },
    country: { type: String, default: null },
    state: { type: String, default: null },
    city: { type: String, default: null },
    description: { type: String, default: null },
    foundedYear: { type: Number, default: null },
    website: { type: String, default: null },
    logo: { type: String, default: null },
    domain: { type: String, default: null },
    ownerId: { type: String, default: null },

    // Regional settings
    settings: {
      timezone: { type: String, default: 'Asia/Kolkata' },
      currency: { type: String, default: 'INR' },
      dateFormat: { type: String, default: 'DD/MM/YYYY' },
      timeFormat: { type: String, default: '12h' },
      numberFormat: { type: String, default: 'indian' },
      weekStartDay: { type: String, default: 'monday' },
      financialYearStart: { type: Number, default: 4 }, // April
    },

    // Feature flags
    features: {
      type: Schema.Types.Mixed,
      default: () => ({
        projects:         { enabled: true },
        tasks:            { enabled: true },
        sprints:          { enabled: true },
        timesheets:       { enabled: true },
        attendance:       { enabled: true },
        leaves:           { enabled: true },
        clients:          { enabled: true },
        invoices:         { enabled: true },
        reports:          { enabled: true },
        chat:             { enabled: true },
        calls:            { enabled: true },
        ai:               { enabled: false },
        assetManagement:  { enabled: false },
        expenseManagement: { enabled: false },
        recruitment:      { enabled: false },
      }),
    },

    // Business & legal details
    business: { type: Schema.Types.Mixed, default: null },

    // Payroll & statutory config
    payroll: { type: Schema.Types.Mixed, default: null },

    // Work preferences (hours, holidays, leave types, attendance)
    workPreferences: { type: Schema.Types.Mixed, default: null },

    // Branding (logo, colors, document templates)
    branding: { type: Schema.Types.Mixed, default: null },

    // Org-wide notification config
    notifications: { type: Schema.Types.Mixed, default: null },

    // Integrations
    integrations: { type: Schema.Types.Mixed, default: [] },

    // Webhooks
    webhooks: { type: Schema.Types.Mixed, default: [] },

    // Onboarding
    onboardingCompleted: { type: Boolean, default: false },
    onboardingStep: { type: Number, default: 0 },

    // Status
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },

    // Deletion tracking
    deletionRequested: { type: Boolean, default: false },
    deletionRequestedAt: { type: Date, default: null },
    deletionRequestedBy: { type: String, default: null },
    deletionScheduledAt: { type: Date, default: null },
  },
  { timestamps: true },
);

OrganizationSchema.index({ slug: 1 }, { unique: true });
OrganizationSchema.index({ domain: 1 });
OrganizationSchema.index({ isDeleted: 1, isActive: 1 });
OrganizationSchema.index({ ownerId: 1 });
