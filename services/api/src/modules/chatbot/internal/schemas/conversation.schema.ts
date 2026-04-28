import { Schema, Document } from 'mongoose';

/**
 * Chatbot conversation — one row per user-bot session.
 *
 * Tenant isolation rules (these are NOT optional):
 *   - `organizationId` is required and indexed.
 *   - Every read query MUST include organizationId in the filter.
 *   - The controller enforces this — repository never sees a query
 *     without it. See chatbot.controller.ts isolation guard.
 */

export interface IChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** ISO timestamp; ms granularity is fine. */
  createdAt: Date;
  /** Optional: tokens consumed (rough), latency ms — diagnostics only. */
  tokens?: number;
  latencyMs?: number;
}

export interface IConversation extends Document {
  organizationId: string;
  userId: string;
  title: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isDeleted: boolean;
}

const ChatMessageSchema = new Schema<IChatMessage>(
  {
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    tokens: Number,
    latencyMs: Number,
  },
  { _id: false },
);

export const ConversationSchema = new Schema<IConversation>(
  {
    organizationId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    title: { type: String, default: 'New conversation' },
    messages: { type: [ChatMessageSchema], default: [] },
    isDeleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);

// Composite index: hot path is "list this user's conversations
// in this org, newest first".
ConversationSchema.index({ organizationId: 1, userId: 1, updatedAt: -1 });
