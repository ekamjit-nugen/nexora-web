import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AutomationConditionDto {
  @IsString()
  field: string;

  @IsEnum([
    'equals',
    'not_equals',
    'contains',
    'greater_than',
    'less_than',
    'in',
    'is_empty',
    'is_not_empty',
  ])
  operator: string;

  @IsOptional()
  value?: any;
}

export class AutomationTriggerDto {
  @IsEnum([
    'task_created',
    'task_updated',
    'status_changed',
    'assignee_changed',
    'priority_changed',
    'due_date_approaching',
    'comment_added',
    'field_changed',
  ])
  event: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AutomationConditionDto)
  conditions?: AutomationConditionDto[];
}

export class AutomationActionDto {
  @IsEnum([
    'change_status',
    'assign_to',
    'set_priority',
    'add_label',
    'remove_label',
    'add_comment',
    'send_notification',
    'create_subtask',
    'set_due_date',
    'set_field',
  ])
  type: string;

  @IsOptional()
  params?: any;
}

export class CreateAutomationRuleDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @ValidateNested() @Type(() => AutomationTriggerDto)
  trigger: AutomationTriggerDto;

  @IsArray() @ValidateNested({ each: true }) @Type(() => AutomationActionDto)
  actions: AutomationActionDto[];
}

export class UpdateAutomationRuleDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional() @ValidateNested() @Type(() => AutomationTriggerDto)
  trigger?: AutomationTriggerDto;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AutomationActionDto)
  actions?: AutomationActionDto[];
}
