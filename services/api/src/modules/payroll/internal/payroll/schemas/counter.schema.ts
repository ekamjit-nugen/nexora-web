import { Schema, Document } from 'mongoose';

/**
 * Atomic sequence counter. Used anywhere we need a monotonically-increasing
 * serial number that's safe under concurrent writers — e.g., certificate
 * numbers, invoice numbers, employee codes.
 *
 * The document `_id` is the semantic key (e.g., `cert:<orgId>:<year>`), and
 * the `seq` field is incremented via `findOneAndUpdate({$inc: {seq: 1}}, {upsert: true})`.
 *
 * This replaces the "find the highest, add 1, insert" anti-pattern which is
 * a TOCTOU race under concurrent completion.
 */
export interface ICounter extends Document {
  _id: string;
  seq: number;
  updatedAt: Date;
}

export const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true, default: 0 },
  },
  { timestamps: { createdAt: false, updatedAt: true }, _id: false },
);
