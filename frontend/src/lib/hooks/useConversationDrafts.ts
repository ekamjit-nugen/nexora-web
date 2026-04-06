"use client";

import { useState, useCallback, useEffect } from "react";

const DRAFT_PREFIX = "nexora-draft:";

/**
 * E3 6.4: Conversation drafts.
 * Persists unsent message text per conversation in localStorage.
 * Shows "Draft: ..." preview in conversation list.
 */
export function useConversationDrafts() {
  const getDraft = useCallback((conversationId: string): string => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(`${DRAFT_PREFIX}${conversationId}`) || "";
  }, []);

  const setDraft = useCallback((conversationId: string, content: string) => {
    if (typeof window === "undefined") return;
    if (content.trim()) {
      localStorage.setItem(`${DRAFT_PREFIX}${conversationId}`, content);
    } else {
      localStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`);
    }
  }, []);

  const clearDraft = useCallback((conversationId: string) => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(`${DRAFT_PREFIX}${conversationId}`);
  }, []);

  const hasDraft = useCallback((conversationId: string): boolean => {
    if (typeof window === "undefined") return false;
    return !!localStorage.getItem(`${DRAFT_PREFIX}${conversationId}`);
  }, []);

  const getDraftPreview = useCallback((conversationId: string): string | null => {
    const draft = getDraft(conversationId);
    if (!draft) return null;
    const plain = draft.replace(/<[^>]*>/g, "").trim();
    return plain.length > 50 ? plain.substring(0, 50) + "..." : plain;
  }, [getDraft]);

  return { getDraft, setDraft, clearDraft, hasDraft, getDraftPreview };
}
