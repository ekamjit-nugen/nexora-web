import { IsString, IsOptional, IsEnum, IsEmail, IsNumber, IsBoolean, IsIn } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  financialYearStart?: number;
}

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  currency?: string;

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
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  department?: string;
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

const VALID_ORG_ROLES = ['owner', 'admin', 'hr', 'manager', 'developer', 'designer', 'employee', 'member', 'viewer'];

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(VALID_ORG_ROLES, { message: `Role must be one of: ${VALID_ORG_ROLES.join(', ')}` })
  role: string;
}
