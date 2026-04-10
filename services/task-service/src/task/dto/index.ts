import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, IsBoolean, Min, Max } from 'class-validator';

// ── Task DTOs ──

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsString()
  projectId: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsEnum(['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'])
  type?: string;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low', 'trivial'])
  priority?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsNumber()
  storyPoints?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  labels?: string[];

  @IsOptional() @IsNumber()
  estimatedHours?: number;

  @IsOptional()
  @IsEnum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'])
  status?: string;

  @IsOptional() @IsString()
  boardId?: string;

  @IsOptional() @IsString()
  columnId?: string;

  @IsOptional() @IsString()
  sprintId?: string;

  @IsOptional() @IsString()
  projectKey?: string;

  @IsOptional() @IsString()
  resolution?: string;

  @IsOptional() @IsBoolean()
  isFlagged?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  watchers?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  components?: string[];

  @IsOptional() @IsString()
  fixVersion?: string;

  @IsOptional() @IsString()
  environment?: string;

  @IsOptional() @IsNumber()
  originalEstimate?: number;

  @IsOptional() @IsNumber()
  remainingEstimate?: number;

  @IsOptional()
  customFields?: Record<string, unknown>;
}

export class UpdateTaskDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsEnum(['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'])
  type?: string;

  @IsOptional()
  @IsEnum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low', 'trivial'])
  priority?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsDateString()
  dueDate?: string;

  @IsOptional() @IsNumber()
  storyPoints?: number;

  @IsOptional() @IsArray() @IsString({ each: true })
  labels?: string[];

  @IsOptional() @IsNumber()
  estimatedHours?: number;

  @IsOptional() @IsString()
  sprintId?: string | null;

  @IsOptional() @IsString()
  columnId?: string;

  @IsOptional() @IsString()
  boardId?: string;

  @IsOptional() @IsString()
  resolution?: string;

  @IsOptional() @IsBoolean()
  isFlagged?: boolean;

  @IsOptional() @IsArray() @IsString({ each: true })
  components?: string[];

  @IsOptional() @IsString()
  fixVersion?: string;

  @IsOptional() @IsString()
  environment?: string;

  @IsOptional() @IsNumber()
  originalEstimate?: number;

  @IsOptional() @IsNumber()
  remainingEstimate?: number;

  @IsOptional()
  customFields?: Record<string, unknown>;
}

export class AddCommentDto {
  @IsString()
  content: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  mentionedUserIds?: string[];
}

export class LogTimeDto {
  @IsNumber()
  @Min(0.25)
  hours: number;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['development', 'design', 'meeting', 'review', 'testing', 'documentation', 'admin', 'training', 'other'])
  category?: string;
}

export class UpdateStatusDto {
  @IsEnum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'])
  status: string;

  @IsOptional()
  @IsEnum(['done', 'wont_do', 'duplicate', 'cannot_reproduce', 'incomplete'])
  resolution?: string;
}

export class TaskQueryDto {
  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsEnum(['critical', 'high', 'medium', 'low', 'trivial'])
  priority?: string;

  @IsOptional()
  @IsEnum(['epic', 'story', 'task', 'sub_task', 'bug', 'improvement', 'spike'])
  type?: string;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(100)
  limit?: number;

  @IsOptional() @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  sprintId?: string;

  @IsOptional()
  @IsString()
  boardId?: string;

  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @IsString()
  parentTaskId?: string;

  @IsOptional()
  @IsString()
  labels?: string;
}

export class SetRecurrenceDto {
  @IsEnum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'custom'])
  frequency: string;

  @IsOptional() @IsNumber()
  interval?: number;

  @IsOptional() @IsArray() @IsNumber({}, { each: true })
  daysOfWeek?: number[];

  @IsOptional() @IsNumber()
  dayOfMonth?: number;

  @IsOptional() @IsDateString()
  endDate?: string;

  @IsOptional() @IsNumber()
  maxOccurrences?: number;

  @IsOptional() @IsString()
  rule?: string;
}

export class BulkUpdateDto {
  @IsArray()
  @IsString({ each: true })
  taskIds: string[];

  @IsOptional() @IsString()
  assigneeId?: string;

  @IsOptional() @IsString()
  priority?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  sprintId?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  addLabels?: string[];

  @IsOptional() @IsArray() @IsString({ each: true })
  removeLabels?: string[];
}
