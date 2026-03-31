import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { KanbanService } from './kanban.service';

@Controller('api/v1/kanban')
export class KanbanController {
  constructor(private readonly kanbanService: KanbanService) {}

  /**
   * Create board
   */
  @Post()
  async createBoard(@Body() body: any) {
    return this.kanbanService.createBoard(body.productId, {
      workflowId: body.workflowId,
      title: body.title,
      description: body.description,
      columns: body.columns,
    });
  }

  /**
   * Get board
   */
  @Get(':id')
  async getBoard(@Param('id') id: string) {
    return this.kanbanService.getBoard(id);
  }

  /**
   * Get product board
   */
  @Get('product/:productId')
  async getProductBoard(@Param('productId') productId: string) {
    return this.kanbanService.getProductBoard(productId);
  }

  /**
   * Update board
   */
  @Put(':id')
  async updateBoard(@Param('id') id: string, @Body() body: any) {
    return this.kanbanService.updateBoard(id, body);
  }

  /**
   * Move card
   */
  @Post(':id/move-card')
  async moveCard(@Param('id') id: string, @Body() body: any) {
    return this.kanbanService.moveCard(
      id,
      body.cardId,
      body.fromStateId,
      body.toStateId,
      body.order,
    );
  }

  /**
   * Reorder cards
   */
  @Post(':id/reorder')
  async reorderCards(@Param('id') id: string, @Body() body: any) {
    return this.kanbanService.reorderCards(id, body.stateId, body.cardIds);
  }

  /**
   * Get board stats
   */
  @Get(':id/stats')
  async getBoardStats(@Param('id') id: string) {
    return this.kanbanService.getBoardStats(id);
  }

  /**
   * Delete board
   */
  @Delete(':id')
  async deleteBoard(@Param('id') id: string) {
    await this.kanbanService.deleteBoard(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'kanban' };
  }
}
