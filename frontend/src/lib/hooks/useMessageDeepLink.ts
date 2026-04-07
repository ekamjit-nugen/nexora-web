"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * E3 6.1: Message Deep Links.
 * Parses URL query params to navigate to specific messages/threads.
 *
 * URL formats:
 *   /messages?chat={conversationId}
 *   /messages?chat={conversationId}&message={messageId}
 *   /messages?chat={conversationId}&thread={rootMessageId}&message={replyId}
 */
export function useMessageDeepLink(
  onNavigateToConversation: (conversationId: string) => void,
  onScrollToMessage?: (messageId: string) => void,
  onOpenThread?: (threadId: string) => void,
) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const chatId = searchParams.get("chat");
    const messageId = searchParams.get("message");
    const threadId = searchParams.get("thread");

    if (chatId) {
      onNavigateToConversation(chatId);

      // Best-effort delay to let conversation messages load before scrolling.
      // A proper fix would use a message-loaded callback instead of a fixed timeout.
      if (messageId || threadId) {
        setTimeout(() => {
          if (threadId && onOpenThread) {
            onOpenThread(threadId);
          }
          if (messageId && onScrollToMessage) {
            onScrollToMessage(messageId);
          }
        }, 500);
      }
    }
  }, [searchParams, onNavigateToConversation, onScrollToMessage, onOpenThread]);
}

/**
 * Generate a deep link URL for a message.
 */
export function generateMessageLink(conversationId: string, messageId?: string, threadId?: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  let url = `${base}/messages?chat=${conversationId}`;
  if (threadId) url += `&thread=${threadId}`;
  if (messageId) url += `&message=${messageId}`;
  return url;
}
