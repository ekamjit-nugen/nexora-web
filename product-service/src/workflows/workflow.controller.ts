import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { IWorkflowState, IWorkflowTransition } from './workflow.model';

@Controller('api/v1/workflows')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  /**
   * Create workflow
   */
  @Post()
  async createWorkflow(@Body() body: any) {
    return this.workflowService.createWorkflow(body.productId, {
      name: body.name,
      description: body.description,
      states: body.states,
      transitions: body.transitions,
      initialStateId: body.initialStateId,
    });
  }

  /**
   * Get workflow
   */
  @Get(':id')
  async getWorkflow(@Param('id') id: string) {
    return this.workflowService.getWorkflow(id);
  }

  /**
   * Get product workflows
   */
  @Get('product/:productId')
  async getProductWorkflows(@Param('productId') productId: string) {
    return this.workflowService.getProductWorkflows(productId);
  }

  /**
   * Update workflow
   */
  @Put(':id')
  async updateWorkflow(@Param('id') id: string, @Body() body: any) {
    return this.workflowService.updateWorkflow(id, body);
  }

  /**
   * Add state
   */
  @Post(':id/states')
  async addState(@Param('id') id: string, @Body() state: IWorkflowState) {
    return this.workflowService.addState(id, state);
  }

  /**
   * Add transition
   */
  @Post(':id/transitions')
  async addTransition(@Param('id') id: string, @Body() transition: IWorkflowTransition) {
    return this.workflowService.addTransition(id, transition);
  }

  /**
   * Validate transition
   */
  @Post(':id/validate-transition')
  async validateTransition(@Param('id') id: string, @Body() body: any) {
    const isValid = await this.workflowService.validateTransition(
      id,
      body.fromStateId,
      body.toStateId,
    );
    return { isValid };
  }

  /**
   * Delete workflow
   */
  @Delete(':id')
  async deleteWorkflow(@Param('id') id: string) {
    await this.workflowService.deleteWorkflow(id);
    return { success: true };
  }

  /**
   * Clone workflow
   */
  @Post(':id/clone')
  async cloneWorkflow(@Param('id') id: string, @Body() body: any) {
    return this.workflowService.cloneWorkflow(id, body.targetProductId);
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'workflows' };
  }
}
