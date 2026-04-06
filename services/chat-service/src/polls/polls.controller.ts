import { Controller, Post, Param, Body, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PollsService } from './polls.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsString, IsArray, IsOptional, IsBoolean, IsDateString } from 'class-validator';

class CreatePollDto {
  @IsString() conversationId: string;
  @IsString() question: string;
  @IsArray() @IsString({ each: true }) options: string[];
  @IsOptional() @IsBoolean() multipleChoice?: boolean;
  @IsOptional() @IsBoolean() anonymous?: boolean;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsBoolean() allowAddOptions?: boolean;
}

class VoteDto {
  @IsString() optionId: string;
}

class AddOptionDto {
  @IsString() text: string;
}

@Controller('chat/polls')
@UseGuards(JwtAuthGuard)
export class PollsController {
  constructor(private pollsService: PollsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPoll(@Body() dto: CreatePollDto, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const poll = await this.pollsService.createPoll(
      dto.conversationId, req.user.userId, senderName,
      dto.question, dto.options,
      { multipleChoice: dto.multipleChoice, anonymous: dto.anonymous, expiresAt: dto.expiresAt, allowAddOptions: dto.allowAddOptions },
    );
    return { success: true, message: 'Poll created', data: poll };
  }

  @Post(':id/vote')
  @HttpCode(HttpStatus.OK)
  async vote(@Param('id') id: string, @Body() dto: VoteDto, @Req() req) {
    const poll = await this.pollsService.vote(id, dto.optionId, req.user.userId);
    return { success: true, message: 'Vote recorded', data: poll };
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  async closePoll(@Param('id') id: string, @Req() req) {
    const poll = await this.pollsService.closePoll(id, req.user.userId);
    return { success: true, message: 'Poll closed', data: poll };
  }

  @Post(':id/options')
  @HttpCode(HttpStatus.OK)
  async addOption(@Param('id') id: string, @Body() dto: AddOptionDto, @Req() req) {
    const poll = await this.pollsService.addOption(id, req.user.userId, dto.text);
    return { success: true, message: 'Option added', data: poll };
  }
}
