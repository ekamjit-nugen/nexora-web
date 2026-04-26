import { IsString, IsOptional, IsEmail, IsEnum, IsDateString, IsArray, IsNumber, Min, Max, IsBoolean, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';

// Bank details (payroll routing). Optional on update — HR often doesn't
// have this during invite and collects it at onboarding.
export class BankDetailsDto {
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountNumber?: string;
  // IFSC: 4 letters + 0 + 6 alphanumerics. e.g. HDFC0001234. Validating
  // here stops typos with a server-side error rather than silently
  // breaking future payout files.
  @IsOptional() @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'IFSC must match format like HDFC0001234' })
  ifsc?: string;
  @IsOptional() @IsString() accountHolder?: string;
}

// Shared sub-doc DTOs — must be declared BEFORE any DTO that references
// them via @Type(() => …) decorators, otherwise TypeScript emits them
// as TDZ-unsafe references ("Cannot access 'AddressDto' before
// initialization") when the surrounding class body executes at load.
export class AddressDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() zip?: string;
}

export class EmergencyContactDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() relation?: string;
  @IsOptional() @IsString() phone?: string;
}

// ── Employee DTOs ──

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  designationId?: string;

  @IsOptional() @IsString()
  reportingManagerId?: string;

  @IsEnum(['full_time', 'part_time', 'contract', 'intern'])
  @IsOptional()
  employmentType?: string;

  @IsDateString()
  joiningDate: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  timezone?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];

  @IsOptional()
  @IsEnum(['active', 'invited', 'pending', 'declined', 'on_notice', 'exited', 'on_leave', 'probation'])
  status?: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString()
  firstName?: string;

  @IsOptional() @IsString()
  lastName?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @IsOptional() @IsEnum(['male', 'female', 'other'])
  gender?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  designationId?: string;

  @IsOptional() @IsString()
  teamId?: string;

  @IsOptional() @IsString()
  reportingManagerId?: string;

  @IsOptional() @IsEnum(['full_time', 'part_time', 'contract', 'intern'])
  employmentType?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  timezone?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];

  @IsOptional() @IsEnum(['active', 'invited', 'pending', 'declined', 'on_notice', 'exited', 'on_leave', 'probation'])
  status?: string;

  // ---- Statutory & banking identifiers (all optional) ----
  // PAN: exactly 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F).
  // Keep the validator permissive (uppercase-only normalised by schema)
  // so the admin can paste the common "abcde1234f" and still pass.
  @IsOptional() @Matches(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, { message: 'PAN must match format ABCDE1234F' })
  pan?: string;

  // UAN: exactly 12 numeric digits issued by EPFO. Zero-padded.
  @IsOptional() @Matches(/^\d{12}$/, { message: 'UAN must be a 12-digit number' })
  uan?: string;

  // Legacy PF account (pre-UAN): regional code + establishment + member id.
  // Formats vary wildly by state office — validate as non-empty string.
  @IsOptional() @IsString()
  pfAccountNumber?: string;

  // ESIC Insurance Number: 10 digits (new format) or longer legacy formats.
  // Accept either — legacy records still exist.
  @IsOptional() @Matches(/^\d{10,17}$/, { message: 'ESI number must be 10–17 digits' })
  esiNumber?: string;

  @IsOptional() @ValidateNested() @Type(() => BankDetailsDto)
  bankDetails?: BankDetailsDto;

  // Personal fields (also accepted on admin PUT so HR can correct bad
  // onboarding data — most orgs capture these at onboarding and never
  // touch them again).
  @IsOptional() @IsEmail()
  personalEmail?: string;

  @IsOptional() @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @IsOptional() @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: string;

  @IsOptional() @ValidateNested() @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional() @ValidateNested() @Type(() => AddressDto)
  permanentAddress?: AddressDto;

  @IsOptional() @ValidateNested() @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;
}

// ── Self-service DTOs ──
// These are the ONLY fields an employee can change on their own record
// via /api/v1/employees/me. Everything else (department, designation,
// reporting line, employment type, statutory identifiers, bank details,
// employment status) routes through admin-only paths. Keeping this DTO
// narrow is the security boundary — even if the role guard is misconfigured,
// class-validator strips unknown fields with `whitelist: true` (set in
// the global ValidationPipe in main.ts).

export class UpdateSelfProfileDto {
  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsEmail()
  personalEmail?: string;

  @IsOptional() @IsEnum(['single', 'married', 'divorced', 'widowed'])
  maritalStatus?: string;

  @IsOptional() @IsEnum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
  bloodGroup?: string;

  @IsOptional() @ValidateNested() @Type(() => AddressDto)
  address?: AddressDto;

  @IsOptional() @ValidateNested() @Type(() => AddressDto)
  permanentAddress?: AddressDto;

  @IsOptional() @ValidateNested() @Type(() => EmergencyContactDto)
  emergencyContact?: EmergencyContactDto;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];
}

// Bank change submission (self-service). Reason optional — some orgs
// will want to enforce it via policy later, but the audit trail already
// captures who submitted what.
export class SubmitBankChangeDto {
  @ValidateNested() @Type(() => BankDetailsDto)
  bankDetails: BankDetailsDto;

  @IsOptional() @IsString()
  reason?: string;
}

export class RejectBankChangeDto {
  @IsString()
  reason: string;
}

export class EmployeeQueryDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  designationId?: string;

  @IsOptional() @IsEnum(['full_time', 'part_time', 'contract', 'intern'])
  employmentType?: string;

  @IsOptional() @IsEnum(['active', 'invited', 'pending', 'declined', 'on_notice', 'exited', 'on_leave', 'probation'])
  status?: string;

  @IsOptional() @IsString()
  location?: string;

  @IsOptional() @IsString()
  managerId?: string;

  // Filter by auth user id. Enables services to resolve "the HR employee
  // for this caller" via a single query (e.g. payroll `/salary-structures/me`).
  @IsOptional() @IsString()
  userId?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  sort?: string;
}

// ── Department DTOs ──

export class CreateDepartmentDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  headId?: string;

  @IsOptional() @IsString()
  parentDepartmentId?: string;

  @IsOptional() @IsString()
  costCenter?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  headId?: string;

  @IsOptional() @IsString()
  parentDepartmentId?: string;

  @IsOptional() @IsString()
  costCenter?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Designation DTOs ──

export class CreateDesignationDto {
  @IsString()
  title: string;

  @IsNumber() @Min(1) @Max(10)
  level: number;

  @IsOptional() @IsEnum(['individual_contributor', 'management'])
  track?: string;

  @IsOptional() @IsString()
  departmentId?: string;
}

export class UpdateDesignationDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsNumber() @Min(1) @Max(10)
  level?: number;

  @IsOptional() @IsEnum(['individual_contributor', 'management'])
  track?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Team DTOs ──

export class CreateTeamDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsString()
  departmentId: string;

  @IsOptional() @IsString()
  leadId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  members?: string[];

  @IsOptional() @IsBoolean()
  isCrossFunctional?: boolean;
}

export class UpdateTeamDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  leadId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  members?: string[];

  @IsOptional() @IsBoolean()
  isCrossFunctional?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Client DTOs ──

export class ContactPersonDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  designation?: string;
}

export class BillingAddressDto {
  @IsOptional() @IsString()
  street?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  state?: string;

  @IsOptional() @IsString()
  country?: string;

  @IsOptional() @IsString()
  zip?: string;
}

export class CreateClientDto {
  @IsString()
  companyName: string;

  @IsOptional() @IsString()
  displayName?: string;

  @IsOptional() @IsEnum(['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'media', 'consulting', 'other'])
  industry?: string;

  @IsOptional() @ValidateNested()
  @Type(() => ContactPersonDto)
  contactPerson?: ContactPersonDto;

  @IsOptional() @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;

  @IsOptional() @IsString()
  website?: string;

  @IsOptional() @IsString()
  taxId?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsNumber()
  paymentTerms?: number;

  @IsOptional() @IsEnum(['active', 'inactive', 'prospect'])
  status?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateClientDto {
  @IsOptional() @IsString()
  companyName?: string;

  @IsOptional() @IsString()
  displayName?: string;

  @IsOptional() @IsEnum(['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'media', 'consulting', 'other'])
  industry?: string;

  @IsOptional() @ValidateNested()
  @Type(() => ContactPersonDto)
  contactPerson?: ContactPersonDto;

  @IsOptional() @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress?: BillingAddressDto;

  @IsOptional() @IsString()
  website?: string;

  @IsOptional() @IsString()
  taxId?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsNumber()
  paymentTerms?: number;

  @IsOptional() @IsEnum(['active', 'inactive', 'prospect'])
  status?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString()
  notes?: string;
}

export class ClientContactPersonDto {
  @IsString()
  name: string;

  @IsString()
  email: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  designation?: string;

  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}

export class LinkProjectDto {
  @IsString()
  projectId: string;
}

export class ClientQueryDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(['active', 'inactive', 'prospect'])
  status?: string;

  @IsOptional()
  showDeleted?: boolean;

  @IsOptional() @IsEnum(['technology', 'finance', 'healthcare', 'education', 'retail', 'manufacturing', 'media', 'consulting', 'other'])
  industry?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  sort?: string;
}

// ── Invoice DTOs ──

export class InvoiceItemDto {
  @IsString()
  description: string;

  @IsNumber() @Min(0)
  quantity: number;

  @IsNumber() @Min(0)
  rate: number;

  @IsNumber() @Min(0)
  amount: number;

  @IsOptional() @IsNumber() @Min(0)
  taxRate?: number;

  @IsOptional() @IsNumber() @Min(0)
  taxAmount?: number;
}

export class CreateInvoiceDto {
  @IsString()
  clientId: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  templateId?: string;

  @IsOptional() @IsString()
  templateName?: string;

  @IsDateString()
  issueDate: string;

  @IsDateString()
  dueDate: string;

  @IsArray() @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @IsOptional() @IsNumber() @Min(0)
  discount?: number;

  @IsOptional() @IsEnum(['percentage', 'fixed'])
  discountType?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsNumber()
  paymentTerms?: number;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  paymentNotes?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  terms?: string;

  @IsOptional() @IsString()
  brandName?: string;

  @IsOptional() @IsString()
  brandLogo?: string;

  @IsOptional() @IsString()
  brandAddress?: string;

  @IsOptional() @IsString()
  signature?: string;

  @IsOptional() @IsBoolean()
  isRecurring?: boolean;

  @IsOptional() @IsEnum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
  recurringInterval?: string;

  @IsOptional() @IsString()
  recurringEmail?: string;

  @IsOptional() @IsDateString()
  recurringNextDate?: string;

  @IsOptional() @IsDateString()
  recurringEndDate?: string;
}

export class UpdateInvoiceDto {
  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  templateId?: string;

  @IsOptional() @IsString()
  templateName?: string;

  @IsOptional() @IsDateString()
  issueDate?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional() @IsNumber() @Min(0)
  discount?: number;

  @IsOptional() @IsEnum(['percentage', 'fixed'])
  discountType?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsNumber()
  paymentTerms?: number;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  paymentNotes?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  terms?: string;

  @IsOptional() @IsString()
  brandName?: string;

  @IsOptional() @IsString()
  brandLogo?: string;

  @IsOptional() @IsString()
  brandAddress?: string;

  @IsOptional() @IsString()
  signature?: string;

  @IsOptional() @IsBoolean()
  isRecurring?: boolean;

  @IsOptional() @IsEnum(['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
  recurringInterval?: string;

  @IsOptional() @IsString()
  recurringEmail?: string;

  @IsOptional() @IsDateString()
  recurringNextDate?: string;

  @IsOptional() @IsDateString()
  recurringEndDate?: string;

  @IsOptional() @IsEnum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'])
  status?: string;
}

export class UpdateInvoiceStatusDto {
  @IsEnum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'])
  status: string;
}

export class InvoiceQueryDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'])
  status?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  sort?: string;
}

export class SendInvoiceDto {
  @IsEmail()
  email: string;

  @IsOptional() @IsString()
  subject?: string;

  @IsOptional() @IsString()
  message?: string;
}

export class MarkPaidDto {
  @IsNumber() @Min(0)
  amount: number;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  paymentNotes?: string;
}

// ── Invoice Template DTOs ──

export class CreateInvoiceTemplateDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsNumber()
  defaultPaymentTerms?: number;

  @IsOptional() @IsString()
  defaultCurrency?: string;

  @IsOptional() @IsString()
  defaultNotes?: string;

  @IsOptional() @IsString()
  defaultTerms?: string;

  @IsOptional() @IsEnum(['standard', 'modern', 'minimal', 'professional', 'creative'])
  layout?: string;

  @IsOptional() @IsString()
  colorScheme?: string;

  @IsOptional() @IsBoolean()
  showLogo?: boolean;

  @IsOptional() @IsBoolean()
  showTax?: boolean;

  @IsOptional() @IsBoolean()
  showDiscount?: boolean;

  @IsOptional() @IsArray()
  defaultItems?: Array<{ description: string; rate: number }>;

  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

// ── Billing Rate DTOs ──

export class CreateBillingRateDto {
  @IsString()
  projectId: string;

  @IsEnum(['project_default', 'role_based', 'user_specific'])
  type: string;

  @IsOptional() @IsString()
  role?: string;

  @IsOptional() @IsString()
  userId?: string;

  @IsOptional() @IsString()
  userName?: string;

  @IsNumber() @Min(0)
  hourlyRate: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsDateString()
  effectiveFrom: string;

  @IsOptional() @IsDateString()
  effectiveTo?: string;
}

export class UpdateBillingRateDto {
  @IsOptional() @IsNumber() @Min(0)
  hourlyRate?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsDateString()
  effectiveFrom?: string;

  @IsOptional() @IsDateString()
  effectiveTo?: string;

  @IsOptional() @IsString()
  role?: string;

  @IsOptional() @IsString()
  userName?: string;
}

export class BillingRateQueryDto {
  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsEnum(['project_default', 'role_based', 'user_specific'])
  type?: string;
}

export class PreviewInvoiceDto {
  @IsArray() @IsString({ each: true })
  timesheetIds: string[];
}

export class GenerateInvoiceDto {
  @IsArray() @IsString({ each: true })
  timesheetIds: string[];

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsString()
  notes?: string;
}

// ── Call Log DTOs ──

export class CreateCallLogDto {
  @IsString()
  receiverId: string;

  @IsOptional() @IsString()
  receiverName?: string;

  @IsOptional() @IsString()
  callerName?: string;

  @IsOptional() @IsEnum(['audio', 'video'])
  type?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateCallLogDto {
  @IsOptional() @IsEnum(['initiated', 'ringing', 'answered', 'missed', 'declined', 'ended', 'failed'])
  status?: string;

  @IsOptional() @IsDateString()
  endTime?: string;

  @IsOptional() @IsNumber()
  duration?: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class CallLogQueryDto {
  @IsOptional() @IsString()
  userId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsEnum(['initiated', 'ringing', 'answered', 'missed', 'declined', 'ended', 'failed'])
  status?: string;

  @IsOptional() @IsEnum(['audio', 'video'])
  type?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}
