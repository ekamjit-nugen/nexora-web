import { IsString, IsBoolean, IsEnum, IsNumber, IsOptional, IsArray, Min } from 'class-validator';

export class CreateDlpRuleDto {
  @IsString()
  name: string;

  @IsString()
  pattern: string;

  @IsEnum(['block', 'warn', 'redact', 'flag'])
  action: 'block' | 'warn' | 'redact' | 'flag';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class CreateRetentionPolicyDto {
  @IsNumber()
  @Min(1)
  retentionDays: number;

  @IsEnum(['org', 'specific'])
  scope: 'org' | 'specific';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conversationIds?: string[];
}

export class CreateLegalHoldDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(['org', 'conversation', 'user'])
  scope: 'org' | 'conversation' | 'user';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetConversationIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetUserIds?: string[];
}
