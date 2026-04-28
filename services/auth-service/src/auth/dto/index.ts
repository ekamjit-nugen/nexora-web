import { IsEmail, IsString, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

// SendOtpDto + VerifyOtpDto are defined further down (with @Transform
// trim/lowercase wrappers — the canonical version). Earlier duplicates
// here were leftover stubs from Bug #2 (P1) and shadowed the better ones,
// breaking `npm run build` with TS2300 duplicate-identifier errors.

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  organizationId?: string;
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

export class SendOtpDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;
}

export class VerifyOtpDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254)
  email: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'otp must be a 6-digit numeric code' })
  otp: string;
}

/*
 * When: Request payload validation
 * if: class-validator decorators are applied
 * then: validate request body against DTO rules
 */
