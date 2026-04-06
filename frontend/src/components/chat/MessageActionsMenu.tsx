"use client";

import { useState, useRef, useEffect } from "react";

interface MessageActionsMenuProps {
  messageId: string;
  conversationId: string;
  isOwnMessage: boolean;
  isAdmin: boolean;
  isPinned: boolean;
  onReplyInThread: () => void;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onUnpin: () => void;
  onForward: () => void;
  onCopyText: () => void;
  onBookmark: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  anchorPosition: { top: number; left: number };
  onClose: () => void;
}

const QUICK_REACTIONS = ["👍", "❤️", "😄", "😮", "😢", "🔥"];

export function MessageActionsMenu({
  isOwnMessage, isAdmin, isPinned,
  onReplyInThread, onReact, onPin, onUnpin, onForward, onCopyText, onBookmark,
  onEdit, onDelete, anchorPosition, onClose,
}: MessageActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Adjust position to stay on screen
  const top = Math.min(anchorPosition.top, window.innerHeight - 350);
  const left = Math.min(anchorPosition.left, window.innerWidth - 200);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 w-[200px]"
      style={{ top, left }}
    >
      {/* Quick reactions row */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100">
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            onClick={() => { onReact(emoji); onClose(); }}
            className="p-1 rounded hover:bg-slate-100 text-base transition-colors"
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Actions */}
      <MenuItem icon="💬" label="Reply in thread" onClick={() => { onReplyInThread(); onClose(); }} />
      <MenuItem icon="➡️" label="Forward" onClick={() => { onForward(); onClose(); }} />
      <MenuItem icon="📋" label="Copy text" onClick={() => { onCopyText(); onClose(); }} />
      <MenuItem icon="🔖" label="Save" onClick={() => { onBookmark(); onClose(); }} />
      <MenuItem
        icon={isPinned ? "📌" : "📌"}
        label={isPinned ? "Unpin" : "Pin"}
        onClick={() => { isPinned ? onUnpin() : onPin(); onClose(); }}
      />

      {isOwnMessage && onEdit && (
        <>
          <div className="h-px bg-slate-100 my-0.5" />
          <MenuItem icon="✏️" label="Edit" onClick={() => { onEdit(); onClose(); }} />
        </>
      )}

      {(isOwnMessage || isAdmin) && onDelete && (
        <MenuItem icon="🗑️" label="Delete" onClick={() => { onDelete(); onClose(); }} danger />
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="text-sm">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}
