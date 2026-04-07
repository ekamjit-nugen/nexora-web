"use client";

import { PresenceIndicator } from "./PresenceIndicator";
import { getInitials } from "@/lib/utils";

interface Participant {
  userId: string;
  role: string;
  joinedAt: string;
}

interface EmployeeEntry {
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  department?: string;
  designation?: string;
  email?: string;
}

interface ChannelMembersListProps {
  participants: Participant[];
  employeeMap: Record<string, EmployeeEntry>;
  onlineUserIds: Set<string>;
  presenceMap: Map<string, { status: string; customText?: string }>;
  onMessage: (userId: string) => void;
  onCall: (userId: string) => void;
  onClose: () => void;
  currentUserId: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "",
};

export function ChannelMembersList({
  participants, employeeMap, onlineUserIds, presenceMap, onMessage, onCall, onClose, currentUserId,
}: ChannelMembersListProps) {
  // Sort: online first, then by role (owner > admin > member), then alphabetical
  const sorted = [...participants].sort((a, b) => {
    const aOnline = onlineUserIds.has(a.userId) ? 1 : 0;
    const bOnline = onlineUserIds.has(b.userId) ? 1 : 0;
    if (bOnline !== aOnline) return bOnline - aOnline;

    const roleOrder = { owner: 0, admin: 1, member: 2 };
    const aRole = roleOrder[a.role as keyof typeof roleOrder] ?? 2;
    const bRole = roleOrder[b.role as keyof typeof roleOrder] ?? 2;
    if (aRole !== bRole) return aRole - bRole;

    const aName = employeeMap[a.userId]?.firstName || "";
    const bName = employeeMap[b.userId]?.firstName || "";
    return aName.localeCompare(bName);
  });

  const onlineCount = participants.filter(p => onlineUserIds.has(p.userId)).length;

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-[300px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Members</h3>
          <p className="text-xs text-slate-400">{participants.length} total, {onlineCount} online</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded text-slate-400">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Member list */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map(p => {
          const emp = employeeMap[p.userId];
          const presence = presenceMap.get(p.userId);
          const status = presence?.status || (onlineUserIds.has(p.userId) ? "online" : "offline");
          const isMe = p.userId === currentUserId;
          const roleLabel = ROLE_LABELS[p.role];

          return (
            <div key={p.userId} className="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 group">
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600">
                  {emp ? getInitials(emp.firstName, emp.lastName) : "?"}
                </div>
                <PresenceIndicator status={status} size="sm" className="absolute -bottom-0.5 -right-0.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-slate-800 truncate font-medium">
                    {emp ? `${emp.firstName} ${emp.lastName}` : p.userId.slice(-6)}
                  </span>
                  {isMe && <span className="text-[10px] text-slate-400">(you)</span>}
                  {roleLabel && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{roleLabel}</span>
                  )}
                </div>
                {presence?.customText && (
                  <p className="text-[10px] text-slate-400 truncate">{presence.customText}</p>
                )}
              </div>
              {!isMe && (
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button onClick={() => onMessage(p.userId)} className="p-1 rounded hover:bg-slate-200 text-slate-400" title="Message">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </button>
                  <button onClick={() => onCall(p.userId)} className="p-1 rounded hover:bg-slate-200 text-slate-400" title="Call">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72"/></svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
