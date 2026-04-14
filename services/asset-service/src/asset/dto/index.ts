import {
  IsString, IsOptional, IsEnum, IsDateString, IsArray, IsNumber,
  Min, Max, IsBoolean, ValidateNested, IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Category DTOs ──

export class CustomFieldDefDto {
  @IsString() fieldName: string;
  @IsEnum(['text', 'number', 'date', 'select', 'boolean']) fieldType: string;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
}

export class CreateAssetCategoryDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustomFieldDefDto)
  customFields?: CustomFieldDefDto[];
  @IsOptional() @IsEnum(['straight_line', 'declining_balance', 'none']) depreciationMethod?: string;
  @IsOptional() @IsNumber() @Min(1) defaultUsefulLifeYears?: number;
}

export class UpdateAssetCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CustomFieldDefDto)
  customFields?: CustomFieldDefDto[];
  @IsOptional() @IsEnum(['straight_line', 'declining_balance', 'none']) depreciationMethod?: string;
  @IsOptional() @IsNumber() @Min(1) defaultUsefulLifeYears?: number;
}

// ── Asset DTOs ──

export class CreateAssetDto {
  @IsString() name: string;
  @IsString() categoryId: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['new', 'good', 'fair', 'poor', 'damaged']) condition?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsNumber() purchasePrice?: number;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsString() invoiceNumber?: string;
  @IsOptional() @IsDateString() warrantyStartDate?: string;
  @IsOptional() @IsDateString() warrantyEndDate?: string;
  @IsOptional() @IsString() warrantyProvider?: string;
  @IsOptional() @IsString() warrantyNotes?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() building?: string;
  @IsOptional() @IsString() floor?: string;
  @IsOptional() @IsEnum(['straight_line', 'declining_balance', 'none']) depreciationMethod?: string;
  @IsOptional() @IsNumber() @Min(1) usefulLifeYears?: number;
  @IsOptional() @IsNumber() salvageValue?: number;
  @IsOptional() @IsObject() customFieldValues?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class UpdateAssetDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(['available', 'assigned', 'maintenance', 'retired', 'lost', 'disposed']) status?: string;
  @IsOptional() @IsEnum(['new', 'good', 'fair', 'poor', 'damaged']) condition?: string;
  @IsOptional() @IsDateString() purchaseDate?: string;
  @IsOptional() @IsNumber() purchasePrice?: number;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsDateString() warrantyEndDate?: string;
  @IsOptional() @IsString() warrantyProvider?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsObject() customFieldValues?: Record<string, any>;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
  @IsOptional() @IsString() notes?: string;
}

export class AssetQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(['available', 'assigned', 'maintenance', 'retired', 'lost', 'disposed']) status?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: string;
  @IsOptional() @IsNumber() @Min(1) page?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(100) limit?: number;
}

// ── Assignment DTOs ──

export class AssignAssetDto {
  @IsString() assetId: string;
  @IsString() assigneeId: string;
  @IsOptional() @IsEnum(['employee', 'department', 'shared_pool']) assigneeType?: string;
  @IsOptional() @IsDateString() expectedReturnDate?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UnassignAssetDto {
  @IsString() assetId: string;
  @IsOptional() @IsEnum(['new', 'good', 'fair', 'poor', 'damaged']) conditionAtReturn?: string;
  @IsOptional() @IsString() notes?: string;
}

export class TransferAssetDto {
  @IsString() assetId: string;
  @IsString() fromAssigneeId: string;
  @IsString() toAssigneeId: string;
  @IsOptional() @IsString() notes?: string;
}

export class BulkAssignDto {
  @IsArray() @IsString({ each: true }) assetIds: string[];
  @IsString() assigneeId: string;
  @IsOptional() @IsString() notes?: string;
}

export class BulkUnassignDto {
  @IsArray() @IsString({ each: true }) assetIds: string[];
  @IsOptional() @IsString() notes?: string;
}

// ── Maintenance DTOs ──

export class CreateMaintenanceDto {
  @IsString() assetId: string;
  @IsEnum(['repair', 'upgrade', 'inspection', 'cleaning', 'software_update', 'replacement_part']) type: string;
  @IsString() description: string;
  @IsOptional() @IsString() vendor?: string;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsDateString() scheduledDate?: string;
}

export class UpdateMaintenanceDto {
  @IsOptional() @IsEnum(['scheduled', 'in_progress', 'completed', 'cancelled']) status?: string;
  @IsOptional() @IsDateString() completionDate?: string;
  @IsOptional() @IsNumber() cost?: number;
  @IsOptional() @IsString() notes?: string;
}
