import { Schema, Document } from 'mongoose';

export interface ITicket extends Document {
  organizationId: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'it_support' | 'hr' | 'finance' | 'facilities' | 'admin' | 'other';
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'assigned' | 'in_progress' | 'waiting_on_requester' | 'resolved' | 'closed' | 'cancelled';
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  assigneeId: string;
  assigneeName: string;
  teamId: string;
  tags: string[];
  attachments: Array<{ name: string; url: string; uploadedAt: Date }>;
  slaResponseDue: Date;
  slaResolutionDue: Date;
  firstRespondedAt: Date;
  resolvedAt: Date;
  closedAt: Date;
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  rating: number;
  ratingComment: string;
  isDeleted: boolean;
  deletedAt: Date;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TicketSchema = new Schema<ITicket>(
  {
    organizationId: { type: String, required: true, index: true },
    ticketNumber: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, enum: ['it_support', 'hr', 'finance', 'facilities', 'admin', 'other'], required: true },
    priority: { type: String, enum: ['critical', 'high', 'medium', 'low'], default: 'medium' },
    status: { type: String, enum: ['open', 'assigned', 'in_progress', 'waiting_on_requester', 'resolved', 'closed', 'cancelled'], default: 'open' },
    requesterId: { type: String, required: true },
    requesterName: { type: String, default: '' },
    requesterEmail: { type: String, default: '' },
    assigneeId: { type: String, default: null },
    assigneeName: { type: String, default: '' },
    teamId: { type: String, default: null },
    tags: [{ type: String }],
    attachments: [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
    slaResponseDue: { type: Date, default: null },
    slaResolutionDue: { type: Date, default: null },
    firstRespondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    slaResponseBreached: { type: Boolean, default: false },
    slaResolutionBreached: { type: Boolean, default: false },
    rating: { type: Number, default: null, min: 1, max: 5 },
    ratingComment: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true },
);

TicketSchema.index({ organizationId: 1, status: 1 });
TicketSchema.index({ organizationId: 1, requesterId: 1 });
TicketSchema.index({ organizationId: 1, assigneeId: 1 });
TicketSchema.index({ organizationId: 1, ticketNumber: 1 }, { unique: true });
TicketSchema.index({ title: 'text', description: 'text' });
