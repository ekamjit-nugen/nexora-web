import {
  IsString, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean,
  Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Sub-DTOs ──

export class TemplateSettingsDto {
  @IsOptional() @IsEnum(['scrum', 'kanban', 'custom'])
  boardType?: string;

  @IsOptional() @IsNumber() @Min(1) @Max(90)
  sprintDuration?: number;

  @IsOptional() @IsEnum(['hours', 'story_points'])
  estimationUnit?: string;

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

export class MilestoneTemplateDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  phase?: string;

  @IsOptional() @IsNumber()
  offsetDays?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  deliverables?: string[];
}

export class TaskTemplateDto {
  @IsString()
  title: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsEnum(['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'])
  type?: string;

  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low', 'trivial'])
  priority?: string;

  @IsOptional() @IsNumber()
  storyPoints?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  labels?: string[];

  @IsOptional() @IsNumber()
  milestoneIndex?: number;
}

export class BoardColumnDto {
  @IsString()
  name: string;

  @IsString()
  statusMapping: string;

  @IsOptional() @IsNumber()
  wipLimit?: number;

  @IsOptional() @IsNumber()
  order?: number;
}

export class TeamRoleDto {
  @IsString()
  role: string;

  @IsOptional() @IsNumber() @Min(1)
  count?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  skills?: string[];
}

// ── Main DTOs ──

export class CreateProjectTemplateDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsEnum(['scrum', 'kanban', 'scrumban', 'waterfall', 'xp', 'lean', 'safe', 'custom'])
  methodology?: string;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @ValidateNested() @Type(() => TemplateSettingsDto)
  defaultSettings?: TemplateSettingsDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MilestoneTemplateDto)
  milestoneTemplates?: MilestoneTemplateDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TaskTemplateDto)
  taskTemplates?: TaskTemplateDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BoardColumnDto)
  boardColumns?: BoardColumnDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TeamRoleDto)
  teamRoles?: TeamRoleDto[];
}

export class UpdateProjectTemplateDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsEnum(['scrum', 'kanban', 'scrumban', 'waterfall', 'xp', 'lean', 'safe', 'custom'])
  methodology?: string;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;

  @IsOptional() @ValidateNested() @Type(() => TemplateSettingsDto)
  defaultSettings?: TemplateSettingsDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MilestoneTemplateDto)
  milestoneTemplates?: MilestoneTemplateDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TaskTemplateDto)
  taskTemplates?: TaskTemplateDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BoardColumnDto)
  boardColumns?: BoardColumnDto[];

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => TeamRoleDto)
  teamRoles?: TeamRoleDto[];
}

export class SaveAsTemplateDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  isPublic?: boolean;
}

export class ApplyTemplateDto {
  @IsString()
  projectName: string;

  @IsOptional() @IsString()
  projectKey?: string;

  @IsOptional() @IsString()
  startDate?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  category?: string;

  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low'])
  priority?: string;
}
