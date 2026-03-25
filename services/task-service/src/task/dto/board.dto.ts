import {
  IsString, IsOptional, IsEnum, IsArray, IsNumber,
  IsDateString, ValidateNested, Min, IsBoolean, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Subdocument DTOs ──

export class SwimlaneConfigDto {
  @IsOptional() @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(['assignee', 'priority', 'type', 'label', 'epic', 'sprint', 'none'])
  groupBy?: string;

  @IsOptional() @IsBoolean()
  showEmpty?: boolean;

  @IsOptional() @IsString()
  sortOrder?: string;

  @IsOptional() @IsString()
  defaultLane?: string;
}

export class CardLayoutDto {
  @IsOptional() @IsBoolean()
  showTaskKey?: boolean;

  @IsOptional() @IsBoolean()
  showAvatar?: boolean;

  @IsOptional() @IsBoolean()
  showPriority?: boolean;

  @IsOptional() @IsBoolean()
  showLabels?: boolean;

  @IsOptional() @IsBoolean()
  showEstimate?: boolean;

  @IsOptional() @IsBoolean()
  showDueDate?: boolean;

  @IsOptional() @IsBoolean()
  showSubtasks?: boolean;

  @IsOptional() @IsBoolean()
  showProgress?: boolean;

  @IsOptional() @IsBoolean()
  showCommentCount?: boolean;

  @IsOptional() @IsBoolean()
  showTypeIndicator?: boolean;

  @IsOptional() @IsBoolean()
  compactMode?: boolean;
}

// ── Board DTOs ──

export class ColumnDto {
  @IsString()
  name: string;

  @IsOptional() @IsNumber()
  order?: number;

  @IsOptional() @IsNumber() @Min(0)
  wipLimit?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  statusMapping?: string[];

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  key?: string;

  @IsOptional() @IsBoolean()
  isDoneColumn?: boolean;

  @IsOptional() @IsBoolean()
  isStartColumn?: boolean;
}

export class CreateBoardDto {
  @IsString()
  name: string;

  @IsString()
  projectId: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsEnum(['scrum', 'kanban', 'bug_tracker', 'custom'])
  type?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  icon?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnDto)
  columns?: ColumnDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SwimlaneConfigDto)
  swimlaneConfig?: SwimlaneConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CardLayoutDto)
  cardLayout?: CardLayoutDto;

  @IsOptional() @IsArray() @IsString({ each: true })
  quickFilters?: string[];
}

export class UpdateBoardDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString() @MaxLength(500)
  description?: string;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsString()
  icon?: string;

  @IsOptional()
  @IsEnum(['none', 'assignee', 'priority', 'type'])
  swimlaneBy?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SwimlaneConfigDto)
  swimlaneConfig?: SwimlaneConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CardLayoutDto)
  cardLayout?: CardLayoutDto;

  @IsOptional() @IsArray() @IsString({ each: true })
  quickFilters?: string[];

  @IsOptional() @IsBoolean()
  isArchived?: boolean;
}

export class AddColumnDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  key?: string;

  @IsOptional() @IsNumber() @Min(0)
  wipLimit?: number;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  statusMapping?: string[];

  @IsOptional() @IsString()
  afterColumnId?: string;

  @IsOptional() @IsBoolean()
  isDoneColumn?: boolean;

  @IsOptional() @IsBoolean()
  isStartColumn?: boolean;
}

export class UpdateColumnDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  key?: string;

  @IsOptional() @IsNumber() @Min(0)
  wipLimit?: number;

  @IsOptional() @IsString()
  color?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  statusMapping?: string[];

  @IsOptional() @IsBoolean()
  isCollapsed?: boolean;

  @IsOptional() @IsBoolean()
  isDoneColumn?: boolean;

  @IsOptional() @IsBoolean()
  isStartColumn?: boolean;
}

export class ReorderColumnsDto {
  @IsArray() @IsString({ each: true })
  columnIds: string[];
}

export class MoveTaskDto {
  @IsString()
  taskId: string;

  @IsString()
  fromColumnId: string;

  @IsString()
  toColumnId: string;

  @IsOptional() @IsNumber()
  newIndex?: number;
}

export class CreateFromTemplateDto {
  @IsString()
  projectId: string;

  @IsEnum(['scrum', 'kanban', 'bug_tracker', 'custom'])
  type: string;
}

// ── Sprint DTOs ──

export class CreateSprintDto {
  @IsString()
  name: string;

  @IsString()
  boardId: string;

  @IsString()
  projectId: string;

  @IsOptional() @IsString()
  goal?: string;

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;
}

export class UpdateSprintDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  goal?: string;

  @IsOptional() @IsDateString()
  endDate?: string;
}

export class CompleteSprintDto {
  @IsEnum(['backlog', 'next_sprint'])
  moveUnfinishedTo: string;
}

export class AddTasksToSprintDto {
  @IsArray() @IsString({ each: true })
  taskIds: string[];
}
