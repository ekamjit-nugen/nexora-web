import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAutomationRule, ICondition, IAction } from './automation.model';

@Injectable()
export class AutomationService {
  constructor(@InjectModel('AutomationRule') private ruleModel: Model<IAutomationRule>) {}

  /**
   * Create automation rule
   */
  async createRule(
    productId: string,
    ruleData: {
      name: string;
      description?: string;
      trigger: string;
      conditions: ICondition[];
      actions: IAction[];
      priority?: number;
    },
  ): Promise<IAutomationRule> {
    if (!ruleData.conditions.length) {
      throw new BadRequestException('Rule must have at least one condition');
    }

    if (!ruleData.actions.length) {
      throw new BadRequestException('Rule must have at least one action');
    }

    const rule = new this.ruleModel({
      productId,
      ...ruleData,
      priority: ruleData.priority || 0,
    });

    return rule.save();
  }

  /**
   * Get rule by ID
   */
  async getRule(ruleId: string): Promise<IAutomationRule> {
    const rule = await this.ruleModel.findById(ruleId);
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }
    return rule;
  }

  /**
   * Get rules for a product
   */
  async getProductRules(productId: string): Promise<IAutomationRule[]> {
    return this.ruleModel
      .find({ productId, isActive: true })
      .sort({ priority: -1 })
      .exec();
  }

  /**
   * Get rules by trigger type
   */
  async getRulesByTrigger(productId: string, trigger: string): Promise<IAutomationRule[]> {
    return this.ruleModel
      .find({ productId, trigger, isActive: true })
      .sort({ priority: -1 })
      .exec();
  }

  /**
   * Update rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<{
      name: string;
      description: string;
      conditions: ICondition[];
      actions: IAction[];
      priority: number;
    }>,
  ): Promise<IAutomationRule> {
    const rule = await this.getRule(ruleId);

    if (updates.conditions && !updates.conditions.length) {
      throw new BadRequestException('Rule must have at least one condition');
    }

    if (updates.actions && !updates.actions.length) {
      throw new BadRequestException('Rule must have at least one action');
    }

    Object.assign(rule, updates);
    return rule.save();
  }

  /**
   * Enable/disable rule
   */
  async toggleRule(ruleId: string): Promise<IAutomationRule> {
    const rule = await this.getRule(ruleId);
    rule.isActive = !rule.isActive;
    return rule.save();
  }

  /**
   * Evaluate conditions against data
   */
  evaluateConditions(conditions: ICondition[], data: Record<string, any>): boolean {
    return conditions.every(condition => {
      const value = data[condition.field];
      return this.evaluateOperator(condition.operator, value, condition.value);
    });
  }

  /**
   * Evaluate single operator
   */
  private evaluateOperator(
    operator: string,
    value: any,
    compareValue: any,
  ): boolean {
    switch (operator) {
      case 'equals':
        return value === compareValue;
      case 'contains':
        return String(value).includes(String(compareValue));
      case 'gt':
        return value > compareValue;
      case 'lt':
        return value < compareValue;
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(value);
      case 'regex':
        return new RegExp(compareValue).test(String(value));
      default:
        return false;
    }
  }

  /**
   * Execute actions
   */
  async executeActions(actions: IAction[], context: Record<string, any>): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'setState':
          // State change logic handled by caller
          break;
        case 'notifyUser':
          // Notification logic
          await this.notifyUser(action.config);
          break;
        case 'triggerWebhook':
          // Webhook execution
          await this.triggerWebhook(action.config, context);
          break;
        case 'createTask':
          // Task creation
          await this.createTask(action.config, context);
          break;
        case 'updateField':
          // Field update
          await this.updateField(action.config, context);
          break;
      }
    }
  }

  /**
   * Notify user
   */
  private async notifyUser(config: Record<string, any>): Promise<void> {
    // Implementation for user notification
    console.log(`Notifying user: ${config.userId} with message: ${config.message}`);
  }

  /**
   * Trigger webhook
   */
  private async triggerWebhook(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    try {
      const response = await fetch(config.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(context),
      });
      console.log(`Webhook triggered: ${config.url} (${response.status})`);
    } catch (error) {
      console.error(`Webhook failed: ${config.url}`, error);
    }
  }

  /**
   * Create task
   */
  private async createTask(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    // Implementation for task creation
    console.log(`Creating task: ${config.title} for product: ${context.productId}`);
  }

  /**
   * Update field
   */
  private async updateField(config: Record<string, any>, context: Record<string, any>): Promise<void> {
    // Implementation for field update
    console.log(`Updating field: ${config.field} with value: ${config.value}`);
  }

  /**
   * Delete rule (soft delete)
   */
  async deleteRule(ruleId: string): Promise<void> {
    const rule = await this.getRule(ruleId);
    rule.isActive = false;
    await rule.save();
  }
}
