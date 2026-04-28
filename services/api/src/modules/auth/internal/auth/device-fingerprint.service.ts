import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { ITrustedDevice } from './schemas/trusted-device.schema';

interface DeviceInfo {
  userAgent?: string;
  ipAddress?: string;
  acceptLanguage?: string;
}

interface ParsedDevice {
  fingerprint: string;
  deviceName: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
}

@Injectable()
export class DeviceFingerprintService {
  private readonly logger = new Logger(DeviceFingerprintService.name);

  constructor(
    @InjectModel('TrustedDevice') private trustedDeviceModel: Model<ITrustedDevice>,
  ) {}

  /**
   * Generate a device fingerprint hash from request data.
   * Uses userAgent + IP subnet (not full IP) + language for stability.
   */
  generateFingerprint(info: DeviceInfo): string {
    const ua = info.userAgent || 'unknown';
    // Use /24 subnet instead of full IP for mobile/roaming users
    const ipSubnet = (info.ipAddress || '0.0.0.0').split('.').slice(0, 3).join('.');
    const lang = info.acceptLanguage || 'unknown';
    const raw = `${ua}|${ipSubnet}|${lang}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Parse user agent into readable device info.
   */
  parseDevice(userAgent: string): ParsedDevice {
    const ua = userAgent || '';

    // Detect browser
    let browser = 'Unknown';
    let browserVersion = '';
    if (/Edg\/(\d+)/.test(ua)) {
      browser = 'Edge';
      browserVersion = ua.match(/Edg\/(\d+)/)?.[1] || '';
    } else if (/Chrome\/(\d+)/.test(ua) && !ua.includes('Edg')) {
      browser = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
    } else if (/Safari\/(\d+)/.test(ua) && !ua.includes('Chrome')) {
      browser = 'Safari';
      browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
    } else if (/Firefox\/(\d+)/.test(ua)) {
      browser = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
    }

    // Detect OS
    let os = 'Unknown';
    let osVersion = '';
    if (/Mac OS X ([\d_]+)/.test(ua)) {
      os = 'macOS';
      osVersion = ua.match(/Mac OS X ([\d_]+)/)?.[1].replace(/_/g, '.') || '';
    } else if (/iPhone OS ([\d_]+)/.test(ua) || /iPad; CPU OS ([\d_]+)/.test(ua)) {
      os = 'iOS';
      osVersion = ua.match(/OS ([\d_]+)/)?.[1].replace(/_/g, '.') || '';
    } else if (/Android (\d+)/.test(ua)) {
      os = 'Android';
      osVersion = ua.match(/Android ([\d.]+)/)?.[1] || '';
    } else if (/Windows NT ([\d.]+)/.test(ua)) {
      os = 'Windows';
      osVersion = ua.match(/Windows NT ([\d.]+)/)?.[1] || '';
    } else if (/Linux/.test(ua)) {
      os = 'Linux';
    }

    const deviceName = `${browser} on ${os}`;
    const fingerprint = this.generateFingerprint({ userAgent: ua });

    return { fingerprint, deviceName, browser, browserVersion, os, osVersion };
  }

  /**
   * Record a login for a device. Returns true if this is a NEW device.
   */
  async recordDeviceLogin(
    userId: string,
    info: DeviceInfo,
    organizationId?: string,
  ): Promise<{ isNewDevice: boolean; device: ITrustedDevice }> {
    const parsed = this.parseDevice(info.userAgent || '');
    // Recompute fingerprint using the full DeviceInfo (including IP subnet + lang) for stability
    const fingerprint = this.generateFingerprint(info);

    const existing = await this.trustedDeviceModel.findOne({
      userId,
      deviceFingerprint: fingerprint,
      isDeleted: false,
    });

    if (existing) {
      existing.lastSeenAt = new Date();
      existing.loginCount = (existing.loginCount || 0) + 1;
      if (info.ipAddress) (existing as any).ipAddress = info.ipAddress;
      await existing.save();
      return { isNewDevice: false, device: existing };
    }

    const newDevice = new this.trustedDeviceModel({
      userId,
      organizationId,
      deviceFingerprint: fingerprint,
      deviceName: parsed.deviceName,
      browser: parsed.browser,
      browserVersion: parsed.browserVersion,
      os: parsed.os,
      osVersion: parsed.osVersion,
      ipAddress: info.ipAddress,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      loginCount: 1,
      isTrusted: true,
    });

    await newDevice.save();
    this.logger.warn(
      `New device login for user ${userId}: ${parsed.deviceName} from ${info.ipAddress}`,
    );
    return { isNewDevice: true, device: newDevice };
  }

  async listUserDevices(userId: string): Promise<ITrustedDevice[]> {
    return this.trustedDeviceModel
      .find({ userId, isDeleted: false })
      .sort({ lastSeenAt: -1 })
      .lean();
  }

  async revokeDevice(userId: string, deviceId: string, reason?: string): Promise<void> {
    await this.trustedDeviceModel.updateOne(
      { _id: deviceId, userId },
      {
        $set: {
          isTrusted: false,
          trustRevokedAt: new Date(),
          trustRevokedReason: reason,
        },
      },
    );
  }

  async revokeAllDevices(userId: string, except?: string): Promise<number> {
    const filter: any = { userId, isDeleted: false };
    if (except) filter.deviceFingerprint = { $ne: except };
    const result = await this.trustedDeviceModel.updateMany(filter, {
      $set: {
        isTrusted: false,
        trustRevokedAt: new Date(),
        trustRevokedReason: 'Bulk revocation',
      },
    });
    return result.modifiedCount;
  }
}
