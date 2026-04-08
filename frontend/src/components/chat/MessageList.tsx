"use client";

import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import type { Conversation, ChatMessage, Employee, ChatSettings } from "@/lib/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { MessageContent } from "@/components/chat";
import { getInitials, formatTime } from "@/lib/utils";
import { chatApi } from "@/lib/api";
import { toast } from "sonner";

// ── Helpers ──

function formatDateGroup(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h";
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return days + "d";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const emojiStripRegex = new RegExp(
  "[\\u{1F600}-\\u{1F64F}\\u{1F300}-\\u{1F5FF}\\u{1F680}-\\u{1F6FF}\\u{1F1E0}-\\u{1F1FF}" +
  "\\u{2600}-\\u{27BF}\\u{FE00}-\\u{FE0F}\\u{200D}\\u{20E3}\\u{E0020}-\\u{E007F}" +
  "\\u{1F900}-\\u{1F9FF}\\u{1FA00}-\\u{1FA6F}\\u{1FA70}-\\u{1FAFF}\\u{2702}-\\u{27B0}" +
  "\\u{231A}-\\u{23F3}\\u{2328}\\u{23CF}\\u{23E9}-\\u{23F3}\\u{23F8}-\\u{23FA}" +
  "\\u{25AA}-\\u{25AB}\\u{25B6}\\u{25C0}\\u{25FB}-\\u{25FE}\\u{2934}-\\u{2935}" +
  "\\u{2B05}-\\u{2B07}\\u{2B1B}-\\u{2B1C}\\u{2B50}\\u{2B55}\\u{3030}\\u{303D}" +
  "\\u{3297}\\u{3299}\\s]",
  "gu"
);
function isEmojiOnly(str: string): boolean {
  const trimmed = str.trim();
  if (trimmed.length === 0 || trimmed.length > 20) return false;
  const stripped = trimmed.replace(emojiStripRegex, "");
  return stripped.length === 0;
}

export interface MessageListProps {
  messages: ChatMessage[];
  conversation: Conversation;
  user: { _id: string };
  employeeMap: Record<string, Employee>;
  onlineUserIds: Set<string>;
  chatSettings: ChatSettings | null;
  loadingMessages: boolean;
  typingText: string | null;
  typingUsers: Set<string>;
  activeId: string | null;
  onThreadOpen: (msg: ChatMessage) => void;
  onForward: (msgId: string) => void;
  onCloseConvoMenu: () => void;
  onReadReceiptClick: (msgId: string, e: React.MouseEvent) => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

function MessageListInner({
  messages,
  conversation,
  user,
  employeeMap,
  onlineUserIds,
  chatSettings,
  loadingMessages,
  typingText,
  typingUsers,
  activeId,
  onThreadOpen,
  onForward,
  onCloseConvoMenu,
  onReadReceiptClick,
  setMessages,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevActiveIdRef = useRef<string | null>(null);

  const getEmployeeName = (userId: string): string => {
    const emp = employeeMap[userId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return userId.slice(-6);
  };

  // ── Translation state ──
  const [translations, setTranslations] = useState<Record<string, { text: string; lang: string }>>({});

  const handleTranslate = useCallback(async (messageId: string, targetLanguage: string) => {
    const msg = messages.find(m => m._id === messageId);
    if (!msg) return;
    const content = msg.content;
    try {
      toast.info(`Translating to ${targetLanguage}...`);
      const res = await chatApi.translateMessage(content, targetLanguage);
      const data = (res as { data?: { translatedText: string; targetLanguage: string } })?.data ?? (res as { translatedText: string; targetLanguage: string });
      const translatedText = data.translatedText;
      setTranslations(prev => ({ ...prev, [messageId]: { text: translatedText, lang: targetLanguage } }));
    } catch {
      toast.error("Translation failed");
    }
  }, [messages]);

  const dismissTranslation = useCallback((messageId: string) => {
    setTranslations(prev => {
      const next = { ...prev };
      delete next[messageId];
      return next;
    });
  }, []);

  // ── Group messages by date (memoized) ──
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: ChatMessage[] }[] = [];
    for (const msg of messages) {
      const dateKey = formatDateGroup(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.date === dateKey) {
        last.messages.push(msg);
      } else {
        groups.push({ date: dateKey, messages: [msg] });
      }
    }
    return groups;
  }, [messages]);

  // ── Auto-scroll ──
  useEffect(() => {
    if (!messages.length) return;
    const isConvoSwitch = prevActiveIdRef.current !== activeId;
    prevActiveIdRef.current = activeId;
    messagesEndRef.current?.scrollIntoView({ behavior: isConvoSwitch ? "instant" : "smooth" });
  }, [messages.length, activeId]);

  // ── Read receipt ticks ──
  const getTickStatus = (msg: ChatMessage) => {
    if (chatSettings && !chatSettings.readReceipts.showOthersReadStatus) {
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1">{"\u2713"}</span>
      );
    }
    const otherParticipants = conversation.participants.filter(p => p.userId !== user._id) || [];
    const readCount = msg.readBy?.filter(r => r.userId !== user._id).length || 0;

    if (readCount >= otherParticipants.length && otherParticipants.length > 0) {
      return (
        <span className="text-[10px] text-[#2E86C1] ml-1 tracking-[-3px] cursor-pointer hover:opacity-70" onClick={(e) => onReadReceiptClick(msg._id, e)} title="See who read this">{"\u2713\u2713"}</span>
      );
    } else if (readCount > 0) {
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1 tracking-[-3px] cursor-pointer hover:opacity-70" onClick={(e) => onReadReceiptClick(msg._id, e)} title="See who read this">{"\u2713\u2713"}</span>
      );
    } else {
      return (
        <span className="text-[10px] text-[#94A3B8] ml-1">{"\u2713"}</span>
      );
    }
  };

  return (
    <ErrorBoundary>
    <div
      className="flex-1 overflow-y-auto px-6 py-5 min-h-0 scroll-smooth"
      onClick={onCloseConvoMenu}
      style={{ backgroundColor: chatSettings?.appearance?.chatBgColor || "#F8FAFC" }}
    >
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          {loadingMessages ? (
            <div className="flex flex-col items-center gap-3">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-2 border-[#E2E8F0]" />
                <div className="absolute inset-0 rounded-full border-2 border-[#2E86C1] border-t-transparent animate-spin" />
              </div>
              <p className="text-[13px] text-[#94A3B8] font-medium">Loading messages...</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#EBF5FF] to-[#DBEAFE] flex items-center justify-center mx-auto mb-4 shadow-sm">
                <svg className="w-8 h-8 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-[14px] font-semibold text-[#334155] mb-1">Start the conversation</p>
              <p className="text-[12px] text-[#94A3B8]">Send a message to get things going</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          {groupedMessages.map((group) => (
            <div key={group.date}>
              {/* Date separator — sticky pill */}
              <div className="flex items-center justify-center my-5 sticky top-0 z-10">
                <div className="px-3 py-1 rounded-full bg-white/80 backdrop-blur-sm border border-[#E2E8F0] shadow-sm">
                  <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{group.date}</span>
                </div>
              </div>

              <div className="space-y-0.5">
                {group.messages.map((msg) => {
                  const isMe = msg.senderId === user._id;
                  const isSystem = msg.type === "system";
                  const isDeleted = msg.isDeleted;

                  if (isSystem) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cmdData = (msg as any).commandData;

                    // Task card
                    if (cmdData?.action === "createTask") {
                      return (
                        <div key={msg._id} className="flex justify-center py-2">
                          <div className="w-[340px] bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#EBF5FF] border-b border-[#DBEAFE]">
                              <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-[12px] font-semibold text-[#2E86C1]">Task Created</span>
                            </div>
                            <div className="px-4 py-3 space-y-1.5">
                              <p className="text-[13px] font-medium text-[#1E293B]">{cmdData.title}</p>
                              {cmdData.assignee && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                                  <span className="text-[11px] text-[#64748B]">@{cmdData.assignee}</span>
                                </div>
                              )}
                              <p className="text-[10px] text-[#94A3B8]">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Leave request card
                    if (cmdData?.action === "leaveRequest") {
                      return (
                        <div key={msg._id} className="flex justify-center py-2">
                          <div className="w-[340px] bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FFF7ED] border-b border-[#FFEDD5]">
                              <svg className="w-4 h-4 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                              <span className="text-[12px] font-semibold text-[#B45309]">Leave Request</span>
                            </div>
                            <div className="px-4 py-3 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#FEF3C7] text-[#92400E]">{cmdData.leaveType}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[12px] text-[#334155]">
                                <span>{cmdData.start}</span>
                                <svg className="w-3 h-3 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
                                <span>{cmdData.end}</span>
                              </div>
                              {cmdData.reason && <p className="text-[11px] text-[#64748B]">{cmdData.reason}</p>}
                              <p className="text-[10px] text-[#94A3B8]">{formatTime(msg.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Default system message
                    return (
                      <div key={msg._id} className="flex justify-center py-2">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1F5F9]/80 backdrop-blur-sm">
                          <svg className="w-3 h-3 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" /></svg>
                          <p className="text-[11px] text-[#64748B] font-medium">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  // Poll message card
                  if (msg.type === "poll") {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const cmdData = (msg as any).commandData;
                    const question = cmdData?.question || msg.content;
                    const options: string[] = cmdData?.options || [];
                    return (
                      <div key={msg._id} className="flex justify-center py-2">
                        <div className="w-[340px] bg-white border border-[#E2E8F0] rounded-xl shadow-sm overflow-hidden">
                          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#F0FDF4] border-b border-[#DCFCE7]">
                            <svg className="w-4 h-4 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                            <span className="text-[12px] font-semibold text-[#166534]">Poll</span>
                          </div>
                          <div className="px-4 py-3 space-y-2">
                            <p className="text-[13px] font-medium text-[#1E293B]">{question}</p>
                            {options.map((opt, idx) => (
                              <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors cursor-pointer">
                                <div className="w-4 h-4 rounded-full border-2 border-[#CBD5E1] shrink-0" />
                                <span className="text-[12px] text-[#334155]">{opt}</span>
                              </div>
                            ))}
                            <p className="text-[10px] text-[#94A3B8]">{formatTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (msg.type === "call") {
                    const isMissed = msg.content?.toLowerCase().includes("missed");
                    const isDeclined = msg.content?.toLowerCase().includes("declined");
                    const isVideo = msg.content?.toLowerCase().includes("video");
                    return (
                      <div key={msg._id} className="flex justify-center py-2">
                        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${isMissed || isDeclined ? "bg-red-50 border-red-100" : "bg-[#F0F9FF] border-[#E0F2FE]"}`}>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isMissed || isDeclined ? "bg-red-100" : "bg-[#DBEAFE]"}`}>
                            {isVideo ? (
                              <svg className={`w-4 h-4 ${isMissed || isDeclined ? "text-red-500" : "text-[#2563EB]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                              </svg>
                            ) : (
                              <svg className={`w-4 h-4 ${isMissed || isDeclined ? "text-red-500" : "text-[#2563EB]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <p className={`text-[12px] font-medium ${isMissed || isDeclined ? "text-red-600" : "text-[#1E40AF]"}`}>
                              {msg.content}
                            </p>
                            <p className="text-[10px] text-[#94A3B8]">{formatTime(msg.createdAt)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg._id} className={`group/msg flex ${isMe ? "justify-end" : "justify-start"} ${!isMe && conversation.type !== "direct" ? "items-end gap-2.5" : ""} py-0.5 px-2 -mx-2 rounded-lg hover:bg-black/[0.02] transition-colors`}>
                      {/* Avatar with hover popup for other users in groups */}
                      {!isMe && conversation.type !== "direct" && (() => {
                        const senderEmp = employeeMap[msg.senderId];
                        const senderName = senderEmp ? `${senderEmp.firstName} ${senderEmp.lastName}` : msg.senderId.slice(-6);
                        const senderInitials = senderEmp ? getInitials(senderEmp.firstName, senderEmp.lastName) : "??";
                        const senderOnline = onlineUserIds.has(msg.senderId);
                        return (
                          <div className="relative group/avatar shrink-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1D6FA5] flex items-center justify-center text-white text-[10px] font-semibold shadow-sm ring-2 ring-white">
                              {senderInitials}
                            </div>
                            {senderOnline && <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#22C55E] rounded-full ring-2 ring-white" />}
                            {/* Hover popup */}
                            <div className="absolute top-full left-0 mt-2 hidden group-hover/avatar:block z-50 pb-1">
                              <div className="bg-[#0F172A] text-white rounded-xl px-4 py-3 shadow-2xl min-w-[200px] border border-white/10">
                                <div className="flex items-center gap-2.5 mb-2">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2E86C1] to-[#1D6FA5] flex items-center justify-center text-white text-[11px] font-semibold">
                                    {senderInitials}
                                  </div>
                                  <div>
                                    <p className="text-[13px] font-semibold">{senderName}</p>
                                    <div className="flex items-center gap-1">
                                      <span className={`w-1.5 h-1.5 rounded-full ${senderOnline ? "bg-[#22C55E]" : "bg-[#64748B]"}`} />
                                      <span className="text-[10px] text-[#94A3B8]">{senderOnline ? "Online" : "Offline"}</span>
                                    </div>
                                  </div>
                                </div>
                                {senderEmp?.email && <p className="text-[10px] text-[#94A3B8] truncate">{senderEmp.email}</p>}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      <div className="max-w-[70%] relative">
                        {/* Sender name in groups */}
                        {!isMe && conversation.type !== "direct" && (
                          <p className="text-[11px] text-[#64748B] mb-0.5 ml-1">
                            {getEmployeeName(msg.senderId)}
                          </p>
                        )}
                        <div
                          className={`px-4 py-2.5 leading-relaxed whitespace-pre-wrap transition-shadow ${
                            !isDeleted && msg.type === "text" && isEmojiOnly(msg.content)
                              ? "text-[32px] !bg-transparent !px-1 !py-0"
                              : chatSettings?.appearance?.fontSize === "small" ? "text-[12px]" : chatSettings?.appearance?.fontSize === "large" ? "text-[15px]" : "text-[13px]"
                          } ${
                            isDeleted
                              ? "bg-[#F1F5F9] text-[#94A3B8] italic rounded-2xl"
                              : isMe
                                ? "rounded-2xl rounded-br-md shadow-sm"
                                : "rounded-2xl rounded-bl-md shadow-sm"
                          }`}
                          style={
                            !isDeleted && msg.type === "text" && isEmojiOnly(msg.content)
                              ? undefined
                              : isDeleted ? undefined : isMe
                                ? { backgroundColor: chatSettings?.appearance?.myBubbleColor || "#2563EB", color: chatSettings?.appearance?.myTextColor || "#FFFFFF" }
                                : { backgroundColor: chatSettings?.appearance?.otherBubbleColor || "#FFFFFF", color: chatSettings?.appearance?.otherTextColor || "#1E293B", border: "1px solid #E2E8F0" }
                          }
                        >
                          {isDeleted ? "This message was deleted" : msg.type === "image" && msg.fileUrl ? (
                            <div>
                              <img src={msg.fileUrl} alt={msg.fileName || "Image"} className="max-w-full max-h-60 rounded-lg cursor-pointer" onClick={() => window.open(msg.fileUrl, "_blank")} />
                              <div className="flex items-center justify-between mt-1">
                                {msg.fileName && <p className="text-[10px] opacity-60 truncate">{msg.fileName}</p>}
                                {!isMe && (
                                  <a href={msg.fileUrl} download={msg.fileName || "image"} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity ml-auto">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                    Download
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : msg.type === "video" && msg.fileUrl ? (
                            <div>
                              <video src={msg.fileUrl} controls className="max-w-full max-h-60 rounded-lg" />
                              <div className="flex items-center justify-between mt-1">
                                {msg.fileName && <p className="text-[10px] opacity-60 truncate">{msg.fileName}</p>}
                                {!isMe && (
                                  <a href={msg.fileUrl} download={msg.fileName || "video"} className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-100 transition-opacity ml-auto">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                    Download
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : msg.type === "audio" && msg.fileUrl ? (
                            <div className="min-w-[240px]">
                              <audio src={msg.fileUrl} controls className="w-full h-8" preload="metadata" />
                              {msg.fileName && <p className="text-[10px] opacity-60 mt-1 truncate">{msg.fileName}</p>}
                              {/* Voice transcription */}
                              {msg.transcription ? (
                                <div className="mt-1.5 px-2 py-1.5 bg-black/5 rounded-lg">
                                  <p className="text-[10px] font-medium opacity-50 mb-0.5">Transcription</p>
                                  <p className="text-[11px] opacity-80 leading-relaxed">{msg.transcription}</p>
                                </div>
                              ) : (
                                <button
                                  onClick={async () => {
                                    try {
                                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      const SpeechRecognitionApi = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                                      if (!SpeechRecognitionApi) { toast.error("Speech recognition not supported in this browser"); return; }
                                      toast.info("Transcribing voice message...");
                                      const audioEl = new Audio(msg.fileUrl);
                                      audioEl.crossOrigin = "anonymous";
                                      const audioCtx = new AudioContext();
                                      const source = audioCtx.createMediaElementSource(audioEl);
                                      const dest = audioCtx.createMediaStreamDestination();
                                      source.connect(dest);
                                      source.connect(audioCtx.destination);
                                      const recognition = new SpeechRecognitionApi();
                                      recognition.continuous = true;
                                      recognition.interimResults = false;
                                      recognition.lang = "en-US";
                                      let transcript = "";
                                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                      recognition.onresult = (event: any) => {
                                        for (let i = event.resultIndex; i < event.results.length; i++) {
                                          if (event.results[i].isFinal) transcript += event.results[i][0].transcript + " ";
                                        }
                                      };
                                      recognition.onend = async () => {
                                        audioCtx.close();
                                        const text = transcript.trim() || "Unable to transcribe";
                                        try {
                                          await chatApi.transcribeVoiceMessage(msg._id, text);
                                          setMessages(prev => prev.map(m => m._id === msg._id ? { ...m, transcription: text } : m));
                                          toast.success("Transcription saved");
                                        } catch { toast.error("Failed to save transcription"); }
                                      };
                                      recognition.onerror = () => { audioCtx.close(); toast.error("Transcription failed"); };
                                      audioEl.onended = () => { setTimeout(() => recognition.stop(), 500); };
                                      recognition.start();
                                      audioEl.play();
                                    } catch { toast.error("Transcription failed"); }
                                  }}
                                  className="mt-1.5 flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] rounded-md transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" /></svg>
                                  Transcribe
                                </button>
                              )}
                            </div>
                          ) : msg.type === "file" ? (
                            <div className="py-1.5 min-w-[220px]">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-black/10 flex items-center justify-center shrink-0">
                                  <svg className="w-5 h-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[12px] font-medium truncate">{msg.fileName || msg.content}</p>
                                  {msg.fileSize && <p className="text-[10px] opacity-60">{msg.fileSize >= 1024 * 1024 ? (msg.fileSize / (1024 * 1024)).toFixed(1) + " MB" : (msg.fileSize / 1024).toFixed(0) + " KB"}</p>}
                                </div>
                              </div>
                              {!isMe && msg.fileUrl ? (
                                <a
                                  href={msg.fileUrl}
                                  download={msg.fileName || "file"}
                                  className="flex items-center justify-center gap-1.5 mt-2 w-full px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition-colors cursor-pointer"
                                  title="Download file"
                                >
                                  <svg className="w-4 h-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                  <span className="text-[11px] font-medium opacity-70">Download</span>
                                </a>
                              ) : !isMe && !msg.fileUrl ? (
                                <div className="flex items-center justify-center gap-1.5 mt-2 w-full px-3 py-2 rounded-lg bg-black/5 opacity-50">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                                  <span className="text-[11px] font-medium">File shared</span>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <MessageContent content={msg.content} />
                          )}
                          {msg.isEdited && !isDeleted && (
                            <span className="text-[10px] opacity-60 ml-1">(edited)</span>
                          )}
                        </div>
                        {/* Translation display */}
                        {translations[msg._id] && (
                          <div className={`mt-1 px-3 py-2 rounded-lg ${isMe ? "bg-blue-50" : "bg-slate-50"} border border-slate-200`}>
                            <div className="h-px bg-slate-200 mb-1.5" />
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1">
                                <span className="text-[10px]">{"🌐"}</span>
                                <span className="text-[10px] font-medium text-slate-500">{translations[msg._id].lang}</span>
                              </div>
                              <button
                                onClick={() => dismissTranslation(msg._id)}
                                className="text-[10px] text-slate-400 hover:text-slate-600 leading-none px-1"
                                title="Dismiss translation"
                              >
                                {"\u00d7"}
                              </button>
                            </div>
                            <p className="text-[12px] text-slate-600 italic leading-relaxed">{translations[msg._id].text}</p>
                          </div>
                        )}
                        {/* Thread reply count */}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {!isDeleted && (msg as any).threadInfo?.replyCount > 0 && (
                          <button
                            onClick={() => onThreadOpen(msg)}
                            className="flex items-center gap-1 mt-0.5 ml-1 text-[11px] text-blue-500 hover:text-blue-700 hover:underline"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                            {(msg as any).threadInfo.replyCount} {(msg as any).threadInfo.replyCount === 1 ? "reply" : "replies"}
                          </button>
                        )}
                        {/* Floating action bar — appears on hover */}
                        {!isDeleted && (
                          <div className={`absolute -top-3 ${isMe ? "right-0" : "left-0"} opacity-0 group-hover/msg:opacity-100 transition-opacity z-10`}>
                            <div className="flex items-center gap-0.5 bg-white rounded-lg shadow-md border border-[#E2E8F0] px-1 py-0.5">
                              <button onClick={() => onThreadOpen(msg)} className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#334155] transition-colors" title="Reply in thread">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                              </button>
                              <button onClick={() => onForward(msg._id)} className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#334155] transition-colors" title="Forward">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                              </button>
                            </div>
                          </div>
                        )}
                        <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end mr-1" : "ml-1"}`}>
                          <p className="text-[10px] text-[#94A3B8]">
                            {formatTime(msg.createdAt)}
                          </p>
                          {isMe && getTickStatus(msg)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {typingText && (
            <div className="flex items-center gap-2.5 py-2 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#94A3B8] to-[#64748B] flex items-center justify-center text-white text-[10px] font-semibold shrink-0 ring-2 ring-white shadow-sm">
                {Array.from(typingUsers)[0] ? getInitials(
                  employeeMap[Array.from(typingUsers)[0]]?.firstName || "?",
                  employeeMap[Array.from(typingUsers)[0]]?.lastName || ""
                ) : "..."}
              </div>
              <div className="bg-white border border-[#E2E8F0] rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "0ms", animationDuration: "1s" }} />
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "200ms", animationDuration: "1s" }} />
                  <span className="w-1.5 h-1.5 bg-[#94A3B8] rounded-full animate-bounce" style={{ animationDelay: "400ms", animationDuration: "1s" }} />
                </div>
                <p className="text-[10px] text-[#94A3B8] mt-1 font-medium">{typingText}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
    </ErrorBoundary>
  );
}

export const MessageList = React.memo(MessageListInner);
