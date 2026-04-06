"use client";

import { useState, useEffect } from "react";

interface LobbyEntry {
  userId?: string;
  name: string;
  email?: string;
  requestedAt: string;
}

interface MeetingLobbyProps {
  isHost: boolean;
  lobbyQueue: LobbyEntry[];
  lobbyMessage?: string;
  onAdmit: (userId: string) => void;
  onAdmitAll: () => void;
  onDeny: (userId: string) => void;
  onLeave: () => void;
  isWaiting?: boolean;
}

export function MeetingLobby({ isHost, lobbyQueue, lobbyMessage, onAdmit, onAdmitAll, onDeny, onLeave, isWaiting }: MeetingLobbyProps) {
  // Waiting screen for non-hosts
  if (isWaiting) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-semibold mb-2">Waiting to be admitted</h2>
          <p className="text-slate-400 text-sm mb-2">
            {lobbyMessage || "The host will let you in soon."}
          </p>
          <p className="text-slate-500 text-xs mb-8">
            Please wait while the meeting host reviews your request.
          </p>
          <button
            onClick={onLeave}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </div>
    );
  }

  // Host view: show lobby queue
  if (!isHost || lobbyQueue.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-30 bg-slate-800/95 backdrop-blur-sm rounded-xl shadow-2xl w-72 border border-slate-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-white">Lobby</span>
          <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
            {lobbyQueue.length}
          </span>
        </div>
        {lobbyQueue.length > 1 && (
          <button
            onClick={onAdmitAll}
            className="text-xs text-blue-400 hover:text-blue-300 font-medium"
          >
            Admit all
          </button>
        )}
      </div>
      <div className="max-h-60 overflow-y-auto">
        {lobbyQueue.map((entry, i) => (
          <div key={entry.userId || i} className="flex items-center justify-between px-4 py-2 hover:bg-slate-700/50">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {entry.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{entry.name}</p>
                {entry.email && <p className="text-xs text-slate-400 truncate">{entry.email}</p>}
              </div>
            </div>
            <div className="flex gap-1 shrink-0 ml-2">
              <button
                onClick={() => entry.userId && onAdmit(entry.userId)}
                className="p-1.5 rounded bg-green-600 hover:bg-green-700 text-white transition-colors"
                title="Admit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button
                onClick={() => entry.userId && onDeny(entry.userId)}
                className="p-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
                title="Deny"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
