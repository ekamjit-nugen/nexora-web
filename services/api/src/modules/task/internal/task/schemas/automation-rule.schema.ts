import { Schema, Document } from 'mongoose';

export type AutomationEvent =
  | 'task_created'
  | 'task_updated'
  | 'status_changed'
  | 'assignee_changed'
  | 'priority_changed'
  | 'due_date_approaching'
  | 'comment_added'
  | 'field_changed';

export type AutomationOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'in'
  | 'is_empty'
  | 'is_not_empty';

export type AutomationActionType =
  | 'change_status'
  | 'assign_to'
  | 'set_priority'
  | 'add_label'
  | 'remove_label'
  | 'add_comment'
  | 'send_notification'
  | 'create_subtask'
  | 'set_due_date'
  | 'set_field';

export interface IAutomationCondition {
  field: string;
  operator: AutomationOperator;
  value?: any;
}

export interface IAutomationAction {
  type: AutomationActionType;
  params: any;
}

export interface IAutomationTrigger {
  event: AutomationEvent;
  conditions?: IAutomationCondition[];
}

export interface IAutomationRule extends Document {
  organizationId: string;
  projectId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  trigger: IAutomationTrigger;
  actions: IAutomationAction[];
  runCount: number;
  lastRunAt?: Date;
  lastRunStatus?: 'success' | 'failure' | 'skipped';
  lastRunError?: string;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AutomationRuleSchema = new Schema<IAutomationRule>(
  {
    organizationId: { type: String, required: true, index: true },
    projectId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    enabled: { type: Boolean, default: true },
    trigger: {
      event: {
        type: String,
        enum: [
          'task_created',
          'task_updated',
          'status_changed',
          'assignee_changed',
          'priority_changed',
          'due_date_approaching',
          'comment_added',
          'field_changed',
        ],
        required: true,
      },
      conditions: [
        {
          field: { type: String, required: true },
          operator: {
            type: String,
            enum: [
              'equals',
              'not_equals',
              'contains',
              'greater_than',
              'less_than',
              'in',
              'is_empty',
              'is_not_empty',
            ],
            required: true,
          },
          value: { type: Schema.Types.Mixed, default: null },
        },
      ],
    },
    actions: [
      {
        type: {
          type: String,
          enum: [
            'change_status',
            'assign_to',
            'set_priority',
            'add_label',
            'remove_label',
            'add_comment',
            'send_notification',
            'create_subtask',
            'set_due_date',
            'set_field',
          ],
          required: true,
        },
        params: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    runCount: { type: Number, default: 0 },
    lastRunAt: { type: Date, default: null },
    lastRunStatus: {
      type: String,
      enum: ['success', 'failure', 'skipped'],
      default: null,
    },
    lastRunError: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

AutomationRuleSchema.index({ organizationId: 1, projectId: 1, enabled: 1 });
AutomationRuleSchema.index({ organizationId: 1, 'trigger.event': 1, enabled: 1 });
AutomationRuleSchema.index({ isDeleted: 1 });
