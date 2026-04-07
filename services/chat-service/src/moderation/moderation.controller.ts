import { Controller, Get, Put, Body, Param, UseGuards, Req } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { IFlaggedMessage } from './schemas/flagged-message.schema';
import { IsString, IsOptional } from 'class-validator';

class ReviewFlaggedMessageDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  action?: string;
}

@Controller('chat/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ModerationController {
  constructor(
    @InjectModel('FlaggedMessage') private flaggedMessageModel: Model<IFlaggedMessage>,
  ) {}

  @Get('flagged')
  @Roles('admin', 'owner')
  async getFlaggedMessages(@Req() req) {
    const flagged = await this.flaggedMessageModel.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 }).lean();
    return { success: true, message: 'Flagged messages retrieved', data: flagged };
  }

  @Put('flagged/:id')
  @Roles('admin', 'owner')
  async reviewFlaggedMessage(@Param('id') id: string, @Body() dto: ReviewFlaggedMessageDto, @Req() req) {
    const flagged = await this.flaggedMessageModel.findByIdAndUpdate(id, {
      status: dto.status,
      reviewedBy: req.user.userId,
      reviewedAt: new Date(),
    }, { new: true });
    return { success: true, message: 'Flagged message reviewed', data: flagged };
  }

  @Get('stats')
  @Roles('admin', 'owner')
  async getModerationStats() {
    const [total, pending, reviewed, dismissed, actioned] = await Promise.all([
      this.flaggedMessageModel.countDocuments(),
      this.flaggedMessageModel.countDocuments({ status: 'pending' }),
      this.flaggedMessageModel.countDocuments({ status: 'reviewed' }),
      this.flaggedMessageModel.countDocuments({ status: 'dismissed' }),
      this.flaggedMessageModel.countDocuments({ status: 'actioned' }),
    ]);
    return { success: true, message: 'Moderation stats retrieved', data: { total, pending, reviewed, dismissed, actioned } };
  }
}
