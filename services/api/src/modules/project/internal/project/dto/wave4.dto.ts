import { IsString, IsOptional, IsNumber, IsDateString, IsEnum, IsArray, IsBoolean, ValidateNested, IsEmail, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

// ── Time Tracking DTOs ──

export class CreateTimeLogDto {
  @IsString()
  taskId: string;

  @IsNumber()
  @Min(1)
  duration: number; // in minutes

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number; // hourly rate in dollars
}

export class UpdateTimeLogDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  rate?: number;
}

export class TimeLogResponseDto {
  _id: string;
  projectId: string;
  taskId: string;
  userId: string;
  duration: number;
  description: string;
  date: Date;
  billable: boolean;
  rate?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class TimesheetQueryDto {
  @IsString()
  userId: string;

  @IsDateString()
  weekStart: string;
}

export class SubmitTimesheetDto {
  @IsString()
  userId: string;

  @IsDateString()
  weekStart: string;
}

export class ApproveTimesheetDto {
  @IsString()
  userId: string;

  @IsDateString()
  weekStart: string;

  @IsString()
  approvedBy: string;
}

export class RejectTimesheetDto {
  @IsString()
  userId: string;

  @IsDateString()
  weekStart: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

// ── Client Feedback DTOs ──

export class SubmitClientFeedbackDto {
  @IsString()
  clientId: string;

  @IsString()
  clientName: string;

  @IsEmail()
  clientEmail: string;

  @IsEnum(['bug', 'feature', 'question', 'general'])
  type: 'bug' | 'feature' | 'question' | 'general';

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class AttachmentDto {
  @IsString()
  url: string;

  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsNumber()
  size: number;
}

export class UpdateFeedbackStatusDto {
  @IsEnum(['new', 'reviewed', 'in_progress', 'completed', 'closed'])
  status: 'new' | 'reviewed' | 'in_progress' | 'completed' | 'closed';
}

export class LinkFeedbackToTaskDto {
  @IsString()
  taskKey: string;
}

export class ClientFeedbackQueryDto {
  @IsOptional()
  @IsEnum(['new', 'reviewed', 'in_progress', 'completed', 'closed'])
  status?: string;

  @IsOptional()
  @IsEnum(['bug', 'feature', 'question', 'general'])
  type?: string;

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;
}

export class ClientFeedbackResponseDto {
  _id: string;
  projectId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  attachments?: any[];
  taskKey?: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Reporting DTOs ──

export class ReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(['csv', 'pdf', 'xlsx'])
  format?: 'csv' | 'pdf' | 'xlsx';
}

export class CumulativeFlowDto {
  dates: string[];
  columns: Array<{
    name: string;
    color: string;
    counts: number[];
  }>;
}

export class CycleTimeDto {
  tasks: Array<{
    key: string;
    title: string;
    completedDate: Date;
    cycleTimeDays: number;
  }>;
  avgCycleTime: number;
  medianCycleTime: number;
  p90CycleTime: number;
}

export class EpicProgressDto {
  epics: Array<{
    id: string;
    key: string;
    title: string;
    status: string;
    completedStories: number;
    totalStories: number;
    completedPoints: number;
    totalPoints: number;
    startDate: Date;
    targetDate: Date;
    projectedCompletion: Date;
    stories: Array<{
      id: string;
      key: string;
      title: string;
      status: string;
      points: number;
    }>;
  }>;
}

export class BillingReportDto {
  projectId?: string;
  userId?: string;
  totalHours: number;
  billableHours: number;
  totalCost: number;
  byUser?: Array<{
    userId: string;
    hours: number;
    cost: number;
  }>;
  byTask?: Array<{
    taskId: string;
    key: string;
    title: string;
    estimatedHours: number;
    loggedHours: number;
    variance: number;
  }>;
}

export class FeedbackStatsDto {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

// ── Asset Preview DTOs ──

export class UploadAssetDto {
  @IsString()
  taskId: string;

  @IsString()
  url: string;

  @IsString()
  name: string;

  @IsEnum(['image', 'video', 'figma', 'document', 'other'])
  type: 'image' | 'video' | 'figma' | 'document' | 'other';

  @IsNumber()
  size: number;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsNumber()
  width?: number;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsNumber()
  duration?: number; // for videos, in seconds
}

export class AssetPreviewResponseDto {
  _id: string;
  projectId: string;
  taskId: string;
  url: string;
  name: string;
  type: string;
  size: number;
  uploadedBy: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  format?: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}
