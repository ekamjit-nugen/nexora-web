import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, Min, Max, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ── Half Day DTO ──

export class HalfDayDto {
  @IsBoolean()
  enabled: boolean;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsEnum(['first_half', 'second_half'])
  half?: string;
}

// ── Apply Leave DTO ──

export class ApplyLeaveDto {
  @IsEnum(['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'])
  leaveType: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  reason: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => HalfDayDto)
  halfDay?: HalfDayDto;
}

// ── Approve Leave DTO ──

export class ApproveLeaveDto {
  @IsEnum(['approved', 'rejected'])
  status: string;

  @IsOptional() @IsString()
  rejectionReason?: string;
}

// ── Cancel Leave DTO ──

export class CancelLeaveDto {
  @IsString()
  reason: string;
}

// ── Leave Query DTO ──

export class LeaveQueryDto {
  @IsOptional() @IsString()
  employeeId?: string;

  @IsOptional() @IsEnum(['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'])
  leaveType?: string;

  @IsOptional() @IsEnum(['pending', 'approved', 'rejected', 'cancelled'])
  status?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Leave Type Config DTO ──

export class LeaveTypeConfigDto {
  @IsEnum(['casual', 'sick', 'earned', 'wfh', 'maternity', 'paternity', 'bereavement', 'comp_off', 'lop'])
  type: string;

  @IsNumber() @Min(0)
  annualAllocation: number;

  @IsOptional() @IsEnum(['monthly', 'quarterly', 'annual', 'on_request'])
  accrualFrequency?: string;

  @IsOptional() @IsNumber() @Min(0)
  maxCarryForward?: number;

  @IsOptional() @IsBoolean()
  encashable?: boolean;

  @IsOptional() @IsNumber() @Min(0)
  maxConsecutiveDays?: number;
}

// ── Blackout Period DTO ──

export class BlackoutPeriodDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  reason: string;
}

// ── Create Leave Policy DTO ──

export class CreateLeavePolicyDto {
  @IsString()
  policyName: string;

  @IsOptional() @IsEnum(['draft', 'active', 'archived'])
  status?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveTypeConfigDto)
  leaveTypes: LeaveTypeConfigDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlackoutPeriodDto)
  blackoutPeriods?: BlackoutPeriodDto[];
}

// ── Update Leave Policy DTO ──

export class UpdateLeavePolicyDto {
  @IsOptional() @IsString()
  policyName?: string;

  @IsOptional() @IsEnum(['draft', 'active', 'archived'])
  status?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LeaveTypeConfigDto)
  leaveTypes?: LeaveTypeConfigDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlackoutPeriodDto)
  blackoutPeriods?: BlackoutPeriodDto[];
}
