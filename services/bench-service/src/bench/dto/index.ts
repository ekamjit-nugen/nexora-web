import {
  IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber,
  Min, Max, IsBoolean,
} from 'class-validator';

// ── Resource Request DTOs ──

export class CreateResourceRequestDto {
  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  projectName?: string;

  @IsString()
  title: string;

  @IsArray()
  @IsString({ each: true })
  requiredSkills: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minExperienceYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  allocationPercentage?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateResourceRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  preferredSkills?: string[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  minExperienceYears?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  allocationPercentage?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @IsOptional()
  @IsEnum(['open', 'matched', 'partially_filled', 'closed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateMatchStatusDto {
  @IsEnum(['approved', 'rejected'])
  status: string;
}

export class ResourceRequestQueryDto {
  @IsOptional()
  @IsEnum(['open', 'matched', 'partially_filled', 'closed', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

// ── Bench Query DTOs ──

export class BenchEmployeeQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  skill?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class BenchTrendQueryDto {
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  groupBy?: string;
}

// ── Bench Config DTOs ──

export class UpdateBenchConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  workingDaysPerMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  workingHoursPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  benchThresholdPercentage?: number;

  @IsOptional()
  @IsEnum(['ctc', 'gross', 'net'])
  costCalculationMethod?: string;

  @IsOptional()
  @IsBoolean()
  autoSnapshotEnabled?: boolean;
}
