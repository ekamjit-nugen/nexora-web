import { Controller, Get, Post, Delete, UseGuards, Req, HttpCode, HttpStatus, Logger, Body } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GdprService } from './gdpr.service';

@Controller('gdpr')
export class GdprController {
  private readonly logger = new Logger(GdprController.name);

  constructor(private gdprService: GdprService) {}

  // GDPR Article 15: Right of access
  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportMyData(@Req() req: any) {
    const userId = req.user.userId;
    const data = await this.gdprService.exportUserData(userId);
    return {
      success: true,
      message: 'Personal data export generated',
      data,
    };
  }

  // GDPR Article 17: Right to erasure ("right to be forgotten")
  @Post('delete-request')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async requestAccountDeletion(@Body() body: { reason?: string; confirmEmail: string }, @Req() req: any) {
    const userId = req.user.userId;
    const userEmail = req.user.email;
    if (body.confirmEmail !== userEmail) {
      return { success: false, error: { code: 'EMAIL_MISMATCH', message: 'Email confirmation does not match your account' } };
    }
    const result = await this.gdprService.requestDeletion(userId, body.reason);
    return {
      success: true,
      message: 'Deletion request submitted. Your account will be permanently deleted within 30 days.',
      data: result,
    };
  }

  @Get('delete-request/status')
  @UseGuards(JwtAuthGuard)
  async getDeletionStatus(@Req() req: any) {
    const userId = req.user.userId;
    const status = await this.gdprService.getDeletionStatus(userId);
    return { success: true, data: status };
  }

  @Delete('delete-request')
  @UseGuards(JwtAuthGuard)
  async cancelDeletion(@Req() req: any) {
    const userId = req.user.userId;
    await this.gdprService.cancelDeletion(userId);
    return { success: true, message: 'Deletion request cancelled' };
  }

  // GDPR Article 20: Data portability
  @Get('export/download')
  @UseGuards(JwtAuthGuard)
  async downloadDataExport(@Req() req: any) {
    const userId = req.user.userId;
    const data = await this.gdprService.exportUserData(userId);
    return {
      success: true,
      data: {
        filename: `nexora-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json`,
        content: data,
        format: 'json',
      },
    };
  }
}
