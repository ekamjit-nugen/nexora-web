import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { IsString, IsDateString, IsOptional } from 'class-validator';

class CreateReminderDto {
  @IsString() messageId: string;
  @IsString() conversationId: string;
  @IsDateString() reminderAt: string;
  @IsOptional() @IsString() note?: string;
}

@Controller('chat/reminders')
@UseGuards(JwtAuthGuard, FeatureGuard)
export class RemindersController {
  constructor(private remindersService: RemindersService) {}

  @Get()
  async getReminders(@Req() req) {
    const reminders = await this.remindersService.getReminders(req.user.userId);
    return { success: true, data: reminders };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createReminder(@Body() dto: CreateReminderDto, @Req() req) {
    const reminder = await this.remindersService.createReminder(
      req.user.userId, dto.messageId, dto.conversationId, new Date(dto.reminderAt), dto.note,
    );
    return { success: true, message: 'Reminder set', data: reminder };
  }

  @Delete(':id')
  async cancelReminder(@Param('id') id: string, @Req() req) {
    await this.remindersService.cancelReminder(id, req.user.userId);
    return { success: true, message: 'Reminder cancelled' };
  }
}
