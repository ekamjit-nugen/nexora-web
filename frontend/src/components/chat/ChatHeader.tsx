"use client";

import React from "react";
import type { Conversation, Employee } from "@/lib/api";
import { PresenceIndicator } from "@/components/chat";
import { getInitials } from "@/lib/utils";

export interface ChatHeaderProps {
  conversation: Conversation;
  user: { _id: string };
  employeeMap: Record<string, Employee>;
  onlineUserIds: Set<string>;
  presenceMap: Map<string, { status?: string; customText?: string }>;
  showCallWindow: boolean;
  showMembersPanel: boolean;
  showConvoMenu: boolean;
  onInitiateCall: () => void;
  onAddPeople: () => void;
  onToggleMembers: () => void;
  onToggleConvoMenu: () => void;
  onPin: () => void;
  onMute: () => void;
  onLeave: () => void;
}

function ChatHeaderInner({
  conversation,
  user,
  employeeMap,
  onlineUserIds,
  presenceMap,
  showCallWindow,
  showMembersPanel,
  showConvoMenu,
  onInitiateCall,
  onAddPeople,
  onToggleMembers,
  onToggleConvoMenu,
  onPin,
  onMute,
  onLeave,
}: ChatHeaderProps) {
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

  return (
    <div className="h-[60px] flex items-center justify-between px-5 border-b border-[#E2E8F0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-semibold shadow-sm ${
            conversation.type === "direct" ? "bg-[#2E86C1]" : conversation.type === "channel" ? "bg-[#7C3AED]" : "bg-[#0D9488]"
          }`}>
            {conversation.type === "direct" ? getConversationInitials(conversation) : conversation.type === "channel" ? (
              <span className="text-sm font-bold">#</span>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          {conversation.type === "direct" && (() => {
            const otherUserId = conversation.participants.find(p => p.userId !== user._id)?.userId || "";
            const presence = presenceMap.get(otherUserId);
            const status = presence?.status || (onlineUserIds.has(otherUserId) ? "online" : "offline");
            return status !== "offline" ? (
              <PresenceIndicator status={status} size="md" className="absolute -bottom-0.5 -right-0.5" />
            ) : null;
          })()}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#0F172A]">{getConversationDisplayName(conversation)}</p>
          <p className="text-[11px] text-[#94A3B8] truncate max-w-[300px]">
            {conversation.type === "direct"
              ? (() => {
                  const otherUserId = conversation.participants.find(p => p.userId !== user._id)?.userId || "";
                  const presence = presenceMap.get(otherUserId);
                  if (presence?.customText) return presence.customText;
                  const status = presence?.status || (onlineUserIds.has(otherUserId) ? "online" : "offline");
                  return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
                })()
              : getParticipantNames(conversation, 4)
            }
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {conversation.type === "direct" && (
          <button
            onClick={onInitiateCall}
            disabled={showCallWindow}
            className="p-2 text-[#475569] hover:bg-[#F1F5F9] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            title="Call"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </button>
        )}
        {conversation.type === "direct" && (
          <button
            onClick={onAddPeople}
            className="p-2 text-[#475569] hover:bg-[#F1F5F9] rounded-lg transition-colors"
            title="Add People"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
        )}
        {conversation.type !== "direct" && (
          <button
            onClick={onToggleMembers}
            className={`p-2 rounded-lg transition-colors ${showMembersPanel ? "bg-[#EBF5FF] text-[#2E86C1]" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}
            title="Members"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </button>
        )}
        <div className="relative">
          <button
            onClick={onToggleConvoMenu}
            className="p-2 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
            </svg>
          </button>
          {showConvoMenu && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-lg border border-[#E2E8F0] py-1 z-50">
              <button onClick={onPin} className="w-full text-left px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                {conversation.isPinned ? "Unpin" : "Pin"} conversation
              </button>
              <button onClick={onMute} className="w-full text-left px-3 py-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                Mute conversation
              </button>
              {conversation.type !== "direct" && (
                <button onClick={onLeave} className="w-full text-left px-3 py-2 text-[12px] text-red-500 hover:bg-red-50 transition-colors">
                  Leave conversation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const ChatHeader = React.memo(ChatHeaderInner);
