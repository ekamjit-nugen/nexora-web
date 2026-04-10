import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CustomFieldOptionDto {
  @IsString()
  value: string;

  @IsString()
  label: string;

  @IsOptional() @IsString()
  color?: string;
}

export class CustomFieldValidationDto {
  @IsOptional() @IsNumber()
  min?: number;

  @IsOptional() @IsNumber()
  max?: number;

  @IsOptional() @IsNumber()
  minLength?: number;

  @IsOptional() @IsNumber()
  maxLength?: number;

  @IsOptional() @IsString()
  pattern?: string;
}

export class CreateCustomFieldDto {
  @IsString()
  name: string;

  @IsString()
  key: string;

  @IsEnum([
    'text',
    'number',
    'date',
    'dropdown',
    'multi_select',
    'checkbox',
    'url',
    'user',
    'currency',
    'percentage',
  ])
  type: string;

  @IsOptional() @IsString()
  projectId?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: any;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];

  @IsOptional() @ValidateNested() @Type(() => CustomFieldValidationDto)
  validation?: CustomFieldValidationDto;

  @IsOptional() @IsEnum(['all', 'project_specific', 'task_type'])
  appliesTo?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  taskTypes?: string[];

  @IsOptional() @IsNumber()
  displayOrder?: number;

  @IsOptional() @IsBoolean()
  showInList?: boolean;

  @IsOptional() @IsBoolean()
  showInDetail?: boolean;
}

export class UpdateCustomFieldDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: any;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustomFieldOptionDto)
  options?: CustomFieldOptionDto[];

  @IsOptional() @ValidateNested() @Type(() => CustomFieldValidationDto)
  validation?: CustomFieldValidationDto;

  @IsOptional() @IsEnum(['all', 'project_specific', 'task_type'])
  appliesTo?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  taskTypes?: string[];

  @IsOptional() @IsNumber()
  displayOrder?: number;

  @IsOptional() @IsBoolean()
  showInList?: boolean;

  @IsOptional() @IsBoolean()
  showInDetail?: boolean;
}
