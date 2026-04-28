import { Schema, Document } from 'mongoose';

export interface IKudosReaction {
  userId: string;
  emoji: string;
}

export interface IKudos extends Document {
  organizationId: string;
  fromUserId: string;
  toUserIds: string[];
  type: string;
  message: string;
  visibility: string;
  points: number;
  reactions: IKudosReaction[];
  commentCount: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const KudosSchema = new Schema<IKudos>(
  {
    organizationId: { type: String, required: true, index: true },
    fromUserId: { type: String, required: true },
    toUserIds: { type: [String], required: true, default: [] },
    type: {
      type: String,
      enum: [
        'teamwork',
        'innovation',
        'leadership',
        'customer_first',
        'above_and_beyond',
        'problem_solving',
        'mentorship',
        'reliability',
        'positivity',
        'learning',
      ],
      required: true,
    },
    message: { type: String, required: true },
    visibility: {
      type: String,
      enum: ['public', 'team', 'private'],
      default: 'public',
    },
    points: { type: Number, default: 10 },
    reactions: [
      {
        userId: { type: String, required: true },
        emoji: { type: String, required: true },
      },
    ],
    commentCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

KudosSchema.index({ organizationId: 1, createdAt: -1 });
KudosSchema.index({ organizationId: 1, toUserIds: 1 });
KudosSchema.index({ organizationId: 1, fromUserId: 1 });
