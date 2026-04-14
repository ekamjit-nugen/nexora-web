import { IsString, IsOptional, IsEnum, IsArray, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class CreateTicketDto {
  @IsString() title: string;
  @IsOptional() @IsString() description?: string;
  @IsEnum(['it_support', 'hr', 'finance', 'facilities', 'admin', 'other']) category: string;
  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low']) priority?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateTicketDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['critical', 'high', 'medium', 'low']) priority?: string;
  @IsOptional() @IsEnum(['open', 'assigned', 'in_progress', 'waiting_on_requester', 'resolved', 'closed', 'cancelled']) status?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() assigneeName?: string;
  @IsOptional() @IsString() teamId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class TicketQueryDto {
  @IsOptional() @IsEnum(['open', 'assigned', 'in_progress', 'waiting_on_requester', 'resolved', 'closed', 'cancelled']) status?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() requesterId?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() slaBreached?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
  @IsOptional() @IsString() sortBy?: string;
}

export class CreateCommentDto {
  @IsString() content: string;
  @IsOptional() @IsBoolean() isInternal?: boolean;
}

export class AssignTicketDto {
  @IsString() assigneeId: string;
  @IsOptional() @IsString() assigneeName?: string;
}

export class RateTicketDto {
  @IsNumber() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() ratingComment?: string;
}

export class CreateTeamDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() members?: Array<{ userId: string; name: string; role: string }>;
  @IsOptional() slaPolicy?: any;
  @IsOptional() workingHours?: any;
  @IsOptional() @IsBoolean() autoAssign?: boolean;
}

export class UpdateTeamDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsArray() members?: Array<{ userId: string; name: string; role: string }>;
  @IsOptional() slaPolicy?: any;
  @IsOptional() workingHours?: any;
  @IsOptional() @IsBoolean() autoAssign?: boolean;
}
