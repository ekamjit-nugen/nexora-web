import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateSpaceDto, UpdateSpaceDto,
  CreatePageDto, UpdatePageDto, MovePageDto, PageQueryDto,
  SearchQueryDto,
  CreateTemplateDto, UpdateTemplateDto,
} from './dto';

@Controller('knowledge')
export class KnowledgeController {
  private readonly logger = new Logger(KnowledgeController.name);

  constructor(private readonly knowledgeService: KnowledgeService) {}

  // ── Spaces ──

  @Post('spaces')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSpace(@Body() dto: CreateSpaceDto, @Req() req) {
    const data = await this.knowledgeService.createSpace(req.user?.organizationId, dto, req.user.userId);
    return { success: true, message: 'Space created', data };
  }

  @Get('spaces')
  @UseGuards(JwtAuthGuard)
  async getSpaces(@Req() req) {
    const data = await this.knowledgeService.getSpaces(req.user?.organizationId);
    return { success: true, message: 'Spaces retrieved', data };
  }

  @Get('spaces/:id')
  @UseGuards(JwtAuthGuard)
  async getSpace(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.getSpace(req.user?.organizationId, id);
    return { success: true, message: 'Space retrieved', data };
  }

  @Put('spaces/:id')
  @UseGuards(JwtAuthGuard)
  async updateSpace(@Param('id') id: string, @Body() dto: UpdateSpaceDto, @Req() req) {
    const data = await this.knowledgeService.updateSpace(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Space updated', data };
  }

  @Delete('spaces/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSpace(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.deleteSpace(req.user?.organizationId, id, req.user.userId);
    return { success: true, ...data };
  }

  @Get('spaces/:id/tree')
  @UseGuards(JwtAuthGuard)
  async getSpaceTree(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.getSpaceTree(req.user?.organizationId, id);
    return { success: true, message: 'Space tree retrieved', data };
  }

  // ── Pages ──

  @Post('pages')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPage(@Body() dto: CreatePageDto, @Req() req) {
    const data = await this.knowledgeService.createPage(req.user?.organizationId, dto, req.user.userId);
    return { success: true, message: 'Page created', data };
  }

  @Get('pages/:id')
  @UseGuards(JwtAuthGuard)
  async getPage(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.getPage(req.user?.organizationId, id);
    return { success: true, message: 'Page retrieved', data };
  }

  @Put('pages/:id')
  @UseGuards(JwtAuthGuard)
  async updatePage(@Param('id') id: string, @Body() dto: UpdatePageDto, @Req() req) {
    const data = await this.knowledgeService.updatePage(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Page updated', data };
  }

  @Delete('pages/:id')
  @UseGuards(JwtAuthGuard)
  async deletePage(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.deletePage(req.user?.organizationId, id, req.user.userId);
    return { success: true, ...data };
  }

  @Put('pages/:id/move')
  @UseGuards(JwtAuthGuard)
  async movePage(@Param('id') id: string, @Body() dto: MovePageDto, @Req() req) {
    const data = await this.knowledgeService.movePage(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Page moved', data };
  }

  @Put('pages/:id/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderPage(@Param('id') id: string, @Body('order') order: number, @Req() req) {
    const data = await this.knowledgeService.reorderPage(req.user?.organizationId, id, order, req.user.userId);
    return { success: true, message: 'Page reordered', data };
  }

  @Put('pages/:id/pin')
  @UseGuards(JwtAuthGuard)
  async togglePin(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.togglePin(req.user?.organizationId, id, req.user.userId);
    return { success: true, message: `Page ${data.isPinned ? 'pinned' : 'unpinned'}`, data };
  }

  // ── Versions ──

  @Get('pages/:id/versions')
  @UseGuards(JwtAuthGuard)
  async getVersions(@Param('id') id: string, @Query('page') page: number, @Query('limit') limit: number, @Req() req) {
    const result = await this.knowledgeService.getVersions(req.user?.organizationId, id, page || 1, limit || 20);
    return { success: true, message: 'Versions retrieved', data: result.data, pagination: result.pagination };
  }

  @Get('pages/:id/versions/:version')
  @UseGuards(JwtAuthGuard)
  async getVersion(@Param('id') id: string, @Param('version') version: number, @Req() req) {
    const data = await this.knowledgeService.getVersion(req.user?.organizationId, id, version);
    return { success: true, message: 'Version retrieved', data };
  }

  @Post('pages/:id/versions/:version/restore')
  @UseGuards(JwtAuthGuard)
  async restoreVersion(@Param('id') id: string, @Param('version') version: number, @Req() req) {
    const data = await this.knowledgeService.restoreVersion(req.user?.organizationId, id, version, req.user.userId);
    return { success: true, message: `Restored to version ${version}`, data };
  }

  // ── Pages by Entity ──

  @Get('pages/by-entity/:entityType/:entityId')
  @UseGuards(JwtAuthGuard)
  async getPagesByEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string, @Req() req) {
    const data = await this.knowledgeService.getPagesByEntity(req.user?.organizationId, entityType, entityId);
    return { success: true, message: 'Linked pages retrieved', data };
  }

  // ── Search ──

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query() query: SearchQueryDto, @Req() req) {
    const data = await this.knowledgeService.search(req.user?.organizationId, query);
    return { success: true, message: 'Search results', data };
  }

  @Post('search/semantic')
  @UseGuards(JwtAuthGuard)
  async semanticSearch(@Body('query') queryText: string, @Body('spaceId') spaceId: string, @Req() req) {
    const data = await this.knowledgeService.semanticSearch(req.user?.organizationId, queryText, spaceId);
    return { success: true, message: 'Semantic search results', data };
  }

  // ── Templates ──

  @Post('templates')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createTemplate(@Body() dto: CreateTemplateDto, @Req() req) {
    const data = await this.knowledgeService.createTemplate(req.user?.organizationId, dto, req.user.userId);
    return { success: true, message: 'Template created', data };
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates(@Req() req) {
    const data = await this.knowledgeService.getTemplates(req.user?.organizationId);
    return { success: true, message: 'Templates retrieved', data };
  }

  @Get('templates/:id')
  @UseGuards(JwtAuthGuard)
  async getTemplate(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.getTemplate(req.user?.organizationId, id);
    return { success: true, message: 'Template retrieved', data };
  }

  @Put('templates/:id')
  @UseGuards(JwtAuthGuard)
  async updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto, @Req() req) {
    const data = await this.knowledgeService.updateTemplate(req.user?.organizationId, id, dto, req.user.userId);
    return { success: true, message: 'Template updated', data };
  }

  @Delete('templates/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTemplate(@Param('id') id: string, @Req() req) {
    const data = await this.knowledgeService.deleteTemplate(req.user?.organizationId, id);
    return { success: true, ...data };
  }

  // ── Bookmarks ──

  @Post('bookmarks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addBookmark(@Body('pageId') pageId: string, @Req() req) {
    const data = await this.knowledgeService.addBookmark(req.user?.organizationId, req.user.userId, pageId);
    return { success: true, message: 'Page bookmarked', data };
  }

  @Delete('bookmarks/:pageId')
  @UseGuards(JwtAuthGuard)
  async removeBookmark(@Param('pageId') pageId: string, @Req() req) {
    const data = await this.knowledgeService.removeBookmark(req.user.userId, pageId);
    return { success: true, ...data };
  }

  @Get('bookmarks')
  @UseGuards(JwtAuthGuard)
  async getBookmarks(@Req() req) {
    const data = await this.knowledgeService.getBookmarks(req.user?.organizationId, req.user.userId);
    return { success: true, message: 'Bookmarks retrieved', data };
  }
}
