import { Injectable, Logger, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { IApiKey } from './schemas/api-key.schema';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectModel('ApiKey') private apiKeyModel: Model<IApiKey>,
  ) {}

  /**
   * Generate a new API key. Returns the RAW key only once.
   * Format: nx_live_<32 random chars>
   */
  async createApiKey(dto: { name: string; scopes: string[]; expiresAt?: Date }, userId: string, orgId: string): Promise<{ id: string; key: string; prefix: string }> {
    if (!orgId) throw new ForbiddenException('Organization context required');

    // Generate random key
    const randomPart = crypto.randomBytes(24).toString('base64').replace(/[+/=]/g, '').substring(0, 32);
    const fullKey = `nx_live_${randomPart}`;
    const prefix = fullKey.substring(0, 15); // "nx_live_xxxxxx"
    const keyHash = await bcrypt.hash(fullKey, 10);

    const apiKey = new this.apiKeyModel({
      organizationId: orgId,
      name: dto.name,
      prefix,
      keyHash,
      scopes: dto.scopes || [],
      expiresAt: dto.expiresAt,
      createdBy: userId,
      isActive: true,
    });

    await apiKey.save();
    this.logger.log(`API key created: ${prefix} for org ${orgId}`);

    return {
      id: apiKey._id.toString(),
      key: fullKey, // Return once — never again
      prefix,
    };
  }

  async listApiKeys(orgId: string): Promise<Partial<IApiKey>[]> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    return this.apiKeyModel
      .find({ organizationId: orgId, isDeleted: false })
      .select('-keyHash')
      .sort({ createdAt: -1 })
      .lean();
  }

  async revokeApiKey(id: string, reason: string | undefined, userId: string, orgId: string): Promise<void> {
    if (!orgId) throw new ForbiddenException('Organization context required');
    const key = await this.apiKeyModel.findOne({ _id: id, organizationId: orgId });
    if (!key) throw new NotFoundException('API key not found');

    key.isActive = false;
    key.revokedAt = new Date();
    key.revokedBy = userId;
    key.revokeReason = reason;
    await key.save();
    this.logger.log(`API key revoked: ${key.prefix} by ${userId}`);
  }

  /**
   * Validate an incoming API key. Returns the key doc if valid, null otherwise.
   */
  async validateApiKey(fullKey: string): Promise<IApiKey | null> {
    if (!fullKey || !fullKey.startsWith('nx_live_')) return null;
    const prefix = fullKey.substring(0, 15);

    const candidates = await this.apiKeyModel.find({ prefix, isActive: true, isDeleted: false });
    for (const candidate of candidates) {
      const match = await bcrypt.compare(fullKey, candidate.keyHash);
      if (match) {
        // Check expiration
        if (candidate.expiresAt && candidate.expiresAt < new Date()) return null;
        // Update last used
        candidate.lastUsedAt = new Date();
        candidate.usageCount = (candidate.usageCount || 0) + 1;
        await candidate.save().catch(err => this.logger.warn(`Failed to update lastUsedAt: ${err.message}`));
        return candidate;
      }
    }
    return null;
  }
}
