import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Req,
  HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { SprintService } from './sprint.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  CreateSprintDto, UpdateSprintDto,
  CompleteSprintDto, AddTasksToSprintDto,
} from './dto/board.dto';

@Controller('sprints')
export class SprintController {
  private readonly logger = new Logger(SprintController.name);

  constructor(private sprintService: SprintService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSprint(@Body() dto: CreateSprintDto, @Req() req) {
    const sprint = await this.sprintService.createSprint(dto, req.user.userId);
    return { success: true, message: 'Sprint created successfully', data: sprint };
  }

  @Get('board/:boardId')
  @UseGuards(JwtAuthGuard)
  async getSprintsByBoard(@Param('boardId') boardId: string) {
    const sprints = await this.sprintService.getSprintsByBoard(boardId);
    return { success: true, message: 'Sprints retrieved', data: sprints };
  }

  @Get('board/:boardId/active')
  @UseGuards(JwtAuthGuard)
  async getActiveSprint(@Param('boardId') boardId: string) {
    const sprint = await this.sprintService.getActiveSprint(boardId);
    return { success: true, message: sprint ? 'Active sprint retrieved' : 'No active sprint', data: sprint };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getSprint(@Param('id') id: string) {
    const sprint = await this.sprintService.getSprint(id);
    return { success: true, message: 'Sprint retrieved', data: sprint };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateSprint(@Param('id') id: string, @Body() dto: UpdateSprintDto) {
    const sprint = await this.sprintService.updateSprint(id, dto);
    return { success: true, message: 'Sprint updated successfully', data: sprint };
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async startSprint(@Param('id') id: string) {
    const sprint = await this.sprintService.startSprint(id);
    return { success: true, message: 'Sprint started successfully', data: sprint };
  }

  @Post(':id/complete')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async completeSprint(@Param('id') id: string, @Body() dto: CompleteSprintDto) {
    const sprint = await this.sprintService.completeSprint(id, dto.moveUnfinishedTo);
    return { success: true, message: 'Sprint completed successfully', data: sprint };
  }

  @Post(':id/tasks')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async addTasks(@Param('id') id: string, @Body() dto: AddTasksToSprintDto) {
    const sprint = await this.sprintService.addTasksToSprint(id, dto.taskIds);
    return { success: true, message: 'Tasks added to sprint', data: sprint };
  }

  @Delete(':id/tasks/:taskId')
  @UseGuards(JwtAuthGuard)
  async removeTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    const sprint = await this.sprintService.removeTaskFromSprint(id, taskId);
    return { success: true, message: 'Task removed from sprint', data: sprint };
  }
}
