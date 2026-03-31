import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { ICondition, IAction } from './automation.model';

@Controller('api/v1/automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  /**
   * Create automation rule
   */
  @Post('rules')
  async createRule(@Body() body: any) {
    return this.automationService.createRule(body.productId, {
      name: body.name,
      description: body.description,
      trigger: body.trigger,
      conditions: body.conditions,
      actions: body.actions,
      priority: body.priority,
    });
  }

  /**
   * Get rule
   */
  @Get('rules/:id')
  async getRule(@Param('id') id: string) {
    return this.automationService.getRule(id);
  }

  /**
   * Get product rules
   */
  @Get('rules/product/:productId')
  async getProductRules(@Param('productId') productId: string) {
    return this.automationService.getProductRules(productId);
  }

  /**
   * Get rules by trigger
   */
  @Get('triggers/:trigger/product/:productId')
  async getRulesByTrigger(
    @Param('trigger') trigger: string,
    @Param('productId') productId: string,
  ) {
    return this.automationService.getRulesByTrigger(productId, trigger);
  }

  /**
   * Update rule
   */
  @Put('rules/:id')
  async updateRule(@Param('id') id: string, @Body() body: any) {
    return this.automationService.updateRule(id, body);
  }

  /**
   * Toggle rule
   */
  @Post('rules/:id/toggle')
  async toggleRule(@Param('id') id: string) {
    return this.automationService.toggleRule(id);
  }

  /**
   * Evaluate conditions
   */
  @Post('conditions/evaluate')
  async evaluateConditions(@Body() body: any) {
    const result = this.automationService.evaluateConditions(body.conditions, body.data);
    return { result };
  }

  /**
   * Execute actions
   */
  @Post('actions/execute')
  async executeActions(@Body() body: any) {
    await this.automationService.executeActions(body.actions, body.context);
    return { success: true };
  }

  /**
   * Delete rule
   */
  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    await this.automationService.deleteRule(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'automation' };
  }
}
