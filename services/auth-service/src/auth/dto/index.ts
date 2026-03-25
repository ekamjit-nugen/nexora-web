import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  rememberMe?: boolean;
}

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must contain uppercase, lowercase, numbers, and special characters',
    },
  )
  password: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class MFASetupDto {
  @IsString()
  userId: string;
}

export class MFAVerifyDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  @Matches(/^\d{6}$/, {
    message: 'Code must be a 6-digit number',
  })
  code: string;

  rememberThisDevice?: boolean;
}

export class OAuthCallbackDto {
  @IsString()
  code: string;

  @IsString()
  state?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) firstName?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(50) lastName?: string;
  @IsOptional() @IsString() avatar?: string;
  @IsOptional() @IsString() phoneNumber?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(8) currentPassword: string;
  @IsString() @MinLength(8) @MaxLength(128) @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message: 'Password must contain uppercase, lowercase, numbers, and special characters',
  }) newPassword: string;
}

/*
 * When: Request payload validation
 * if: class-validator decorators are applied
 * then: validate request body against DTO rules
 */
