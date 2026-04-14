import { Schema, Document } from 'mongoose';

export interface ITicketCounter extends Document {
  organizationId: string;
  seq: number;
}

export const TicketCounterSchema = new Schema<ITicketCounter>({
  organizationId: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

TicketCounterSchema.index({ organizationId: 1 }, { unique: true });
