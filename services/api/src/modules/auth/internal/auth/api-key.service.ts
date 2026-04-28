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
    // SHA-256 lookup hash lets validateApiKey do a single indexed lookup
    // instead of scanning candidates by prefix. Defense-in-depth is preserved
    // by the bcrypt keyHash compare after the lookup succeeds.
    const keyLookupHash = crypto.createHash('sha256').update(fullKey).digest('hex');

    const apiKey = new this.apiKeyModel({
      organizationId: orgId,
      name: dto.name,
      prefix,
      keyHash,
      keyLookupHash,
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
   *
   * SECURITY: Primary lookup is an indexed exact match on SHA-256(fullKey),
   * so a single DB query finds the record (no "iterate all candidates"
   * pattern). A constant-time compare against the stored lookup hash runs
   * before the bcrypt verification to cheaply reject forged keys. The
   * bcrypt compare is kept as defense-in-depth against a DB leak that would
   * otherwise yield usable keys directly from the lookup hash.
   *
   * Expired/inactive/deleted records are filtered in-query, so expired keys
   * don't incur a bcrypt cost at all.
   */
  async validateApiKey(fullKey: string): Promise<IApiKey | null> {
    if (!fullKey || typeof fullKey !== 'string' || !fullKey.startsWith('nx_live_')) return null;
    // Cap length to cheaply reject garbage and prevent hash computation abuse.
    if (fullKey.length > 128) return null;

    const lookupHash = crypto.createHash('sha256').update(fullKey).digest('hex');
    const now = new Date();

    const candidate = await this.apiKeyModel.findOne({
      keyLookupHash: lookupHash,
      isActive: true,
      isDeleted: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    if (candidate) {
      // Constant-time cheap pre-check, then bcrypt for defense-in-depth.
      const storedLookup = Buffer.from(candidate.keyLookupHash || '', 'hex');
      const providedLookup = Buffer.from(lookupHash, 'hex');
      if (
        storedLookup.length !== providedLookup.length ||
        !crypto.timingSafeEqual(storedLookup, providedLookup)
      ) {
        return null;
      }
      const match = await bcrypt.compare(fullKey, candidate.keyHash);
      if (!match) return null;
      candidate.lastUsedAt = now;
      candidate.usageCount = (candidate.usageCount || 0) + 1;
      await candidate.save().catch(err =>
        this.logger.warn(`Failed to update lastUsedAt: ${err.message}`),
      );
      return candidate;
    }

    // Legacy fallback: records created before keyLookupHash existed. Look up
    // by prefix (unique) and bcrypt compare. Migrates on first hit.
    const prefix = fullKey.substring(0, 15);
    const legacy = await this.apiKeyModel.findOne({
      prefix,
      keyLookupHash: null,
      isActive: true,
      isDeleted: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    if (!legacy) return null;

    const match = await bcrypt.compare(fullKey, legacy.keyHash);
    if (!match) return null;

    legacy.keyLookupHash = lookupHash;
    legacy.lastUsedAt = now;
    legacy.usageCount = (legacy.usageCount || 0) + 1;
    await legacy.save().catch(err =>
      this.logger.warn(`Failed to backfill keyLookupHash: ${err.message}`),
    );
    return legacy;
  }
}
