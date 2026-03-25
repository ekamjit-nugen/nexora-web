import {
  IsString, IsOptional, IsNumber, IsArray,
  IsDateString, IsEnum, IsIn, ValidateNested, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TimesheetEntryDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsOptional()
  taskId?: string;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  projectName?: string;

  @IsString()
  @IsOptional()
  taskTitle?: string;

  @IsNumber()
  @Min(0)
  @Max(24)
  hours: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  @IsIn(['development', 'design', 'meeting', 'review', 'testing', 'documentation', 'admin', 'training', 'other'])
  category?: string;
}

export class CreateTimesheetDto {
  @IsString()
  @IsEnum(['daily', 'weekly', 'monthly'])
  period: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetEntryDto)
  @IsOptional()
  entries?: TimesheetEntryDto[];
}

export class UpdateTimesheetDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimesheetEntryDto)
  @IsOptional()
  entries?: TimesheetEntryDto[];

  @IsNumber()
  @IsOptional()
  expectedHours?: number;
}

export class ReviewTimesheetDto {
  @IsString()
  @IsIn(['approved', 'rejected', 'revision_requested'])
  status: string;

  @IsString()
  @IsOptional()
  reviewComment?: string;
}

export class TimesheetQueryDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  period?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  limit?: number;
}
