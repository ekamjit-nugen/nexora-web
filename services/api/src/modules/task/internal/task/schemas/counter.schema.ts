import { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  _id: string; // Format: "taskseq_{projectId}"
  sequence: number;
}

export const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    sequence: { type: Number, required: true, default: 0 },
  },
  { collection: 'counters', _id: false, versionKey: false },
);
