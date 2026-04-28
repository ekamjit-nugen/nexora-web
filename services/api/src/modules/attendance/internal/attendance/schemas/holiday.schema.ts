import { Schema, Document } from 'mongoose';

/**
 * Holiday calendar entry (per-org, per-date). Admin creates; payroll +
 * attendance engines read.
 *
 * Why it exists:
 *   - Attendance schema has `status: 'holiday'` as a valid value, but
 *     until now that was set manually per employee per day. An org-wide
 *     calendar lets payroll reclassify an absent-on-holiday record as
 *     `holiday` automatically (so it doesn't trigger LOP) without HR
 *     having to touch every record.
 *   - Payroll OT bucketing already uses `record.status === 'holiday'` —
 *     this wires the upstream so that status actually gets set.
 *
 * Design notes:
 *   - `date` is stored at 00:00 UTC on the holiday's calendar date
 *     (implementation detail of Mongo's Date type). Lookups are by
 *     calendar-date match — engine strips time when comparing.
 *   - Unique compound index (orgId, date) prevents duplicate entries.
 *   - `type` lets an org distinguish national / regional / optional
 *     holidays so UI can group them. Not currently consumed by the
 *     engine (any holiday short-circuits LOP identically).
 *   - `applicableTo` + `applicableIds` are deliberately omitted from
 *     this schema — if an org needs "Pongal only applies to Chennai
 *     office" that's a future follow-up; most Indian orgs apply all
 *     declared holidays to everyone.
 */
export interface IHoliday extends Document {
  organizationId: string;
  date: Date;
  name: string;
  type: 'national' | 'regional' | 'optional' | 'bank' | 'other';
  description?: string | null;
  year: number; // denormalized for easy year-filter queries
  isDeleted: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const HolidaySchema = new Schema<IHoliday>(
  {
    organizationId: { type: String, required: true, index: true },
    date: { type: Date, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    type: {
      type: String,
      enum: ['national', 'regional', 'optional', 'bank', 'other'],
      default: 'national',
    },
    description: { type: String, default: null, maxlength: 500 },
    year: { type: Number, required: true, index: true },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

// One holiday per (org, date). A Jan-26 holiday replacing a prior
// mistaken entry needs a soft-delete-then-recreate path; the partial
// filter ensures uniqueness only on live records.
HolidaySchema.index(
  { organizationId: 1, date: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } },
);
HolidaySchema.index({ organizationId: 1, year: 1, isDeleted: 1 });
