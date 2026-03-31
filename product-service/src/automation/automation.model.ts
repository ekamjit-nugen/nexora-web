import { Schema, Document } from 'mongoose';

export interface ICondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'regex';
  value: any;
}

export interface IAction {
  type: 'setState' | 'notifyUser' | 'triggerWebhook' | 'createTask' | 'updateField';
  config: Record<string, any>;
}

export interface IAutomationRule extends Document {
  productId: string;
  name: string;
  description: string;
  trigger: 'stateChange' | 'fieldUpdate' | 'timeInterval' | 'customEvent';
  conditions: ICondition[];
  actions: IAction[];
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export const AutomationRuleSchema = new Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    trigger: {
      type: String,
      enum: ['stateChange', 'fieldUpdate', 'timeInterval', 'customEvent'],
      required: true,
    },
    conditions: [
      {
        field: String,
        operator: String,
        value: Schema.Types.Mixed,
      },
    ],
    actions: [
      {
        type: String,
        config: Schema.Types.Mixed,
      },
    ],
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Indexes for common queries
AutomationRuleSchema.index({ productId: 1, isActive: 1 });
AutomationRuleSchema.index({ trigger: 1 });
AutomationRuleSchema.index({ priority: -1 });
