import {
  IsString, IsOptional, IsBoolean, IsEnum, IsArray,
  IsNumber, IsObject, ValidateNested, Min, Max,
  IsNotEmpty,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ── Rule DTO ──

class PolicyRuleDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsEnum(['equals', 'greater_than', 'less_than', 'contains', 'between', 'in'])
  operator: string;

  @IsNotEmpty()
  value: any;

  @IsOptional()
  @IsString()
  description?: string;
}

// ── Create Policy DTO ──

export class CreatePolicyDto {
  @IsString()
  @IsNotEmpty()
  policyName: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['attendance', 'working_hours', 'leave', 'wfh', 'overtime', 'shift', 'invoices', 'expenses', 'exemptions', 'travel', 'reimbursement'])
  category: string;

  @IsOptional()
  @IsObject()
  workTiming?: any;

  @IsOptional()
  @IsObject()
  wfhConfig?: any;

  @IsOptional()
  @IsObject()
  leaveConfig?: any;

  @IsOptional()
  @IsObject()
  overtimeConfig?: any;

  @IsOptional()
  @IsObject()
  shiftConfig?: any;

  @IsOptional()
  @IsObject()
  expenseConfig?: any;

  @IsOptional()
  @IsObject()
  travelConfig?: any;

  @IsOptional()
  @IsObject()
  reimbursementConfig?: any;

  @IsOptional()
  @IsObject()
  invoiceConfig?: any;

  @IsOptional()
  @IsObject()
  exemptionConfig?: any;

  @IsOptional()
  @IsObject()
  attendanceConfig?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyRuleDto)
  rules?: PolicyRuleDto[];

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableIds?: string[];

  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  effectiveFrom?: Date;

  @IsOptional()
  effectiveTo?: Date;

  @IsOptional()
  reviewDate?: Date;

  @IsOptional()
  @IsBoolean()
  acknowledgementRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Update Policy DTO ──

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  policyName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['attendance', 'working_hours', 'leave', 'wfh', 'overtime', 'shift', 'invoices', 'expenses', 'exemptions', 'travel', 'reimbursement'])
  category?: string;

  @IsOptional()
  @IsObject()
  workTiming?: any;

  @IsOptional()
  @IsObject()
  wfhConfig?: any;

  @IsOptional()
  @IsObject()
  leaveConfig?: any;

  @IsOptional()
  @IsObject()
  overtimeConfig?: any;

  @IsOptional()
  @IsObject()
  shiftConfig?: any;

  @IsOptional()
  @IsObject()
  expenseConfig?: any;

  @IsOptional()
  @IsObject()
  travelConfig?: any;

  @IsOptional()
  @IsObject()
  reimbursementConfig?: any;

  @IsOptional()
  @IsObject()
  invoiceConfig?: any;

  @IsOptional()
  @IsObject()
  exemptionConfig?: any;

  @IsOptional()
  @IsObject()
  attendanceConfig?: any;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyRuleDto)
  rules?: PolicyRuleDto[];

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableIds?: string[];

  @IsOptional()
  effectiveFrom?: Date;

  @IsOptional()
  effectiveTo?: Date;

  @IsOptional()
  reviewDate?: Date;

  @IsOptional()
  @IsBoolean()
  acknowledgementRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  changeLog?: string;

  @IsOptional()
  @IsString()
  sourceTemplateId?: string;

  @IsOptional()
  @IsString()
  templateName?: string;

  @IsOptional()
  @IsString()
  previousVersionId?: string;

  @IsOptional()
  @IsNumber()
  version?: number;

  @IsOptional()
  @IsBoolean()
  isLatestVersion?: boolean;
}

// ── Policy Query DTO ──

export class PolicyQueryDto {
  @IsOptional()
  @IsEnum(['attendance', 'working_hours', 'leave', 'wfh', 'overtime', 'shift', 'invoices', 'expenses', 'exemptions', 'travel', 'reimbursement'])
  category?: string;

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isTemplate?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isLatestVersion?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ── Create From Template DTO ──

export class CreateFromTemplateDto {
  @IsOptional()
  @IsString()
  policyName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  sourceTemplateId?: string;

  @IsOptional()
  @IsObject()
  workTiming?: any;

  @IsOptional()
  @IsObject()
  wfhConfig?: any;

  @IsOptional()
  @IsObject()
  leaveConfig?: any;

  @IsOptional()
  @IsObject()
  overtimeConfig?: any;

  @IsOptional()
  @IsObject()
  shiftConfig?: any;

  @IsOptional()
  @IsObject()
  expenseConfig?: any;

  @IsOptional()
  @IsObject()
  travelConfig?: any;

  @IsOptional()
  @IsObject()
  reimbursementConfig?: any;

  @IsOptional()
  @IsObject()
  invoiceConfig?: any;

  @IsOptional()
  @IsObject()
  exemptionConfig?: any;

  @IsOptional()
  @IsObject()
  attendanceConfig?: any;

  @IsOptional()
  @IsArray()
  rules?: any[];

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableIds?: string[];

  @IsOptional()
  effectiveFrom?: Date;

  @IsOptional()
  effectiveTo?: Date;

  @IsOptional()
  @IsBoolean()
  acknowledgementRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ── Acknowledge DTO ──

export class AcknowledgePolicyDto {
  @IsOptional()
  @IsNumber()
  version?: number;
}
