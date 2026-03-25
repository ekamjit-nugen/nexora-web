import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateBoardDto, UpdateBoardDto, AddColumnDto,
  UpdateColumnDto, ReorderColumnsDto, MoveTaskDto,
  CreateFromTemplateDto,
} from './dto/board.dto';

@Controller('boards')
export class BoardController {
  private readonly logger = new Logger(BoardController.name);

  constructor(private boardService: BoardService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createBoard(@Body() dto: CreateBoardDto, @Req() req) {
    const board = await this.boardService.createBoard(dto, req.user.userId);
    return { success: true, message: 'Board created successfully', data: board };
  }

  @Get('templates')
  @UseGuards(JwtAuthGuard)
  async getTemplates() {
    const templates = this.boardService.getTemplates();
    return { success: true, message: 'Board templates retrieved', data: templates };
  }

  @Post('from-template')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFromTemplate(@Body() dto: CreateFromTemplateDto, @Req() req) {
    const board = await this.boardService.createBoardFromTemplate(dto.projectId, dto.type, req.user.userId);
    return { success: true, message: 'Board created from template', data: board };
  }

  @Get('project/:projectId')
  @UseGuards(JwtAuthGuard)
  async getBoardsByProject(@Param('projectId') projectId: string) {
    const boards = await this.boardService.getBoardsByProject(projectId);
    return { success: true, message: 'Boards retrieved', data: boards };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBoard(@Param('id') id: string) {
    const board = await this.boardService.getBoard(id);
    return { success: true, message: 'Board retrieved', data: board };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateBoard(@Param('id') id: string, @Body() dto: UpdateBoardDto) {
    const board = await this.boardService.updateBoard(id, dto);
    return { success: true, message: 'Board updated successfully', data: board };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteBoard(@Param('id') id: string) {
    const result = await this.boardService.deleteBoard(id);
    return { success: true, ...result };
  }

  @Post(':id/columns')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async addColumn(@Param('id') id: string, @Body() dto: AddColumnDto) {
    const board = await this.boardService.addColumn(id, dto);
    return { success: true, message: 'Column added successfully', data: board };
  }

  @Put(':id/columns/reorder')
  @UseGuards(JwtAuthGuard)
  async reorderColumns(@Param('id') id: string, @Body() dto: ReorderColumnsDto) {
    const board = await this.boardService.reorderColumns(id, dto.columnIds);
    return { success: true, message: 'Columns reordered successfully', data: board };
  }

  @Put(':id/columns/:columnId')
  @UseGuards(JwtAuthGuard)
  async updateColumn(
    @Param('id') id: string,
    @Param('columnId') columnId: string,
    @Body() dto: UpdateColumnDto,
  ) {
    const board = await this.boardService.updateColumn(id, columnId, dto);
    return { success: true, message: 'Column updated successfully', data: board };
  }

  @Delete(':id/columns/:columnId')
  @UseGuards(JwtAuthGuard)
  async removeColumn(@Param('id') id: string, @Param('columnId') columnId: string) {
    const board = await this.boardService.removeColumn(id, columnId);
    return { success: true, message: 'Column removed successfully', data: board };
  }

  @Post(':id/tasks/move')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async moveTask(@Param('id') id: string, @Body() dto: MoveTaskDto) {
    const task = await this.boardService.moveTask(id, dto);
    return { success: true, message: 'Task moved successfully', data: task };
  }
}
