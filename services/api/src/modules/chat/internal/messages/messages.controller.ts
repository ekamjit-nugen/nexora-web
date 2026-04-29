import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { MessagesService } from './messages.service';
import { MessagesGateway } from './messages.gateway';
import { ForwardingService } from './forwarding.service';
import { CreateTaskService } from './create-task.service';
import { CommandsService } from '../commands/commands.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FeatureGuard } from '../../../../bootstrap/auth/feature.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { ChannelPermissionGuard } from '../common/guards/channel-permission.guard';
import { SendMessageDto, EditMessageDto, MessageQueryDto, SearchMessageDto } from './dto/send-message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard, FeatureGuard, RolesGuard)
export class MessagesController {
  private readonly logger = new Logger(MessagesController.name);

  constructor(
    private messagesService: MessagesService,
    private messagesGateway: MessagesGateway,
    private forwardingService: ForwardingService,
    private createTaskService: CreateTaskService,
    private commandsService: CommandsService,
  ) {}

  @Get('commands')
  getAvailableCommands() {
    return { success: true, data: this.commandsService.getAvailableCommands() };
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @UseGuards(ChannelPermissionGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async sendMessage(@Param('id') id: string, @Body() dto: SendMessageDto, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const message = await this.messagesService.sendMessage(id, req.user.userId, dto.content, dto.type, dto.replyTo, senderName);

    // Broadcast to all participants in the conversation via WebSocket
    // ensureParticipantsInRoom is called once inside the first broadcast
    await this.messagesGateway.broadcastToConversation(id, 'message:new', message);
    this.messagesGateway.broadcastToConversation(id, 'conversation:updated', {
      conversationId: id,
      lastMessage: { content: dto.content, senderId: req.user.userId, sentAt: new Date() },
    });

    return { success: true, message: 'Message sent', data: message };
  }

  @Get('conversations/:id/messages')
  async getMessages(@Param('id') id: string, @Query() query: MessageQueryDto, @Req() req) {
    const result = await this.messagesService.getMessages(id, req.user.userId, query.page, query.limit);
    return { success: true, message: 'Messages retrieved', data: result.data, pagination: result.pagination };
  }

  @Put('messages/:id')
  async editMessage(@Param('id') id: string, @Body() dto: EditMessageDto, @Req() req) {
    const message = await this.messagesService.editMessage(id, req.user.userId, dto.content);
    return { success: true, message: 'Message edited successfully', data: message };
  }

  @Delete('messages/:id')
  async deleteMessage(@Param('id') id: string, @Req() req) {
    const result = await this.messagesService.deleteMessage(id, req.user.userId);
    return { success: true, ...result };
  }

  @Post('conversations/:id/read')
  @HttpCode(HttpStatus.OK)
  async markAsRead(@Param('id') id: string, @Req() req) {
    const result = await this.messagesService.markAsRead(id, req.user.userId);
    return { success: true, ...result };
  }

  @Get('unread')
  async getUnreadCount(@Req() req) {
    const result = await this.messagesService.getUnreadCount(req.user.userId);
    return { success: true, message: 'Unread count retrieved', data: result };
  }

  @Get('conversations/:id/search')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async searchMessages(@Param('id') id: string, @Query() query: SearchMessageDto, @Req() req) {
    const messages = await this.messagesService.searchMessages(id, query.q, req.user.userId);
    return { success: true, message: 'Search results', data: messages };
  }

  @Post('messages/:id/forward')
  @HttpCode(HttpStatus.OK)
  async forwardMessage(@Param('id') id: string, @Body() body: { targetConversationId: string }, @Req() req) {
    const senderName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || null;
    const message = await this.forwardingService.forwardMessage(id, body.targetConversationId, req.user.userId, senderName);
    return { success: true, message: 'Message forwarded', data: message };
  }

  // Item 21: Read receipt count endpoint
  @Get('conversations/:convId/messages/:msgId/read-status')
  async getReadStatus(@Param('convId') convId: string, @Param('msgId') msgId: string, @Req() req) {
    const status = await this.messagesService.getReadStatus(convId, msgId, req.user.userId);
    return { success: true, data: status };
  }

  // E3 Item 7.7: Create task from chat message
  @Post('messages/:id/create-task')
  @HttpCode(HttpStatus.CREATED)
  async createTaskFromMessage(
    @Param('id') id: string,
    @Body() body: { title: string; assigneeId?: string; projectId?: string; dueDate?: string; priority?: string },
    @Req() req,
  ) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const result = await this.createTaskService.createTaskFromMessage(id, req.user.userId, body, token);
    return { success: true, message: 'Task created from message', data: result };
  }
}
