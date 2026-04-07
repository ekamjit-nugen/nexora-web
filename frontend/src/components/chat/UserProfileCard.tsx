"use client";

import { useState, useEffect, useRef } from "react";
import { PresenceIndicator } from "./PresenceIndicator";
import { getInitials } from "@/lib/utils";

interface UserInfo {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle?: string;
  department?: string;
  avatar?: string;
  timezone?: string;
}

interface EmployeeEntry {
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  department?: string;
  designation?: string;
  email?: string;
  avatar?: string;
  jobTitle?: string;
  timezone?: string;
  location?: string;
}

interface UserProfileCardProps {
  userId: string;
  presenceStatus?: string;
  customStatusText?: string;
  employeeMap: Record<string, EmployeeEntry>;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onMessage: (userId: string) => void;
  onCall: (userId: string) => void;
}

function getLocalTime(timezone?: string): string {
  try {
    if (!timezone) return "";
    return new Date().toLocaleTimeString("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function UserProfileCard({
  userId, presenceStatus, customStatusText, employeeMap, anchorEl, onClose, onMessage, onCall,
}: UserProfileCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const user = employeeMap[userId];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node) && anchorEl && !anchorEl.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, anchorEl]);

  if (!user || !anchorEl) return null;

  // Position card near the anchor element
  const rect = anchorEl.getBoundingClientRect();
  const top = Math.min(rect.bottom + 8, window.innerHeight - 260);
  const left = Math.min(rect.left, window.innerWidth - 300);

  const localTime = getLocalTime(user.timezone);
  const status = presenceStatus || "offline";

  return (
    <div
      ref={cardRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 w-[280px] overflow-hidden"
      style={{ top, left }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 pt-4 pb-8" />

      {/* Avatar */}
      <div className="px-4 -mt-6">
        <div className="relative inline-block">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-white" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center text-blue-700 text-sm font-bold">
              {getInitials(user.firstName, user.lastName)}
            </div>
          )}
          <PresenceIndicator status={status} size="md" className="absolute -bottom-0.5 -right-0.5" />
        </div>
      </div>

      {/* Info */}
      <div className="px-4 pt-2 pb-3">
        <h4 className="text-sm font-semibold text-slate-800">{user.firstName} {user.lastName}</h4>
        {user.jobTitle && <p className="text-xs text-slate-500">{user.jobTitle}</p>}
        {user.department && <p className="text-xs text-slate-400">{user.department}</p>}

        {/* Status */}
        <div className="flex items-center gap-1.5 mt-2">
          <PresenceIndicator status={status} size="sm" />
          <span className="text-xs text-slate-500">
            {customStatusText || status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
          </span>
        </div>

        {/* Local time */}
        {localTime && (
          <p className="text-[10px] text-slate-400 mt-1">Local time: {localTime}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-slate-100">
        <button
          onClick={() => { onMessage(userId); onClose(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 hover:bg-blue-50 transition-colors font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Message
        </button>
        <div className="w-px bg-slate-100" />
        <button
          onClick={() => { onCall(userId); onClose(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-green-600 hover:bg-green-50 transition-colors font-medium"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          Call
        </button>
      </div>
    </div>
  );
}
