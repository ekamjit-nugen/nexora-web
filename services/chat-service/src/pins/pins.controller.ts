import { Controller, Get, Post, Delete, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PinsService } from './pins.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ChannelPermissionGuard } from '../common/guards/channel-permission.guard';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class PinsController {
  constructor(private pinsService: PinsService) {}

  @Post('messages/:id/pin')
  @UseGuards(ChannelPermissionGuard)
  @HttpCode(HttpStatus.OK)
  async pinMessage(@Param('id') id: string, @Req() req) {
    const message = await this.pinsService.pinMessage(id, req.user.userId);
    return { success: true, message: 'Message pinned', data: message };
  }

  @Delete('messages/:id/pin')
  async unpinMessage(@Param('id') id: string, @Req() req) {
    const message = await this.pinsService.unpinMessage(id, req.user.userId);
    return { success: true, message: 'Message unpinned', data: message };
  }

  @Get('conversations/:id/pins')
  async getPinnedMessages(@Param('id') id: string, @Req() req) {
    const messages = await this.pinsService.getPinnedMessages(id, req.user.userId);
    return { success: true, data: messages };
  }
}
