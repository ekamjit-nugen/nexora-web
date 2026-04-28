/**
 * ChatPublicApi — what other modules can ask chat for.
 *
 * Today's known consumers:
 *   - notification: "you have N unread messages" digest emails.
 *   - HR onboarding flow: auto-create welcome DM with new hire.
 */
export interface ConversationSummary {
  _id: string;
  organizationId: string;
  type: string;
  participantIds: string[];
  lastMessageAt: Date | null;
}

export interface ChatPublicApi {
  /** Lookup a conversation. */
  getConversation(
    organizationId: string,
    conversationId: string,
  ): Promise<ConversationSummary | null>;

  /** Count unread messages for a user across all their conversations. */
  countUnreadForUser(organizationId: string, userId: string): Promise<number>;
}

export const CHAT_PUBLIC_API = Symbol('CHAT_PUBLIC_API');
