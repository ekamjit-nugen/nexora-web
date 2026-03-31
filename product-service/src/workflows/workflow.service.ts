import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IWorkflow, IWorkflowState, IWorkflowTransition } from './workflow.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WorkflowService {
  constructor(@InjectModel('Workflow') private workflowModel: Model<IWorkflow>) {}

  /**
   * Create a new workflow
   */
  async createWorkflow(
    productId: string,
    workflowData: {
      name: string;
      description?: string;
      states: IWorkflowState[];
      transitions: IWorkflowTransition[];
      initialStateId: string;
    },
  ): Promise<IWorkflow> {
    // Validate states exist
    const stateIds = workflowData.states.map(s => s.id);
    if (!stateIds.includes(workflowData.initialStateId)) {
      throw new BadRequestException('Initial state must exist in states list');
    }

    // Validate transitions
    for (const transition of workflowData.transitions) {
      if (!stateIds.includes(transition.fromStateId) || !stateIds.includes(transition.toStateId)) {
        throw new BadRequestException('Transition references non-existent state');
      }
    }

    const workflow = new this.workflowModel({
      productId,
      ...workflowData,
    });

    return workflow.save();
  }

  /**
   * Get workflow by ID
   */
  async getWorkflow(workflowId: string): Promise<IWorkflow> {
    const workflow = await this.workflowModel.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }
    return workflow;
  }

  /**
   * Get workflows for a product
   */
  async getProductWorkflows(productId: string): Promise<IWorkflow[]> {
    return this.workflowModel.find({ productId, isActive: true }).exec();
  }

  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<{
      name: string;
      description: string;
      states: IWorkflowState[];
      transitions: IWorkflowTransition[];
      initialStateId: string;
    }>,
  ): Promise<IWorkflow> {
    const workflow = await this.getWorkflow(workflowId);

    // If states changed, validate transitions
    if (updates.states) {
      const stateIds = updates.states.map(s => s.id);
      const transitions = updates.transitions || workflow.transitions;
      for (const transition of transitions) {
        if (!stateIds.includes(transition.fromStateId) || !stateIds.includes(transition.toStateId)) {
          throw new BadRequestException('Transition references non-existent state');
        }
      }
    }

    Object.assign(workflow, updates);
    return workflow.save();
  }

  /**
   * Add state to workflow
   */
  async addState(workflowId: string, state: IWorkflowState): Promise<IWorkflow> {
    const workflow = await this.getWorkflow(workflowId);

    // Check for duplicate state ID
    if (workflow.states.some(s => s.id === state.id)) {
      throw new BadRequestException('State with this ID already exists');
    }

    workflow.states.push(state);
    return workflow.save();
  }

  /**
   * Add transition to workflow
   */
  async addTransition(workflowId: string, transition: IWorkflowTransition): Promise<IWorkflow> {
    const workflow = await this.getWorkflow(workflowId);
    const stateIds = workflow.states.map(s => s.id);

    // Validate transition references existing states
    if (!stateIds.includes(transition.fromStateId) || !stateIds.includes(transition.toStateId)) {
      throw new BadRequestException('Transition references non-existent state');
    }

    workflow.transitions.push(transition);
    return workflow.save();
  }

  /**
   * Validate state transition
   */
  async validateTransition(
    workflowId: string,
    fromStateId: string,
    toStateId: string,
  ): Promise<boolean> {
    const workflow = await this.getWorkflow(workflowId);

    const transition = workflow.transitions.find(
      t => t.fromStateId === fromStateId && t.toStateId === toStateId,
    );

    return !!transition;
  }

  /**
   * Delete workflow (soft delete)
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const workflow = await this.getWorkflow(workflowId);
    workflow.isActive = false;
    await workflow.save();
  }

  /**
   * Clone workflow for another product
   */
  async cloneWorkflow(sourceWorkflowId: string, targetProductId: string): Promise<IWorkflow> {
    const source = await this.getWorkflow(sourceWorkflowId);

    const cloned = new this.workflowModel({
      productId: targetProductId,
      name: `${source.name} (Cloned)`,
      description: source.description,
      states: source.states.map(s => ({ ...s })),
      transitions: source.transitions.map(t => ({ ...t, id: uuidv4() })),
      initialStateId: source.initialStateId,
    });

    return cloned.save();
  }
}
