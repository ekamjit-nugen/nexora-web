import { Schema, Document } from 'mongoose';

export interface ICustomFieldOption {
  value: string;
  label: string;
  color?: string;
}

export interface ICustomFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface ICustomField extends Document {
  organizationId: string;
  projectId?: string;
  name: string;
  key: string;
  type:
    | 'text'
    | 'number'
    | 'date'
    | 'dropdown'
    | 'multi_select'
    | 'checkbox'
    | 'url'
    | 'user'
    | 'currency'
    | 'percentage';
  description?: string;
  required: boolean;
  defaultValue?: any;
  options?: ICustomFieldOption[];
  validation?: ICustomFieldValidation;
  appliesTo: 'all' | 'project_specific' | 'task_type';
  taskTypes?: string[];
  displayOrder: number;
  showInList: boolean;
  showInDetail: boolean;
  isDeleted: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CustomFieldSchema = new Schema<ICustomField>(
  {
    organizationId: { type: String, required: true, index: true },
    projectId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        'text',
        'number',
        'date',
        'dropdown',
        'multi_select',
        'checkbox',
        'url',
        'user',
        'currency',
        'percentage',
      ],
      required: true,
    },
    description: { type: String, default: null },
    required: { type: Boolean, default: false },
    defaultValue: { type: Schema.Types.Mixed, default: null },
    options: [
      {
        value: { type: String, required: true },
        label: { type: String, required: true },
        color: { type: String, default: null },
      },
    ],
    validation: {
      min: { type: Number, default: null },
      max: { type: Number, default: null },
      minLength: { type: Number, default: null },
      maxLength: { type: Number, default: null },
      pattern: { type: String, default: null },
    },
    appliesTo: {
      type: String,
      enum: ['all', 'project_specific', 'task_type'],
      default: 'all',
    },
    taskTypes: [{ type: String }],
    displayOrder: { type: Number, default: 0 },
    showInList: { type: Boolean, default: true },
    showInDetail: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

CustomFieldSchema.index(
  { organizationId: 1, projectId: 1, key: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
CustomFieldSchema.index({ organizationId: 1, isDeleted: 1 });
