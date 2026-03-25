import { IsString, IsOptional, IsEnum, IsEmail, IsNumber, IsBoolean } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(['it_company', 'agency', 'startup', 'enterprise', 'nonprofit', 'education', 'healthcare', 'finance', 'other'])
  industry?: string;

  @IsOptional()
  @IsEnum(['1-10', '11-50', '51-200', '201-500', '500+'])
  size?: string;

  @IsOptional()
  @IsString()
  domain?: string;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['it_company', 'agency', 'startup', 'enterprise', 'nonprofit', 'education', 'healthcare', 'finance', 'other'])
  industry?: string;

  @IsOptional()
  @IsEnum(['1-10', '11-50', '51-200', '201-500', '500+'])
  size?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsEnum(['free', 'starter', 'professional', 'enterprise'])
  plan?: string;

  @IsOptional()
  settings?: {
    timezone?: string;
    currency?: string;
    dateFormat?: string;
  };
}

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsEnum(['admin', 'manager', 'member', 'viewer'])
  role?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
}

export class SwitchOrgDto {
  @IsString()
  organizationId: string;
}

export class UpdateOnboardingDto {
  @IsNumber()
  step: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
