import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAuditLog } from './schemas/audit-log.schema';

export enum AuditAction {
  OTP_REQUESTED = 'OTP_REQUESTED',
  OTP_VERIFIED = 'OTP_VERIFIED',
  OTP_FAILED = 'OTP_FAILED',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  USER_CREATED = 'USER_CREATED',
  PROFILE_UPDATED = 'PROFILE_UPDATED',
  EMAIL_CHANGED = 'EMAIL_CHANGED',
  ACCOUNT_DELETION_REQUESTED = 'ACCOUNT_DELETION_REQUESTED',
  ORG_CREATED = 'ORG_CREATED',
  ORG_UPDATED = 'ORG_UPDATED',
  ORG_DELETED = 'ORG_DELETED',
  MEMBER_INVITED = 'MEMBER_INVITED',
  INVITE_ACCEPTED = 'INVITE_ACCEPTED',
  INVITE_DECLINED = 'INVITE_DECLINED',
  INVITE_RESENT = 'INVITE_RESENT',
  INVITE_REVOKED = 'INVITE_REVOKED',
  MEMBER_DEACTIVATED = 'MEMBER_DEACTIVATED',
  MEMBER_REACTIVATED = 'MEMBER_REACTIVATED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',
  SETUP_COMPLETED = 'SETUP_COMPLETED',
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  SESSION_REVOKED = 'SESSION_REVOKED',
  FORCED_LOGOUT_ALL = 'FORCED_LOGOUT_ALL',
  SETTINGS_GENERAL_UPDATED = 'SETTINGS_GENERAL_UPDATED',
  SETTINGS_SLUG_CHANGED = 'SETTINGS_SLUG_CHANGED',
  SETTINGS_BUSINESS_UPDATED = 'SETTINGS_BUSINESS_UPDATED',
  SETTINGS_BANK_UPDATED = 'SETTINGS_BANK_UPDATED',
  SETTINGS_TAX_UPDATED = 'SETTINGS_TAX_UPDATED',
  SETTINGS_SIGNATORY_UPDATED = 'SETTINGS_SIGNATORY_UPDATED',
  SETTINGS_PF_UPDATED = 'SETTINGS_PF_UPDATED',
  SETTINGS_ESI_UPDATED = 'SETTINGS_ESI_UPDATED',
  SETTINGS_TDS_UPDATED = 'SETTINGS_TDS_UPDATED',
  SETTINGS_PT_UPDATED = 'SETTINGS_PT_UPDATED',
  SETTINGS_LWF_UPDATED = 'SETTINGS_LWF_UPDATED',
  SETTINGS_SALARY_STRUCTURE_UPDATED = 'SETTINGS_SALARY_STRUCTURE_UPDATED',
  SETTINGS_PAYROLL_SCHEDULE_UPDATED = 'SETTINGS_PAYROLL_SCHEDULE_UPDATED',
  SETTINGS_WORK_HOURS_UPDATED = 'SETTINGS_WORK_HOURS_UPDATED',
  SETTINGS_ATTENDANCE_UPDATED = 'SETTINGS_ATTENDANCE_UPDATED',
  SETTINGS_HOLIDAY_ADDED = 'SETTINGS_HOLIDAY_ADDED',
  SETTINGS_HOLIDAY_REMOVED = 'SETTINGS_HOLIDAY_REMOVED',
  SETTINGS_LEAVE_TYPE_ADDED = 'SETTINGS_LEAVE_TYPE_ADDED',
  SETTINGS_LEAVE_TYPE_UPDATED = 'SETTINGS_LEAVE_TYPE_UPDATED',
  SETTINGS_LEAVE_TYPE_REMOVED = 'SETTINGS_LEAVE_TYPE_REMOVED',
  SETTINGS_BRANDING_UPDATED = 'SETTINGS_BRANDING_UPDATED',
  SETTINGS_LOGO_UPLOADED = 'SETTINGS_LOGO_UPLOADED',
  SETTINGS_FEATURE_TOGGLED = 'SETTINGS_FEATURE_TOGGLED',
  SETTINGS_NOTIFICATION_UPDATED = 'SETTINGS_NOTIFICATION_UPDATED',
  SETTINGS_DEPARTMENT_CREATED = 'SETTINGS_DEPARTMENT_CREATED',
  SETTINGS_DEPARTMENT_UPDATED = 'SETTINGS_DEPARTMENT_UPDATED',
  SETTINGS_DEPARTMENT_DELETED = 'SETTINGS_DEPARTMENT_DELETED',
  OWNERSHIP_TRANSFERRED = 'OWNERSHIP_TRANSFERRED',
  ORG_DELETION_INITIATED = 'ORG_DELETION_INITIATED',
  ORG_DELETION_CANCELLED = 'ORG_DELETION_CANCELLED',
  ORG_DATA_EXPORTED = 'ORG_DATA_EXPORTED',
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel('AuditLog') private auditLogModel: Model<IAuditLog>,
  ) {}

  async log(params: {
    action: AuditAction;
    userId: string;
    resource: string;
    resourceId?: string;
    organizationId?: string;
    targetUserId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      const entry = new this.auditLogModel({
        ...params,
        timestamp: new Date(),
      });
      await entry.save();
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${err.message || err}`);
    }
  }

  async getByOrganization(orgId: string, options?: { from?: Date; to?: Date; action?: string; page?: number; limit?: number }): Promise<{ logs: IAuditLog[]; total: number }> {
    const filter: any = { organizationId: orgId };
    if (options?.action) filter.action = options.action;
    if (options?.from || options?.to) {
      filter.timestamp = {};
      if (options.from) filter.timestamp.$gte = options.from;
      if (options.to) filter.timestamp.$lte = options.to;
    }

    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.auditLogModel.countDocuments(filter),
    ]);

    return { logs, total };
  }
}
