import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Req, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { CreateDirectConversationDto } from './dto/create-direct.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { AddParticipantsDto, ConvertToGroupDto } from './dto/add-participant.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, FeatureGuard, RolesGuard)
export class ConversationsController {
  private readonly logger = new Logger(ConversationsController.name);

  constructor(private conversationsService: ConversationsService) {}

  @Post('conversations/direct')
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createDirectConversation(@Body() dto: CreateDirectConversationDto, @Req() req) {
    const conversation = await this.conversationsService.createDirectConversation(req.user.userId, dto.targetUserId, req.user.organizationId);
    return { success: true, message: 'Direct conversation created', data: conversation };
  }

  @Post('conversations/group')
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Body() dto: CreateGroupDto, @Req() req) {
    const conversation = await this.conversationsService.createGroup(dto.name, dto.description, dto.memberIds, req.user.userId);
    return { success: true, message: 'Group created successfully', data: conversation };
  }

  @Post('conversations/channel')
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() dto: CreateChannelDto, @Req() req) {
    const conversation = await this.conversationsService.createChannel(
      dto.name, dto.description, req.user.userId, dto.memberIds, dto.channelType, dto.topic, dto.categoryId,
    );
    return { success: true, message: 'Channel created successfully', data: conversation };
  }

  @Get('conversations')
  async getMyConversations(@Req() req) {
    const conversations = await this.conversationsService.getMyConversations(req.user.userId);
    return { success: true, message: 'Conversations retrieved', data: conversations };
  }

  @Get('conversations/self')
  async getSelfConversation(@Req() req) {
    const conversation = await this.conversationsService.getOrCreateSelfConversation(req.user.userId, req.user.organizationId || 'default');
    return { success: true, message: 'Self conversation retrieved', data: conversation };
  }

  @Get('conversations/:id')
  async getConversation(@Param('id') id: string, @Req() req) {
    const conversation = await this.conversationsService.getConversation(id, req.user.userId);
    return { success: true, message: 'Conversation retrieved', data: conversation };
  }

  @Post('conversations/:id/participants')
  @HttpCode(HttpStatus.OK)
  async addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto, @Req() req) {
    const conversation = await this.conversationsService.addParticipants(id, dto.userIds, req.user.userId);
    return { success: true, message: 'Participants added successfully', data: conversation };
  }

  @Delete('conversations/:id/participants/:userId')
  async removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @Req() req) {
    const conversation = await this.conversationsService.removeParticipant(id, userId, req.user.userId);
    return { success: true, message: 'Participant removed successfully', data: conversation };
  }

  @Post('conversations/:id/leave')
  @HttpCode(HttpStatus.OK)
  async leaveConversation(@Param('id') id: string, @Req() req) {
    const result = await this.conversationsService.leaveConversation(id, req.user.userId);
    return { success: true, ...result };
  }

  @Put('conversations/:id/pin')
  async pinConversation(@Param('id') id: string, @Req() req) {
    const result = await this.conversationsService.pinConversation(id, req.user.userId);
    return { success: true, message: 'Pin toggled', data: result };
  }

  @Put('conversations/:id/mute')
  async muteConversation(@Param('id') id: string, @Req() req) {
    const result = await this.conversationsService.muteConversation(id, req.user.userId);
    return { success: true, message: 'Mute toggled', data: result };
  }

  @Put('conversations/:id/unarchive')
  async unarchiveConversation(@Param('id') id: string, @Req() req) {
    // Item 20: Conversation unarchive
    const result = await this.conversationsService.unarchiveConversation(id, req.user.userId);
    return { success: true, message: 'Conversation unarchived', data: result };
  }

  @Post('conversations/:id/convert-group')
  @HttpCode(HttpStatus.OK)
  async convertToGroup(@Param('id') id: string, @Body() dto: ConvertToGroupDto, @Req() req) {
    const convo = await this.conversationsService.convertToGroup(id, dto.memberIds, dto.groupName, req.user.userId);
    return { success: true, message: 'Conversation converted to group', data: convo };
  }

  // E3 Item 6.2: Mark conversation as unread from a specific message
  @Put('conversations/:id/unread')
  async markAsUnread(@Param('id') id: string, @Body() body: { fromMessageId: string }, @Req() req) {
    await this.conversationsService.markAsUnread(id, req.user.userId, body.fromMessageId);
    return { success: true, message: 'Marked as unread' };
  }

  // E3 Item 6.7: Star/unstar conversation
  @Put('conversations/:id/star')
  async starConversation(@Param('id') id: string, @Req() req) {
    const result = await this.conversationsService.starConversation(id, req.user.userId);
    return { success: true, message: 'Star toggled', data: result };
  }

  // Add invited (pending) users to a conversation
  // They can't send messages yet but will see history when they accept the org invite
  @Post('conversations/:id/invite-participants')
  @HttpCode(HttpStatus.OK)
  async inviteParticipants(@Param('id') id: string, @Body() body: { userIds: string[] }, @Req() req) {
    const conversation = await this.conversationsService.addInvitedParticipants(id, body.userIds, req.user.userId);
    return { success: true, message: 'Invited users added to conversation', data: conversation };
  }

  // Called by auth-service (via Redis event) when an invited user accepts their invite
  // Activates their memberStatus in all conversations they were pre-added to
  @Post('conversations/activate-user')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async activateUser(@Body() body: { userId: string }) {
    const count = await this.conversationsService.activateInvitedUser(body.userId);
    return { success: true, message: `User activated in ${count} conversations` };
  }
}
