import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles, RolesGuard } from '../common/guards/roles.guard';
import { IsString, IsOptional, IsArray } from 'class-validator';

class CreateCategoryDto {
  @IsString()
  name: string;
}

class ReorderCategoriesDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds: string[];
}

@Controller('chat/channels')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get('browse')
  async browsePublicChannels(@Req() req) {
    const channels = await this.channelsService.browsePublicChannels(req.user.organizationId || 'default', req.user.userId);
    return { success: true, data: channels };
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  async joinChannel(@Param('id') id: string, @Req() req) {
    const channel = await this.channelsService.joinChannel(id, req.user.userId, req.user.organizationId);
    return { success: true, message: 'Joined channel', data: channel };
  }

  @Get('categories')
  async listCategories(@Req() req) {
    const categories = await this.channelsService.listCategories(req.user.organizationId || 'default');
    return { success: true, data: categories };
  }

  @Post('categories')
  @Roles('admin', 'owner')
  @HttpCode(HttpStatus.CREATED)
  async createCategory(@Body() dto: CreateCategoryDto, @Req() req) {
    const category = await this.channelsService.createCategory(req.user.organizationId || 'default', dto.name, req.user.userId);
    return { success: true, message: 'Category created', data: category };
  }

  @Put('categories/:id')
  @Roles('admin', 'owner')
  async updateCategory(@Param('id') id: string, @Body() dto: CreateCategoryDto) {
    const category = await this.channelsService.updateCategory(id, dto.name);
    return { success: true, message: 'Category updated', data: category };
  }

  @Delete('categories/:id')
  @Roles('admin', 'owner')
  async deleteCategory(@Param('id') id: string) {
    await this.channelsService.deleteCategory(id);
    return { success: true, message: 'Category deleted' };
  }

  @Put('categories/reorder')
  @Roles('admin', 'owner')
  async reorderCategories(@Body() dto: ReorderCategoriesDto, @Req() req) {
    const categories = await this.channelsService.reorderCategories(req.user.organizationId || 'default', dto.orderedIds);
    return { success: true, data: categories };
  }
}
