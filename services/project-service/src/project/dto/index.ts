import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, IsBoolean, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// ── Budget Sub-DTO ──

export class BudgetDto {
  @IsOptional() @IsNumber()
  amount?: number;

  @IsOptional() @IsString()
  currency?: string;

  @IsOptional() @IsEnum(['fixed', 'time_and_material', 'retainer', 'internal'])
  billingType?: string;

  @IsOptional() @IsNumber()
  hourlyRate?: number;

  @IsOptional() @IsNumber()
  retainerAmount?: number;
}

// ── Settings Sub-DTO ──

export class ProjectSettingsDto {
  @IsOptional() @IsEnum(['scrum', 'kanban', 'custom'])
  boardType?: string;

  @IsOptional() @IsBoolean()
  clientPortalEnabled?: boolean;

  @IsOptional() @IsNumber() @Min(1) @Max(90)
  sprintDuration?: number;

  @IsOptional() @IsEnum(['hours', 'story_points'])
  estimationUnit?: string;

  @IsOptional() @IsEnum(['board', 'list', 'timeline', 'calendar'])
  defaultView?: string;

  @IsOptional() @IsBoolean()
  enableTimeTracking?: boolean;

  @IsOptional() @IsBoolean()
  enableSubtasks?: boolean;

  @IsOptional() @IsBoolean()
  enableEpics?: boolean;

  @IsOptional() @IsBoolean()
  enableSprints?: boolean;

  @IsOptional() @IsBoolean()
  enableReleases?: boolean;
}

// ── Label Sub-DTO ──

export class LabelDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  key?: string;

  @IsOptional() @IsString()
  color?: string;
}

// ── Project DTOs ──

export class CreateProjectDto {
  @IsString()
  projectName: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsEnum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
  status?: string;

  @IsOptional() @ValidateNested() @Type(() => BudgetDto)
  budget?: BudgetDto;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @IsOptional() @IsEnum(['scrum', 'kanban', 'scrumban', 'waterfall', 'xp', 'lean', 'safe', 'custom'])
  methodology?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @ValidateNested() @Type(() => ProjectSettingsDto)
  settings?: ProjectSettingsDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LabelDto)
  labels?: LabelDto[];

  @IsOptional() @IsString()
  templateRef?: string;

  @IsOptional() @IsNumber()
  templateVersion?: number;
}

export class UpdateProjectDto {
  @IsOptional() @IsString()
  projectName?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsEnum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
  status?: string;

  @IsOptional() @ValidateNested() @Type(() => BudgetDto)
  budget?: BudgetDto;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  healthScore?: number;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  progressPercentage?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;

  @IsOptional() @IsEnum(['scrum', 'kanban', 'scrumban', 'waterfall', 'xp', 'lean', 'safe', 'custom'])
  methodology?: string;

  @IsOptional() @IsString()
  departmentId?: string;

  @IsOptional() @ValidateNested() @Type(() => ProjectSettingsDto)
  settings?: ProjectSettingsDto;

  @IsOptional() @IsDateString()
  actualStartDate?: string;

  @IsOptional() @IsDateString()
  actualEndDate?: string;
}

// ── Team Member DTOs ──

export class AddTeamMemberDto {
  @IsString()
  userId: string;

  @IsOptional() @IsEnum(['admin', 'manager', 'member', 'viewer'])
  role?: string;

  @IsOptional() @IsString()
  projectRole?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  allocationPercentage?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];
}

export class UpdateTeamMemberDto {
  @IsOptional() @IsEnum(['admin', 'manager', 'member', 'viewer'])
  role?: string;

  @IsOptional() @IsString()
  projectRole?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(100)
  allocationPercentage?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];
}

// ── Milestone DTOs ──

export class AddMilestoneDto {
  @IsString()
  name: string;

  @IsDateString()
  targetDate: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  phase?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  deliverables?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  dependencies?: string[];

  @IsOptional() @IsString()
  ownerId?: string;

  @IsOptional() @IsNumber()
  order?: number;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsDateString()
  targetDate?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  phase?: string;

  @IsOptional() @IsEnum(['pending', 'in_progress', 'completed', 'missed'])
  status?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  deliverables?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  dependencies?: string[];

  @IsOptional() @IsString()
  ownerId?: string;

  @IsOptional() @IsNumber()
  order?: number;
}

// ── Query DTO ──

export class ProjectQueryDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsEnum(['planning', 'active', 'on_hold', 'completed', 'cancelled'])
  status?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsString()
  clientId?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  sort?: string;
}

// ── Risk DTOs ──

export class AddRiskDto {
  @IsString()
  description: string;

  @IsOptional() @IsEnum(['low', 'medium', 'high'])
  probability?: string;

  @IsOptional() @IsEnum(['low', 'medium', 'high'])
  impact?: string;

  @IsOptional() @IsString()
  mitigation?: string;

  @IsOptional() @IsString()
  ownerId?: string;

  @IsOptional() @IsEnum(['technical', 'resource', 'schedule', 'budget', 'scope', 'external'])
  category?: string;
}

export class UpdateRiskDto {
  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['low', 'medium', 'high'])
  probability?: string;

  @IsOptional() @IsEnum(['low', 'medium', 'high'])
  impact?: string;

  @IsOptional() @IsString()
  mitigation?: string;

  @IsOptional() @IsString()
  ownerId?: string;

  @IsOptional() @IsEnum(['open', 'mitigated', 'occurred', 'closed'])
  status?: string;

  @IsOptional() @IsEnum(['technical', 'resource', 'schedule', 'budget', 'scope', 'external'])
  category?: string;
}

// ── Budget Update DTO ──

export class UpdateBudgetDto {
  @IsNumber()
  @Min(0)
  spent: number;
}

// ── Duplicate Project DTO ──

export class DuplicateProjectDto {
  @IsString()
  projectName: string;
}
