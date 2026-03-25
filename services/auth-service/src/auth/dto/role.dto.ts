import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
  MinLength,
  Matches,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

const VALID_RESOURCES = [
  'employees',
  'attendance',
  'leaves',
  'projects',
  'tasks',
  'departments',
  'roles',
  'policies',
  'reports',
];

const VALID_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'assign'];

class PermissionDto {
  @IsString()
  @IsIn(VALID_RESOURCES)
  resource: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  actions: string[];
}

export class CreateRoleDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  displayName: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  permissions: PermissionDto[];

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g. #4F46E5)' })
  color?: string;

  @IsBoolean()
  @IsOptional()
  isSystem?: boolean;
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  displayName?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionDto)
  @IsOptional()
  permissions?: PermissionDto[];

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Color must be a valid hex color (e.g. #4F46E5)' })
  color?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class AssignRolesDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  roles: string[];
}

/*
 * When: Role CRUD or assignment request
 * if: class-validator decorators are applied
 * then: validate request body against DTO rules
 */
