import { IsString, IsOptional, IsEnum, IsDateString, IsNumber, Min, Max, IsBoolean, IsArray, ValidateNested, IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';

const POLICY_CATEGORIES = [
  'work_policy', 'leave_policy', 'attendance_policy', 'remote_work',
  'compensation', 'travel_expense', 'it_security', 'code_of_conduct',
  'performance', 'onboarding', 'training', 'communication',
  'health_safety', 'data_privacy', 'exit_policy',
];

// ── Attendance DTOs ──

// Geolocation captured from the browser at clock-in/out. Validated as
// real lat/lng (rejects 0,0 attempts and out-of-range numbers). Accuracy
// is the radius (in metres) the browser reports — values >100m typically
// mean GPS wasn't available and the position is from wifi/IP fallback,
// which is fine for office attendance but admins should know.
export class GeoLocationDto {
  @IsLatitude({ message: 'latitude must be a valid latitude (-90..90)' })
  latitude: number;

  @IsLongitude({ message: 'longitude must be a valid longitude (-180..180)' })
  longitude: number;

  @IsOptional() @IsNumber() @Min(0)
  accuracy?: number;

  @IsOptional() @IsString()
  address?: string;
}

export class CheckInDto {
  @IsOptional()
  @IsEnum(['web', 'mobile', 'biometric', 'admin_force'])
  method?: string;

  @IsOptional() @ValidateNested() @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}

export class CheckOutDto {
  @IsOptional()
  @IsEnum(['web', 'mobile', 'biometric', 'admin_force'])
  method?: string;

  @IsOptional() @ValidateNested() @Type(() => GeoLocationDto)
  location?: GeoLocationDto;
}

export class ManualEntryDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsString()
  date: string;

  @IsString()
  checkInTime: string;

  @IsString()
  checkOutTime: string;

  @IsString()
  reason: string;

  @IsOptional()
  @IsEnum(['present', 'late', 'half_day', 'absent', 'holiday', 'leave', 'wfh', 'comp_off'])
  status?: string;
}

export class AttendanceQueryDto {
  @IsOptional() @IsString()
  employeeId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['present', 'late', 'half_day', 'absent', 'holiday', 'leave', 'wfh', 'comp_off'])
  status?: string;

  // Rich filters (added for the redesigned /attendance page).
  // - search: free-text match on the employee snapshot (name / employeeId)
  // - departmentId: HR department _id
  // - managerId: HR reporting-manager _id (used for "my team" view)
  // The service joins to nexora_hr.employees to honour these.
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @IsString()
  managerId?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}

// ── Shift DTOs ──

export class CreateShiftDto {
  @IsString()
  shiftName: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional() @IsNumber() @Min(0)
  graceMinutesLateArrival?: number;

  @IsOptional() @IsNumber() @Min(0)
  graceMinutesEarlyDeparture?: number;

  @IsOptional() @IsNumber() @Min(0)
  minimumWorkingHours?: number;

  @IsOptional() @IsNumber() @Min(0)
  breakDurationMinutes?: number;

  @IsOptional() @IsBoolean()
  isNightShift?: boolean;
}

export class UpdateShiftDto {
  @IsOptional() @IsString()
  shiftName?: string;

  @IsOptional() @IsString()
  startTime?: string;

  @IsOptional() @IsString()
  endTime?: string;

  @IsOptional() @IsNumber() @Min(0)
  graceMinutesLateArrival?: number;

  @IsOptional() @IsNumber() @Min(0)
  graceMinutesEarlyDeparture?: number;

  @IsOptional() @IsNumber() @Min(0)
  minimumWorkingHours?: number;

  @IsOptional() @IsNumber() @Min(0)
  breakDurationMinutes?: number;

  @IsOptional() @IsBoolean()
  isNightShift?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

// ── Policy DTOs ──

export class CreatePolicyDto {
  @IsString()
  policyName: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['work_timing', 'leave', 'wfh', 'expense', 'travel', 'security', 'code_of_conduct', 'communication', 'equipment', 'general', 'timesheet'])
  type?: string;

  @IsOptional()
  @IsEnum(POLICY_CATEGORIES)
  category?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsNumber() @Min(1)
  maxWorkingHoursPerWeek?: number;

  @IsOptional() @IsArray()
  conditions?: Array<{ name: string; value: string; description?: string }>;

  @IsOptional()
  workTiming?: {
    startTime?: string;
    endTime?: string;
    timezone?: string;
    graceMinutes?: number;
    minWorkingHours?: number;
    breakMinutes?: number;
  };

  @IsOptional()
  wfhPolicy?: {
    maxDaysPerMonth?: number;
    requiresApproval?: boolean;
    allowedDays?: string[];
  };

  @IsOptional()
  leavePolicy?: {
    leaveTypes?: Array<{
      type: string;
      label: string;
      annualAllocation?: number;
      accrualFrequency?: string;
      accrualAmount?: number;
      maxCarryForward?: number;
      encashable?: boolean;
      maxConsecutiveDays?: number;
      requiresDocument?: boolean;
      applicableTo?: string;
      minServiceMonths?: number;
    }>;
    yearStart?: string;
    probationLeaveAllowed?: boolean;
    halfDayAllowed?: boolean;
    backDatedLeaveMaxDays?: number;
  };

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  applicableIds?: string[];

  @IsOptional() @IsBoolean()
  isTemplate?: boolean;

  @IsOptional() @IsString()
  templateName?: string;

  @IsOptional() @IsDateString()
  effectiveFrom?: string;

  @IsOptional() @IsDateString()
  effectiveTo?: string;

  @IsOptional() @IsDateString()
  reviewDate?: string;

  @IsOptional() @IsNumber() @Min(1)
  version?: number;

  @IsOptional() @IsBoolean()
  acknowledgementRequired?: boolean;

  @IsOptional()
  alerts?: {
    lateArrival?: boolean;
    earlyDeparture?: boolean;
    missedClockIn?: boolean;
    overtimeAlert?: boolean;
  };
}

export class UpdatePolicyDto {
  @IsOptional() @IsString()
  policyName?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['work_timing', 'leave', 'wfh', 'expense', 'travel', 'security', 'code_of_conduct', 'communication', 'equipment', 'general', 'timesheet'])
  type?: string;

  @IsOptional()
  @IsEnum(POLICY_CATEGORIES)
  category?: string;

  @IsOptional() @IsString()
  content?: string;

  @IsOptional() @IsNumber() @Min(1)
  maxWorkingHoursPerWeek?: number;

  @IsOptional() @IsArray()
  conditions?: Array<{ name: string; value: string; description?: string }>;

  @IsOptional()
  workTiming?: {
    startTime?: string;
    endTime?: string;
    timezone?: string;
    graceMinutes?: number;
    minWorkingHours?: number;
    breakMinutes?: number;
  };

  @IsOptional()
  wfhPolicy?: {
    maxDaysPerMonth?: number;
    requiresApproval?: boolean;
    allowedDays?: string[];
  };

  @IsOptional()
  leavePolicy?: {
    leaveTypes?: Array<{
      type: string;
      label: string;
      annualAllocation?: number;
      accrualFrequency?: string;
      accrualAmount?: number;
      maxCarryForward?: number;
      encashable?: boolean;
      maxConsecutiveDays?: number;
      requiresDocument?: boolean;
      applicableTo?: string;
      minServiceMonths?: number;
    }>;
    yearStart?: string;
    probationLeaveAllowed?: boolean;
    halfDayAllowed?: boolean;
    backDatedLeaveMaxDays?: number;
  };

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional()
  applicableIds?: string[];

  @IsOptional() @IsBoolean()
  isTemplate?: boolean;

  @IsOptional() @IsString()
  templateName?: string;

  @IsOptional() @IsDateString()
  effectiveFrom?: string;

  @IsOptional() @IsDateString()
  effectiveTo?: string;

  @IsOptional() @IsDateString()
  reviewDate?: string;

  @IsOptional() @IsNumber() @Min(1)
  version?: number;

  @IsOptional() @IsBoolean()
  acknowledgementRequired?: boolean;

  @IsOptional()
  alerts?: {
    lateArrival?: boolean;
    earlyDeparture?: boolean;
    missedClockIn?: boolean;
    overtimeAlert?: boolean;
  };

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class PolicyQueryDto {
  @IsOptional()
  @IsEnum(['work_timing', 'leave', 'wfh', 'expense', 'travel', 'security', 'code_of_conduct', 'communication', 'equipment', 'general', 'timesheet'])
  type?: string;

  @IsOptional()
  @IsEnum(POLICY_CATEGORIES)
  category?: string;

  @IsOptional()
  @IsEnum(['all', 'department', 'designation', 'specific'])
  applicableTo?: string;

  @IsOptional() @IsBoolean()
  isTemplate?: boolean;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;
}
