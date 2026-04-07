"use client";

import React, { useMemo } from "react";
import type { Conversation, Employee } from "@/lib/api";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { getInitials } from "@/lib/utils";

// ── Helpers ──

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

export type TabFilter = "all" | "direct" | "group" | "channel";

export interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreateChat: () => void;
  onCreateGroup: () => void;
  onCreateChannel: () => void;
  onToggleSettings: () => void;
  showSettingsPanel: boolean;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  tab: TabFilter;
  onTabChange: (t: TabFilter) => void;
  user: { _id: string; email?: string };
  employeeMap: Record<string, Employee>;
  onlineUserIds: Set<string>;
  loadingConvos: boolean;
}

function ConversationSidebarInner({
  conversations,
  activeId,
  onSelect,
  onCreateChat,
  onCreateGroup,
  onCreateChannel,
  onToggleSettings,
  showSettingsPanel,
  searchQuery,
  onSearchQueryChange,
  tab,
  onTabChange,
  user,
  employeeMap,
  onlineUserIds,
  loadingConvos,
}: ConversationSidebarProps) {
  // ── Name resolution helpers ──
  const getEmployeeName = (userId: string): string => {
    const emp = employeeMap[userId];
    if (emp) return `${emp.firstName} ${emp.lastName}`;
    return userId.slice(-6);
  };

  const getConversationDisplayName = (convo: Conversation): string => {
    if (convo.type === "direct") {
      const other = convo.participants.find((p) => p.userId !== user._id);
      if (other) return getEmployeeName(other.userId);
      return convo.name || "Direct Message";
    }
    if (convo.type === "channel") return `# ${convo.name || "channel"}`;
    return convo.name || "Group";
  };

  const getConversationInitials = (convo: Conversation): string => {
    if (convo.type === "direct") {
      const other = convo.participants.find((p) => p.userId !== user._id);
      if (other) {
        const emp = employeeMap[other.userId];
        if (emp) return getInitials(emp.firstName, emp.lastName);
      }
      return "DM";
    }
    return convo.name ? convo.name.slice(0, 2).toUpperCase() : "GR";
  };

  const getParticipantNames = (convo: Conversation, max = 3): string => {
    const others = convo.participants
      .filter((p) => p.userId !== user._id)
      .map((p) => {
        const emp = employeeMap[p.userId];
        return emp ? emp.firstName : p.userId.slice(-4);
      });
    if (others.length <= max) return others.join(", ");
    return others.slice(0, max).join(", ") + ` +${others.length - max}`;
  };

  const isDirectConvoOnline = (convo: Conversation): boolean => {
    if (convo.type !== "direct") return false;
    const other = convo.participants.find((p) => p.userId !== user._id);
    return other ? onlineUserIds.has(other.userId) : false;
  };

  const hasUnread = (convo: Conversation): boolean => {
    const participant = convo.participants.find((p) => p.userId === user._id);
    if (!participant?.lastReadAt || !convo.lastMessage?.sentAt) return false;
    return new Date(convo.lastMessage.sentAt) > new Date(participant.lastReadAt);
  };

  // ── Filter & sort conversations (memoized) ──
  const filteredConversations = useMemo(() =>
    conversations
      .filter((c) => {
        if (tab !== "all" && c.type !== tab) return false;
        if (searchQuery) {
          const name = getConversationDisplayName(c).toLowerCase();
          return name.includes(searchQuery.toLowerCase());
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aTime = a.lastMessage?.sentAt || a.createdAt;
        const bTime = b.lastMessage?.sentAt || b.createdAt;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      }),
    [conversations, tab, searchQuery, employeeMap, user._id], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="w-[300px] border-r border-[#E2E8F0] bg-white flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-[#E2E8F0] bg-gradient-to-b from-white to-[#FAFBFC] shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[#0F172A]">Chat</h2>
            <button
              onClick={onToggleSettings}
              className={`p-1 rounded-lg transition-colors ${showSettingsPanel ? "bg-[#EBF5FF] text-[#2E86C1]" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`}
              title="Chat Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={onCreateChat}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors"
              title="New Chat"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Chat
            </button>
            <button
              onClick={onCreateGroup}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors"
              title="New Group"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Group
            </button>
            <button
              onClick={onCreateChannel}
              className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-[#475569] bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] rounded-lg transition-colors"
              title="New Channel"
            >
              <span className="text-sm font-bold leading-none">#</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 bg-[#F1F5F9] rounded-lg p-0.5 mb-2.5" role="tablist" aria-label="Conversation type filter">
          {(["all", "direct", "group", "channel"] as TabFilter[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => onTabChange(t)}
              className={`flex-1 py-1.5 text-[11px] font-medium rounded-md transition-colors capitalize ${
                tab === t ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              {t === "all" ? "All" : t === "direct" ? "Direct" : t === "group" ? "Groups" : "Channels"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-[12px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#2E86C1] text-[#334155] placeholder:text-[#94A3B8]"
          />
        </div>
      </div>

      {/* Conversation List */}
      <ErrorBoundary>
      <div className="flex-1 overflow-y-auto">
        {loadingConvos ? (
          <div className="py-2">
            <SkeletonLoader variant="conversation" count={8} />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-[13px] font-medium text-[#334155] mb-1">No conversations yet</p>
            <p className="text-[12px] text-[#94A3B8]">Start a conversation with a colleague</p>
            <button
              onClick={onCreateChat}
              className="mt-3 px-4 py-1.5 text-[12px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors"
            >
              New Chat
            </button>
          </div>
        ) : (
          filteredConversations.map((convo) => {
            const isActive = convo._id === activeId;
            const unread = hasUnread(convo);
            const displayName = getConversationDisplayName(convo);
            const initials = getConversationInitials(convo);
            const lastMsgTime = convo.lastMessage?.sentAt || convo.createdAt;
            const isOnline = isDirectConvoOnline(convo);

            return (
              <button
                key={convo._id}
                onClick={() => onSelect(convo._id)}
                className={`w-full text-left px-3 py-3 transition-colors hover:bg-[#F1F5F9] ${
                  isActive ? "bg-[#EBF5FF] border-l-2 border-[#2E86C1]" : ""
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className="relative shrink-0 group/convo">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold ${
                      convo.type === "direct" ? "bg-[#2E86C1]" : convo.type === "channel" ? "bg-[#7C3AED]" : "bg-[#0D9488]"
                    }`}>
                      {convo.type === "direct" ? initials : convo.type === "channel" ? (
                        <span className="text-sm font-bold">#</span>
                      ) : (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </div>
                    {isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#22C55E] border-2 border-white rounded-full" />
                    )}
                    {/* Hover popup */}
                    {convo.type === "direct" && (() => {
                      const otherP = convo.participants.find((p) => p.userId !== user._id);
                      const otherEmp = otherP ? employeeMap[otherP.userId] : null;
                      return (
                        <div className="absolute top-full left-0 mt-2 hidden group-hover/convo:block z-50 pointer-events-none">
                          <div className="bg-[#0F172A] text-white rounded-lg px-3 py-2 shadow-xl min-w-[180px]">
                            <p className="text-[12px] font-semibold">{displayName}</p>
                            {otherEmp?.email && <p className="text-[10px] text-[#94A3B8]">{otherEmp.email}</p>}
                            {otherEmp?.location && <p className="text-[10px] text-[#94A3B8]">{otherEmp.location}</p>}
                            <div className="flex items-center gap-1 mt-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-[#22C55E]" : "bg-[#94A3B8]"}`} />
                              <span className="text-[10px] text-[#94A3B8]">{isOnline ? "Online" : "Offline"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1 min-w-0">
                        {convo.isPinned && (
                          <svg className="w-3 h-3 text-[#94A3B8] shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 2a.75.75 0 01.75.75v.258a33.186 33.186 0 016.668.83.75.75 0 01-.336 1.461 31.28 31.28 0 00-1.103-.232l1.702 7.545a.75.75 0 01-.387.832A4.981 4.981 0 0115 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.77-7.849a31.743 31.743 0 00-3.339-.254V17.5h2.25a.75.75 0 010 1.5h-6a.75.75 0 010-1.5h2.25V4.509a31.743 31.743 0 00-3.339.254l1.77 7.849a.75.75 0 01-.387.832A4.981 4.981 0 015 14c-.825 0-1.606-.2-2.294-.556a.75.75 0 01-.387-.832l1.702-7.545c-.372.07-.74.148-1.103.232a.75.75 0 01-.336-1.462 33.186 33.186 0 016.668-.829V2.75A.75.75 0 0110 2z" />
                          </svg>
                        )}
                        <p className={`text-[13px] font-medium truncate ${isActive ? "text-[#2E86C1]" : "text-[#0F172A]"}`}>
                          {displayName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-[#94A3B8]">{timeAgo(lastMsgTime)}</span>
                        {unread && <span className="w-2 h-2 rounded-full bg-[#2E86C1]" />}
                      </div>
                    </div>
                    {convo.lastMessage ? (
                      <p className="text-[11px] text-[#94A3B8] truncate mt-0.5">
                        {convo.lastMessage.senderId === user._id ? "You: " : ""}
                        {convo.lastMessage.content}
                      </p>
                    ) : convo.type !== "direct" ? (
                      <p className="text-[10px] text-[#CBD5E1] truncate mt-0.5">
                        {getParticipantNames(convo, 3)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
      </ErrorBoundary>
    </div>
  );
}

export const ConversationSidebar = React.memo(ConversationSidebarInner);
