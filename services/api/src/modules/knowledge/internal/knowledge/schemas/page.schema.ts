import { Schema, Document } from 'mongoose';

export interface ILinkedEntity {
  entityType: 'project' | 'task';
  entityId: string;
}

export interface IPage extends Document {
  organizationId: string;
  spaceId: string;
  parentId: string;
  title: string;
  slug: string;
  content: string;
  contentPlainText: string;
  excerpt: string;
  coverImage: string;
  icon: string;
  status: 'draft' | 'published' | 'archived';
  version: number;
  isPinned: boolean;
  order: number;
  tags: string[];
  linkedEntities: ILinkedEntity[];
  lastEditedBy: string;
  createdBy: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const PageSchema = new Schema<IPage>(
  {
    organizationId: { type: String, required: true, index: true },
    spaceId: { type: String, required: true, index: true },
    parentId: { type: String, default: null },
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    content: { type: String, default: '' },
    contentPlainText: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    icon: { type: String, default: '📄' },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
    version: { type: Number, default: 1 },
    isPinned: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    tags: [{ type: String }],
    linkedEntities: [
      {
        entityType: { type: String, enum: ['project', 'task'] },
        entityId: { type: String },
      },
    ],
    lastEditedBy: { type: String, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

PageSchema.index({ organizationId: 1, spaceId: 1, isDeleted: 1 });
PageSchema.index({ spaceId: 1, parentId: 1, order: 1 });
PageSchema.index({ spaceId: 1, slug: 1 }, { unique: true });
PageSchema.index({ organizationId: 1, isPinned: 1 });
PageSchema.index({ title: 'text', contentPlainText: 'text', tags: 'text' });
PageSchema.index({ 'linkedEntities.entityId': 1 });
