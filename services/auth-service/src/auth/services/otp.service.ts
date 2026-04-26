import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import * as nodemailer from 'nodemailer';
import { IUser } from '../schemas/user.schema';
import { AuditService } from '../audit.service';
import { AuditAction } from '../../common/constants/audit-events';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private readonly OTP_MAX_ATTEMPTS = 5;
  private readonly OTP_LOCKOUT_MINUTES = 15;
  private readonly OTP_RATE_LIMIT_PER_HOUR = 5;
  private readonly OTP_RESEND_COOLDOWN_SECONDS = 30;
  private readonly mailTransporter: nodemailer.Transporter;

  constructor(
    @InjectModel('User') private userModel: Model<IUser>,
    private auditService: AuditService,
  ) {
    this.mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'mailhog',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      ignoreTLS: true,
    });
  }

  private async sendOtpEmail(email: string, otp: string): Promise<void> {
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:'Inter',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:#2E86C1;padding:28px 40px;text-align:center;">
            <span style="display:inline-block;width:44px;height:44px;line-height:44px;background:rgba(255,255,255,0.2);border-radius:10px;font-size:22px;font-weight:700;color:#FFFFFF;">N</span>
            <div style="color:#FFFFFF;font-size:20px;font-weight:600;margin-top:8px;">Nexora</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 24px;">
            <h1 style="margin:0 0 12px;font-size:22px;font-weight:600;color:#111827;">Your verification code</h1>
            <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#4B5563;">
              Use this code to sign in to your Nexora account. It expires in 10 minutes.
            </p>
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:#F8FAFC;border:2px dashed #2E86C1;border-radius:12px;padding:16px 40px;">
                <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0F172A;font-family:monospace;">${otp}</span>
              </div>
            </div>
            <p style="margin:0;font-size:13px;line-height:1.5;color:#9CA3AF;">
              If you didn&rsquo;t request this code, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; ${new Date().getFullYear()} Nexora. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await this.mailTransporter.sendMail({
        from: '"Nexora" <no-reply@nexora.io>',
        to: email,
        subject: `${otp} — Your Nexora verification code`,
        html,
      });
      this.logger.log(`OTP email sent to ${email} via MailHog`);
    } catch (err) {
      this.logger.warn(`Failed to send OTP email to ${email}: ${err.message || err}`);
    }
  }

  async sendOtp(email: string, ipAddress?: string): Promise<{ sent: boolean; isNewUser: boolean }> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    let user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +otpAttempts +otpLastRequestedAt +otpRequestCount');
    const isNewUser = !user;

    if (user) {
      // Rate limiting: max 5 OTP requests per hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (user.otpLastRequestedAt && user.otpLastRequestedAt > oneHourAgo && (user.otpRequestCount || 0) >= this.OTP_RATE_LIMIT_PER_HOUR) {
        throw new HttpException(
          { success: false, error: { code: 'RATE_LIMIT_OTP', message: 'Too many OTP requests. Please try again later.' } },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Resend cooldown
      if (user.otpLastRequestedAt) {
        const secondsSinceLastRequest = (Date.now() - user.otpLastRequestedAt.getTime()) / 1000;
        if (secondsSinceLastRequest < this.OTP_RESEND_COOLDOWN_SECONDS) {
          throw new HttpException(
            { success: false, error: { code: 'OTP_COOLDOWN', message: `Please wait ${Math.ceil(this.OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastRequest)} seconds before requesting a new OTP.` } },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }

      // Reset hourly counter if needed
      if (!user.otpLastRequestedAt || user.otpLastRequestedAt < oneHourAgo) {
        user.otpRequestCount = 0;
      }

      // Store OTP as a hash to prevent plaintext exposure
      user.otp = crypto.createHash('sha256').update(otp).digest('hex');
      user.otpExpiresAt = otpExpiresAt;
      user.otpAttempts = 0;
      user.otpLastRequestedAt = new Date();
      user.otpRequestCount = (user.otpRequestCount || 0) + 1;
      await user.save();
    } else {
      user = new this.userModel({
        email: email.toLowerCase(),
        // No password for OTP-only users — field is optional in schema
        firstName: 'Pending',
        lastName: 'User',
        otp: crypto.createHash('sha256').update(otp).digest('hex'),
        otpExpiresAt,
        otpAttempts: 0,
        otpLastRequestedAt: new Date(),
        otpRequestCount: 1,
        isActive: false,
        setupStage: 'otp_verified',
      });
      await user.save();
    }

    this.logger.debug(`OTP sent for ${email}`);

    // Send OTP via email (MailHog in dev)
    await this.sendOtpEmail(email, otp);

    await this.auditService.log({
      action: AuditAction.OTP_REQUESTED,
      userId: user._id.toString(),
      resource: 'user',
      resourceId: user._id.toString(),
      ipAddress,
    });

    return { sent: true, isNewUser };
  }

  async verifyOtp(email: string, otp: string, ipAddress?: string): Promise<{
    verified: boolean;
    user: IUser;
    isNewUser: boolean;
  }> {
    const user = await this.userModel.findOne({ email: email.toLowerCase() }).select('+otp +otpExpiresAt +otpAttempts');

    // Bug #5 (P3): previously returned `404 USER_NOT_FOUND`, which let an
    // attacker enumerate accounts by diffing 404 vs 400. Collapse to the same
    // generic `INVALID_OTP` response the invalid-code branch uses so the
    // existence of the user cannot be inferred from the response.
    if (!user) throw new HttpException(
      { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.' } },
      HttpStatus.BAD_REQUEST,
    );

    // Check lockout
    if (user.lockUntil && user.lockUntil > new Date()) {
      const minutesLeft = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
      throw new HttpException(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: `Too many attempts. Please try again in ${minutesLeft} minutes.`, lockoutMinutes: minutesLeft } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (user.otpAttempts >= this.OTP_MAX_ATTEMPTS) {
      // Lock the account
      user.lockUntil = new Date(Date.now() + this.OTP_LOCKOUT_MINUTES * 60 * 1000);
      await user.save();

      await this.auditService.log({
        action: AuditAction.ACCOUNT_LOCKED,
        userId: user._id.toString(),
        resource: 'user',
        resourceId: user._id.toString(),
        ipAddress,
      });

      throw new HttpException(
        { success: false, error: { code: 'ACCOUNT_LOCKED', message: `Too many attempts. Please try again in ${this.OTP_LOCKOUT_MINUTES} minutes.`, lockoutMinutes: this.OTP_LOCKOUT_MINUTES } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (!user.otp || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new HttpException(
        { success: false, error: { code: 'OTP_EXPIRED', message: 'OTP has expired. Please request a new one.' } },
        HttpStatus.BAD_REQUEST,
      );
    }

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const storedHash = user.otp || '';
    const isOtpValid = storedHash.length === otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(storedHash));

    if (!isOtpValid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();

      await this.auditService.log({
        action: AuditAction.OTP_FAILED,
        userId: user._id.toString(),
        resource: 'user',
        resourceId: user._id.toString(),
        details: { attemptsRemaining: this.OTP_MAX_ATTEMPTS - user.otpAttempts },
        ipAddress,
      });

      throw new HttpException(
        { success: false, error: { code: 'INVALID_OTP', message: 'Invalid OTP. Please try again.', attemptsRemaining: this.OTP_MAX_ATTEMPTS - user.otpAttempts } },
        HttpStatus.BAD_REQUEST,
      );
    }

    // OTP verified — clear it
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;
    user.lockUntil = null;

    const isNewUser = !user.isActive;
    if (isNewUser && user.setupStage === 'otp_verified') {
      user.isActive = true;
    }

    // Auto-activate invited users
    if (user.setupStage === 'invited') {
      user.isActive = true;
    }

    user.lastLogin = new Date();
    await user.save();

    await this.auditService.log({
      action: AuditAction.OTP_VERIFIED,
      userId: user._id.toString(),
      resource: 'user',
      resourceId: user._id.toString(),
      ipAddress,
    });

    return { verified: true, user, isNewUser };
  }
}
