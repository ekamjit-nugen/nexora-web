import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Roles, RolesGuard } from './guards/roles.guard';
import {
  CreateDirectConversationDto,
  CreateGroupDto,
  CreateChannelDto,
  AddParticipantsDto,
  SendMessageDto,
  EditMessageDto,
  MessageQueryDto,
  SearchMessageDto,
  ConvertToGroupDto,
  UpdateChatSettingsDto,
  ReviewFlaggedMessageDto,
} from './dto/index';

@Controller('chat')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private chatService: ChatService,
    private chatGateway: MessagesGateway,
  ) {}

  // ── Conversations ──

  @Post('conversations/direct')
  @UseGuards(JwtAuthGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createDirectConversation(@Body() dto: CreateDirectConversationDto, @Req() req) {
    const conversation = await this.chatService.createDirectConversation(req.user.userId, dto.targetUserId);
    return { success: true, message: 'Direct conversation created', data: conversation };
  }

  @Post('conversations/group')
  @UseGuards(JwtAuthGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createGroup(@Body() dto: CreateGroupDto, @Req() req) {
    const conversation = await this.chatService.createGroup(dto.name, dto.description, dto.memberIds, req.user.userId);
    return { success: true, message: 'Group created successfully', data: conversation };
  }

  @Post('conversations/channel')
  @UseGuards(JwtAuthGuard)
  @Roles('manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() dto: CreateChannelDto, @Req() req) {
    const conversation = await this.chatService.createChannel(dto.name, dto.description, req.user.userId, dto.memberIds);
    return { success: true, message: 'Channel created successfully', data: conversation };
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getMyConversations(@Req() req) {
    const conversations = await this.chatService.getMyConversations(req.user.userId);
    return { success: true, message: 'Conversations retrieved', data: conversations };
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  async getConversation(@Param('id') id: string, @Req() req) {
    const conversation = await this.chatService.getConversation(id, req.user.userId);
    return { success: true, message: 'Conversation retrieved', data: conversation };
  }

  @Post('conversations/:id/participants')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async addParticipants(@Param('id') id: string, @Body() dto: AddParticipantsDto, @Req() req) {
    const conversation = await this.chatService.addParticipants(id, dto.userIds, req.user.userId);
    return { success: true, message: 'Participants added successfully', data: conversation };
  }

  @Delete('conversations/:id/participants/:userId')
  @UseGuards(JwtAuthGuard)
  async removeParticipant(@Param('id') id: string, @Param('userId') userId: string, @Req() req) {
    const conversation = await this.chatService.removeParticipant(id, userId, req.user.userId);
    return { success: true, message: 'Participant removed successfully', data: conversation };
  }

  @Post('conversations/:id/leave')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async leaveConversation(@Param('id') id: string, @Req() req) {
    const result = await this.chatService.leaveConversation(id, req.user.userId);
    return { success: true, ...result };
  }

  // ── Messages ──

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @Req() req) {
    const message = await this.chatService.sendMessage(id, req.user.userId, dto.content, dto.type, dto.replyTo);
    // Broadcast to WebSocket clients in real-time
    // First call ensures all participants' sockets are in the room
    await this.chatGateway.emitToConversation(id, 'message:new', message);
    this.chatGateway.emitToConversation(id, 'conversation:updated', {
      conversationId: id,
      lastMessage: { content: dto.content, senderId: req.user.userId, sentAt: new Date() },
    });
    return { success: true, message: 'Message sent', data: message };
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(@Param('id') id: string, @Query() query: MessageQueryDto, @Req() req) {
    const result = await this.chatService.getMessages(id, req.user.userId, query.page, query.limit);
    return { success: true, message: 'Messages retrieved', data: result.data, pagination: result.pagination };
  }

  @Put('messages/:id')
  @UseGuards(JwtAuthGuard)
  async editMessage(@Param('id') id: string, @Body() dto: EditMessageDto, @Req() req) {
    const message = await this.chatService.editMessage(id, req.user.userId, dto.content);
    return { success: true, message: 'Message edited successfully', data: message };
  }

  @Delete('messages/:id')
  @UseGuards(JwtAuthGuard)
  async deleteMessage(@Param('id') id: string, @Req() req) {
    const result = await this.chatService.deleteMessage(id, req.user.userId);
    return { success: true, ...result };
  }

  // ── Read / Unread ──

  @Post('conversations/:id/read')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string, @Req() req) {
    const result = await this.chatService.markAsRead(id, req.user.userId);
    return { success: true, ...result };
  }

  @Get('unread')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Req() req) {
    const result = await this.chatService.getUnreadCount(req.user.userId);
    return { success: true, message: 'Unread count retrieved', data: result };
  }

  // ── Search ──

  @Get('conversations/:id/search')
  @UseGuards(JwtAuthGuard)
  async searchMessages(@Param('id') id: string, @Query() query: SearchMessageDto, @Req() req) {
    const messages = await this.chatService.searchMessages(id, query.q, req.user.userId);
    return { success: true, message: 'Search results', data: messages };
  }

  // ── Pin / Mute ──

  @Put('conversations/:id/pin')
  @UseGuards(JwtAuthGuard)
  async pinConversation(@Param('id') id: string, @Req() req) {
    const conversation = await this.chatService.pinConversation(id, req.user.userId);
    return { success: true, message: 'Pin toggled', data: conversation };
  }

  @Put('conversations/:id/mute')
  @UseGuards(JwtAuthGuard)
  async muteConversation(@Param('id') id: string, @Req() req) {
    const result = await this.chatService.muteConversation(id, req.user.userId);
    return { success: true, message: 'Mute toggled', data: result };
  }

  // ── Convert Direct to Group ──

  @Post('conversations/:id/convert-group')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async convertToGroup(@Param('id') id: string, @Body() dto: ConvertToGroupDto, @Req() req) {
    const convo = await this.chatService.convertToGroup(id, dto.memberIds, dto.groupName, req.user.userId);
    return { success: true, message: 'Conversation converted to group', data: convo };
  }

  // ── Online Users ──

  @Get('users/online')
  @UseGuards(JwtAuthGuard)
  async getOnlineUsers() {
    const onlineUserIds = this.chatGateway.getOnlineUserIds();
    return { success: true, message: 'Online users retrieved', data: { users: onlineUserIds } };
  }

  // ── Chat Settings ──

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSettings(@Req() req) {
    const settings = await this.chatService.getSettings(req.user.userId);
    return { success: true, message: 'Settings retrieved', data: settings };
  }

  @Put('settings')
  @UseGuards(JwtAuthGuard)
  async updateSettings(@Body() dto: UpdateChatSettingsDto, @Req() req) {
    const settings = await this.chatService.updateSettings(req.user.userId, dto);
    return { success: true, message: 'Settings updated', data: settings };
  }

  @Put('settings/:userId/override')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'owner')
  async adminOverrideSettings(
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateChatSettingsDto,
    @Req() req,
  ) {
    const settings = await this.chatService.adminOverrideSettings(targetUserId, dto, req.user.userId);
    return { success: true, message: 'Settings overridden', data: settings };
  }

  // ── Content Moderation ──

  @Get('moderation/flagged')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'owner')
  async getFlaggedMessages(@Req() req) {
    const flagged = await this.chatService.getFlaggedMessages();
    return { success: true, message: 'Flagged messages retrieved', data: flagged };
  }

  @Put('moderation/flagged/:id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'owner')
  async reviewFlaggedMessage(
    @Param('id') id: string,
    @Body() dto: ReviewFlaggedMessageDto,
    @Req() req,
  ) {
    const result = await this.chatService.reviewFlaggedMessage(id, dto.status, req.user.userId);
    return { success: true, message: 'Flagged message reviewed', data: result };
  }

  @Get('moderation/stats')
  @UseGuards(JwtAuthGuard)
  @Roles('admin', 'owner')
  async getModerationStats(@Req() req) {
    const stats = await this.chatService.getModerationStats();
    return { success: true, message: 'Moderation stats retrieved', data: stats };
  }
}
