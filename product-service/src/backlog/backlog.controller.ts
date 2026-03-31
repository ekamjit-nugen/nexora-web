import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { BacklogService } from './backlog.service';
import { IBacklogItem, ISprint } from './backlog.model';

@Controller('api/v1/backlog')
export class BacklogController {
  constructor(private readonly backlogService: BacklogService) {}

  /**
   * Get backlog
   */
  @Get('product/:productId')
  async getBacklog(@Param('productId') productId: string) {
    return this.backlogService.getBacklog(productId);
  }

  /**
   * Add item
   */
  @Post('product/:productId/items')
  async addItem(@Param('productId') productId: string, @Body() item: any) {
    return this.backlogService.addItem(productId, item);
  }

  /**
   * Update item
   */
  @Put('product/:productId/items/:itemId')
  async updateItem(
    @Param('productId') productId: string,
    @Param('itemId') itemId: string,
    @Body() updates: any,
  ) {
    return this.backlogService.updateItem(productId, itemId, updates);
  }

  /**
   * Prioritize items
   */
  @Post('product/:productId/prioritize')
  async prioritizeItems(@Param('productId') productId: string, @Body() body: any) {
    return this.backlogService.prioritizeItems(productId, body.itemIds);
  }

  /**
   * Move item to sprint
   */
  @Post('product/:productId/items/:itemId/move-to-sprint')
  async moveItemToSprint(
    @Param('productId') productId: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.backlogService.moveItemToSprint(productId, itemId, body.sprintId);
  }

  /**
   * Create sprint
   */
  @Post('product/:productId/sprints')
  async createSprint(@Param('productId') productId: string, @Body() sprint: any) {
    return this.backlogService.createSprint(productId, sprint);
  }

  /**
   * Update sprint
   */
  @Put('product/:productId/sprints/:sprintId')
  async updateSprint(
    @Param('productId') productId: string,
    @Param('sprintId') sprintId: string,
    @Body() updates: any,
  ) {
    return this.backlogService.updateSprint(productId, sprintId, updates);
  }

  /**
   * Get sprint items
   */
  @Get('product/:productId/sprints/:sprintId/items')
  async getSprintItems(
    @Param('productId') productId: string,
    @Param('sprintId') sprintId: string,
  ) {
    return this.backlogService.getSprintItems(productId, sprintId);
  }

  /**
   * Get sprint capacity
   */
  @Get('product/:productId/sprints/:sprintId/capacity')
  async getSprintCapacity(
    @Param('productId') productId: string,
    @Param('sprintId') sprintId: string,
  ) {
    return this.backlogService.getSprintCapacity(productId, sprintId);
  }

  /**
   * Get backlog stats
   */
  @Get('product/:productId/stats')
  async getBacklogStats(@Param('productId') productId: string) {
    return this.backlogService.getBacklogStats(productId);
  }

  /**
   * Refine item
   */
  @Post('product/:productId/items/:itemId/refine')
  async refineItem(
    @Param('productId') productId: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.backlogService.refineItem(productId, itemId, body);
  }

  /**
   * Delete item
   */
  @Delete('product/:productId/items/:itemId')
  async deleteItem(@Param('productId') productId: string, @Param('itemId') itemId: string) {
    await this.backlogService.deleteItem(productId, itemId);
    return { success: true };
  }

  /**
   * Delete sprint
   */
  @Delete('product/:productId/sprints/:sprintId')
  async deleteSprint(
    @Param('productId') productId: string,
    @Param('sprintId') sprintId: string,
  ) {
    await this.backlogService.deleteSprint(productId, sprintId);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'backlog' };
  }
}
