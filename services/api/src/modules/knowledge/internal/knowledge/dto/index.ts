import { IsString, IsOptional, IsEnum, IsArray, IsNumber, Min, Max, IsBoolean } from 'class-validator';

// ── Space DTOs ──

export class CreateSpaceDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsEnum(['public', 'restricted']) visibility?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedRoles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedTeamIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedUserIds?: string[];
}

export class UpdateSpaceDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsEnum(['public', 'restricted']) visibility?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) allowedRoles?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedTeamIds?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedUserIds?: string[];
  @IsOptional() @IsString() homepageId?: string;
  @IsOptional() @IsBoolean() isArchived?: boolean;
}

// ── Page DTOs ──

export class CreatePageDto {
  @IsString() spaceId: string;
  @IsString() title: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsEnum(['draft', 'published']) status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() templateId?: string;
}

export class UpdatePageDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsEnum(['draft', 'published', 'archived']) status?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() changeSummary?: string;
  @IsOptional() @IsString() coverImage?: string;
}

export class MovePageDto {
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsString() spaceId?: string;
}

export class PageQueryDto {
  @IsOptional() @IsString() spaceId?: string;
  @IsOptional() @IsString() parentId?: string;
  @IsOptional() @IsEnum(['draft', 'published', 'archived']) status?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ── Search DTOs ──

export class SearchQueryDto {
  @IsString() q: string;
  @IsOptional() @IsString() spaceId?: string;
  @IsOptional() @IsString() tags?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(50) limit?: number;
}

// ── Template DTOs ──

export class CreateTemplateDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['runbook', 'adr', 'meeting_notes', 'rfc', 'retrospective', 'onboarding', 'custom']) category?: string;
  @IsString() content: string;
  @IsOptional() @IsString() icon?: string;
}

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() content?: string;
  @IsOptional() @IsString() icon?: string;
}
