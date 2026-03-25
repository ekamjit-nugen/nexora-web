import { IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber, Min, Max } from 'class-validator';

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
}

export class AddCommentDto {
  @IsString()
  content: string;
}

export class LogTimeDto {
  @IsNumber()
  @Min(0.1)
  hours: number;

  @IsOptional() @IsString()
  description?: string;

  @IsDateString()
  date: string;
}

export class UpdateStatusDto {
  @IsEnum(['backlog', 'todo', 'in_progress', 'in_review', 'blocked', 'done', 'cancelled'])
  status: string;
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
}
