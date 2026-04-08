"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { chatApi } from "@/lib/api";
import { toast } from "sonner";

interface MessageActionsMenuProps {
  messageId: string;
  conversationId: string;
  messageContent: string;
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
  onTranslate?: (messageId: string, targetLanguage: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  anchorPosition: { top: number; left: number };
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
}

const QUICK_REACTIONS = ["👍", "❤️", "😄", "😮", "😢", "🔥"];

export function MessageActionsMenu({
  messageId, conversationId, messageContent,
  isOwnMessage, isAdmin, isPinned,
  onReplyInThread, onReact, onPin, onUnpin, onForward, onCopyText, onBookmark,
  onTranslate, onEdit, onDelete, anchorPosition, onClose, triggerRef,
}: MessageActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  // Focus first menu item on mount
  useEffect(() => {
    const firstItem = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]');
    firstItem?.focus();
  }, []);

  // Return focus to trigger on close
  const handleClose = useCallback(() => {
    triggerRef?.current?.focus();
    onClose();
  }, [onClose, triggerRef]);

  // Keyboard navigation: Arrow Up/Down to move, Enter to select, Escape to close
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;
    const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case "Escape":
        e.preventDefault();
        handleClose();
        break;
      case "Tab":
        e.preventDefault(); // Trap focus within menu
        break;
    }
  }, [handleClose]);

  // Adjust position to stay on screen
  const top = Math.min(anchorPosition.top, window.innerHeight - 350);
  const left = Math.min(anchorPosition.left, window.innerWidth - 200);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Message actions"
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 w-[200px]"
      style={{ top, left }}
      onKeyDown={handleKeyDown}
    >
      {/* Quick reactions row */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-100" role="group" aria-label="Quick reactions">
        {QUICK_REACTIONS.map(emoji => (
          <button
            key={emoji}
            role="menuitem"
            onClick={() => { onReact(emoji); handleClose(); }}
            className="p-1 rounded hover:bg-slate-100 text-base transition-colors"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      {/* Actions */}
      <MenuItem icon="💬" label="Reply in thread" onClick={() => { onReplyInThread(); handleClose(); }} />
      <MenuItem icon="➡️" label="Forward" onClick={() => { onForward(); handleClose(); }} />
      <MenuItem icon="📋" label="Copy text" onClick={() => { onCopyText(); handleClose(); }} />
      <MenuItem icon="🔖" label="Save" onClick={() => { onBookmark(); handleClose(); }} />
      <ReminderMenuItem messageId={messageId} conversationId={conversationId} onClose={handleClose} />
      {onTranslate && (
        <TranslateMenuItem messageId={messageId} onTranslate={onTranslate} onClose={handleClose} />
      )}
      <MenuItem
        icon={isPinned ? "📌" : "📌"}
        label={isPinned ? "Unpin" : "Pin"}
        onClick={() => { isPinned ? onUnpin() : onPin(); handleClose(); }}
      />

      {isOwnMessage && onEdit && (
        <>
          <div className="h-px bg-slate-100 my-0.5" />
          <MenuItem icon="✏️" label="Edit" onClick={() => { onEdit(); handleClose(); }} />
        </>
      )}

      {(isOwnMessage || isAdmin) && onDelete && (
        <MenuItem icon="🗑️" label="Delete" onClick={() => { onDelete(); handleClose(); }} danger />
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs transition-colors ${
        danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="text-sm" aria-hidden="true">{icon}</span>
      <span className="font-medium">{label}</span>
    </button>
  );
}

function ReminderMenuItem({ messageId, conversationId, onClose }: { messageId: string; conversationId: string; onClose: () => void }) {
  const [showSub, setShowSub] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const getReminderOptions = () => {
    const now = new Date();
    const in30 = new Date(now.getTime() + 30 * 60 * 1000);
    const in1h = new Date(now.getTime() + 60 * 60 * 1000);
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const nextMonday = new Date(now);
    const daysUntilMon = ((8 - nextMonday.getDay()) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMon);
    nextMonday.setHours(9, 0, 0, 0);
    return [
      { label: "In 30 minutes", date: in30 },
      { label: "In 1 hour", date: in1h },
      { label: "In 3 hours", date: in3h },
      { label: "Tomorrow", date: tomorrow },
      { label: "Next week", date: nextMonday },
    ];
  };

  const handleSetReminder = async (date: Date) => {
    try {
      await chatApi.createReminder({ messageId, conversationId, reminderAt: date.toISOString() });
      const timeStr = date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
      toast.success(`Reminder set for ${timeStr}`);
      onClose();
    } catch {
      toast.error("Failed to set reminder");
    }
  };

  const handleCustomConfirm = () => {
    if (!customDate || !customTime) { toast.error("Select both date and time"); return; }
    const dt = new Date(`${customDate}T${customTime}`);
    if (dt <= new Date()) { toast.error("Reminder must be in the future"); return; }
    handleSetReminder(dt);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowSub(!showSub)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm">{"⏰"}</span>
        <span className="font-medium">Remind me</span>
        <svg className="w-3 h-3 ml-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      {showSub && (
        <div className="absolute left-full top-0 ml-1 w-[200px] bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50">
          {getReminderOptions().map((opt) => (
            <button key={opt.label} onClick={() => handleSetReminder(opt.date)} className="w-full flex items-center px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors">
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
          <div className="h-px bg-slate-100 my-0.5" />
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-blue-600 hover:bg-blue-50 transition-colors">
              <span className="font-medium">Custom...</span>
            </button>
          ) : (
            <div className="px-3 py-2 space-y-1.5">
              <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400" />
              <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="w-full px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400" />
              <button onClick={handleCustomConfirm} className="w-full px-2 py-1 text-[10px] font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors">Set reminder</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const TRANSLATE_LANGUAGES = [
  { code: "English", label: "English" },
  { code: "Spanish", label: "Spanish" },
  { code: "French", label: "French" },
  { code: "German", label: "German" },
  { code: "Chinese", label: "Chinese" },
  { code: "Japanese", label: "Japanese" },
  { code: "Hindi", label: "Hindi" },
  { code: "Arabic", label: "Arabic" },
  { code: "Portuguese", label: "Portuguese" },
  { code: "Korean", label: "Korean" },
];

function TranslateMenuItem({ messageId, onTranslate, onClose }: { messageId: string; onTranslate: (messageId: string, targetLanguage: string) => void; onClose: () => void }) {
  const [showSub, setShowSub] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowSub(!showSub)}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <span className="text-sm">{"🌐"}</span>
        <span className="font-medium">Translate</span>
        <svg className="w-3 h-3 ml-auto text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      {showSub && (
        <div className="absolute left-full top-0 ml-1 w-[160px] bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50 max-h-[280px] overflow-y-auto">
          {TRANSLATE_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => { onTranslate(messageId, lang.code); onClose(); }}
              className="w-full flex items-center px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span className="font-medium">{lang.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
