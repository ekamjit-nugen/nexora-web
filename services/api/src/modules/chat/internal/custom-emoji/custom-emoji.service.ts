import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ICustomEmoji } from './custom-emoji.schema';

@Injectable()
export class CustomEmojiService {
  private readonly logger = new Logger(CustomEmojiService.name);

  private static readonly NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,30}[a-zA-Z0-9]$/;

  constructor(
    @InjectModel('CustomEmoji', 'nexora_chat') private customEmojiModel: Model<ICustomEmoji>,
  ) {}

  async list(organizationId: string) {
    const emojis = await this.customEmojiModel
      .find({ organizationId, isDeleted: false })
      .sort({ createdAt: -1 })
      .lean();
    return emojis;
  }

  async create(name: string, url: string, organizationId: string, uploadedBy: string) {
    // Validate name: alphanumeric + hyphens, 2-32 chars, cannot start/end with hyphen
    if (!name || name.length < 2 || name.length > 32) {
      throw new BadRequestException('Emoji name must be between 2 and 32 characters');
    }
    if (!CustomEmojiService.NAME_REGEX.test(name)) {
      throw new BadRequestException('Emoji name must be alphanumeric with hyphens only (cannot start or end with a hyphen)');
    }
    if (!url) {
      throw new BadRequestException('Emoji URL is required');
    }

    // Check for duplicate name within the org
    const existing = await this.customEmojiModel.findOne({
      organizationId,
      name: name.toLowerCase(),
      isDeleted: false,
    });
    if (existing) {
      throw new ConflictException(`An emoji with the name "${name}" already exists`);
    }

    const emoji = new this.customEmojiModel({
      name: name.toLowerCase(),
      url,
      organizationId,
      uploadedBy,
    });

    await emoji.save();
    this.logger.log(`Custom emoji created: ${emoji.name} by ${uploadedBy} in org ${organizationId}`);
    return emoji;
  }

  async delete(emojiId: string, userId: string, organizationId: string, userRoles: string[]) {
    const emoji = await this.customEmojiModel.findOne({
      _id: emojiId,
      organizationId,
      isDeleted: false,
    });

    if (!emoji) {
      throw new NotFoundException('Custom emoji not found');
    }

    // Allow deletion by the uploader or admin/hr roles
    const isAdmin = userRoles.includes('admin') || userRoles.includes('super_admin') || userRoles.includes('hr');
    if (emoji.uploadedBy !== userId && !isAdmin) {
      throw new ForbiddenException('You can only delete your own custom emoji');
    }

    emoji.isDeleted = true;
    await emoji.save();

    this.logger.log(`Custom emoji ${emoji.name} soft-deleted by ${userId}`);
    return { message: 'Custom emoji deleted successfully' };
  }
}
