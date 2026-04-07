"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import { GifPicker } from "@/components/chat";
import { toast } from "sonner";

// Full emoji set organized by category
const EMOJI_CATEGORIES: Record<string, string[]> = {
  "Smileys": ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🫡", "🤐", "🤨", "😐", "😑", "😶", "🫥", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🥴", "😵", "🤯", "🥳", "🥸", "😎", "🤓", "🧐", "😕", "🫤", "😟", "🙁", "😮", "😯", "😲", "😳", "🥺", "🥹", "😦", "😧", "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫", "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "☠️", "💩", "🤡", "👹", "👺", "👻", "👽", "👾", "🤖"],
  "Gestures": ["👋", "🤚", "🖐️", "✋", "🖖", "🫱", "🫲", "🫳", "🫴", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘", "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "🫵", "👍", "👎", "✊", "👊", "🤛", "🤜", "👏", "🙌", "🫶", "👐", "🤲", "🤝", "🙏", "💪", "🦾"],
  "Hearts": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "❤️‍🔥", "❤️‍🩹", "💋", "💯", "💢", "💥", "💫", "💦", "💤"],
  "People": ["👶", "👧", "🧒", "👦", "👩", "🧑", "👨", "👩‍🦱", "🧑‍🦱", "👨‍🦱", "👩‍🦰", "🧑‍🦰", "👨‍🦰", "👱‍♀️", "👱", "👱‍♂️", "👩‍🦳", "🧑‍🦳", "👨‍🦳", "👩‍🦲", "🧑‍🦲", "👨‍🦲", "🧔‍♀️", "🧔", "🧔‍♂️", "👵", "🧓", "👴", "👲", "👳‍♀️", "👳", "👳‍♂️", "🧕", "👮‍♀️", "👮", "👷‍♀️", "👷", "💂‍♀️", "💂", "🕵️‍♀️", "🕵️"],
  "Nature": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐻‍❄️", "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐒", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅", "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞", "🌸", "💐", "🌹", "🥀", "🌺", "🌻", "🌼", "🌷", "🌱", "🪴", "🌲", "🌳", "🌴", "🌵", "🌾", "🍀", "🍁", "🍂", "🍃"],
  "Food": ["🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒", "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🍆", "🌶️", "🫑", "🥒", "🥬", "🥦", "🧅", "🍄", "🥜", "🫘", "🌰", "🍞", "🥐", "🥖", "🫓", "🥨", "🥯", "🥞", "🧇", "🧀", "🍖", "🍗", "🥩", "🥓", "🍔", "🍟", "🍕", "🌭", "🥪", "🌮", "🌯", "🫔", "🥙", "🧆", "🥚", "🍳", "🥘", "🍲", "🫕", "🥣", "🥗", "🍿", "🧈", "🍱", "🍘", "🍙", "🍚", "🍛", "🍜", "🍝", "🍠", "🍢", "🍣", "🍤", "🍥", "🥮", "🍡", "🥟", "🥠", "🥡", "🦀", "🦞", "🦐", "🦑", "🦪", "🍦", "🍧", "🍨", "🍩", "🍪", "🎂", "🍰", "🧁", "🥧", "🍫", "🍬", "🍭", "🍮", "🍯", "☕", "🍵", "🫖", "🧃", "🥤", "🧋", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🍾", "🧊"],
  "Activities": ["⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓", "🏸", "🏒", "🏑", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊", "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🎯", "🎮", "🕹️", "🎰", "🎲", "🧩", "🎭", "🎨", "🎪", "🎤", "🎧", "🎼", "🎹", "🥁", "🪘", "🎷", "🎺", "🪗", "🎸", "🪕", "🎻", "🎬", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🏵️", "🎗️", "🎫", "🎟️"],
  "Travel": ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚", "🚛", "🚜", "🏍️", "🛵", "🚲", "🛴", "🛺", "✈️", "🛫", "🛬", "🚀", "🛸", "🚁", "⛵", "🚢", "🏠", "🏡", "🏢", "🏣", "🏤", "🏥", "🏦", "🏨", "🏩", "🏪", "🏫", "🏬", "🏭", "🗼", "🗽", "⛪", "🕌", "🛕", "🕍", "⛩️", "🌍", "🌎", "🌏", "🌐", "🗺️", "🧭", "⛰️", "🏔️", "🌋", "🗻"],
  "Objects": ["⌚", "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "🖲️", "💽", "💾", "💿", "📀", "🎥", "📷", "📸", "📹", "📼", "🔍", "🔎", "🕯️", "💡", "🔦", "📔", "📕", "📖", "📗", "📘", "📙", "📚", "📓", "📒", "📃", "📜", "📄", "📰", "🗞️", "📑", "🔖", "🏷️", "💰", "🪙", "💴", "💵", "💶", "💷", "💸", "💳", "🧾", "✉️", "📧", "📨", "📩", "📤", "📥", "📦", "📫", "📪", "📬", "📭", "📮", "🗳️", "✏️", "✒️", "🖋️", "🖊️", "🖌️", "🖍️", "📝", "📁", "📂", "🗂️", "🗄️", "🔒", "🔓", "🔑", "🗝️"],
  "Symbols": ["🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "🟤", "⚫", "⚪", "🔶", "🔷", "🔸", "🔹", "❗", "❓", "❕", "❔", "‼️", "⁉️", "✅", "❌", "⭕", "🚫", "💯", "🔥", "⭐", "🌟", "✨", "⚡", "💥", "💫", "🎵", "🎶", "➕", "➖", "➗", "✖️", "♾️", "💲", "🔱", "🔰", "⚜️", "🔘", "🔳", "🔲", "▪️", "▫️", "◾", "◽", "◼️", "◻️", "🟥", "🟧", "🟨", "🟩", "🟦", "🟪", "🟫", "⬛", "⬜"],
  "Flags": ["🏳️", "🏴", "🏁", "🚩", "🏳️‍🌈", "🏳️‍⚧️", "🇺🇸", "🇬🇧", "🇨🇦", "🇦🇺", "🇩🇪", "🇫🇷", "🇪🇸", "🇮🇹", "🇯🇵", "🇰🇷", "🇨🇳", "🇮🇳", "🇧🇷", "🇲🇽", "🇷🇺", "🇿🇦", "🇳🇬", "🇪🇬", "🇸🇦", "🇦🇪", "🇹🇷", "🇮🇩", "🇹🇭", "🇻🇳", "🇵🇭", "🇸🇬", "🇲🇾", "🇳🇿", "🇸🇪", "🇳🇴", "🇩🇰", "🇫🇮", "🇮🇪", "🇵🇹", "🇬🇷", "🇵🇱", "🇨🇭", "🇦🇹", "🇧🇪", "🇳🇱", "🇦🇷", "🇨🇱", "🇨🇴", "🇵🇪"],
};

export interface ChatInputProps {
  input: string;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onTyping: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onGifSelect: (url: string) => void;
  onPaste: (e: React.ClipboardEvent) => void;
  isUploading: boolean;
  uploadProgress: { fileName: string; percent: number } | null;
  onCancelUpload: () => void;
  scheduledAt: Date | null;
  onScheduledAtChange: (d: Date | null) => void;
  smartReplies: string[];
  onSmartReplySelect: (reply: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function ChatInputInner({
  input,
  onInputChange,
  onSend,
  onTyping,
  onFileSelect,
  onGifSelect,
  onPaste,
  isUploading,
  uploadProgress,
  onCancelUpload,
  scheduledAt,
  onScheduledAtChange,
  smartReplies,
  onSmartReplySelect,
  textareaRef,
  fileInputRef,
}: ChatInputProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showCustomSchedule, setShowCustomSchedule] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [customTime, setCustomTime] = useState("");

  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const gifPickerRef = useRef<HTMLDivElement>(null);
  const schedulePickerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input, textareaRef]);

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  // Close GIF picker on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (gifPickerRef.current && !gifPickerRef.current.contains(e.target as Node)) {
        setShowGifPicker(false);
      }
    };
    if (showGifPicker) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showGifPicker]);

  // Close schedule picker on outside click
  useEffect(() => {
    if (!showSchedulePicker) return;
    const handler = (e: MouseEvent) => {
      if (schedulePickerRef.current && !schedulePickerRef.current.contains(e.target as Node)) {
        setShowSchedulePicker(false);
        setShowCustomSchedule(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSchedulePicker]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const getScheduleOptions = () => {
    const now = new Date();
    const laterToday = new Date(now);
    laterToday.setHours(laterToday.getHours() + 1, 0, 0, 0);
    const tomorrowMorning = new Date(now);
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(9, 0, 0, 0);
    const tomorrowAfternoon = new Date(now);
    tomorrowAfternoon.setDate(tomorrowAfternoon.getDate() + 1);
    tomorrowAfternoon.setHours(14, 0, 0, 0);
    const nextMonday = new Date(now);
    const daysUntilMonday = ((8 - nextMonday.getDay()) % 7) || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    nextMonday.setHours(9, 0, 0, 0);
    return [
      { label: "Later today", sublabel: laterToday.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), date: laterToday },
      { label: "Tomorrow morning", sublabel: "9:00 AM", date: tomorrowMorning },
      { label: "Tomorrow afternoon", sublabel: "2:00 PM", date: tomorrowAfternoon },
      { label: "Next Monday", sublabel: "Mon 9:00 AM", date: nextMonday },
    ];
  };

  const handleSelectSchedule = (date: Date) => {
    onScheduledAtChange(date);
    setShowSchedulePicker(false);
    setShowCustomSchedule(false);
  };

  const handleCustomScheduleConfirm = () => {
    if (!customDate || !customTime) { toast.error("Select both date and time"); return; }
    const dt = new Date(`${customDate}T${customTime}`);
    if (dt <= new Date()) { toast.error("Scheduled time must be in the future"); return; }
    handleSelectSchedule(dt);
  };

  const handleGifSelectInternal = useCallback((gifUrl: string) => {
    onGifSelect(gifUrl);
    setShowGifPicker(false);
  }, [onGifSelect]);

  return (
    <>
      {/* Upload progress bar */}
      {uploadProgress && (
        <div className="px-5 pb-1 bg-[#F8FAFC] shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-[#EBF5FF] border border-[#BFDBFE] rounded-xl">
            <svg className="w-4 h-4 text-[#2E86C1] animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-medium text-[#2E86C1] truncate">{uploadProgress.fileName}</span>
                <span className="text-[10px] text-[#64748B] shrink-0 ml-2">{uploadProgress.percent}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#BFDBFE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2E86C1] rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
            <button
              onClick={onCancelUpload}
              className="p-1 rounded hover:bg-blue-200/60 text-[#64748B] hover:text-red-500 transition-colors shrink-0"
              title="Cancel upload"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {/* Upload spinner (fallback) */}
      {isUploading && !uploadProgress && (
        <div className="px-5 pb-1 bg-[#F8FAFC] shrink-0">
          <div className="flex items-center gap-2.5 px-4 py-2.5 bg-[#EBF5FF] border border-[#BFDBFE] rounded-xl">
            <svg className="w-4 h-4 text-[#2E86C1] animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-[12px] font-medium text-[#2E86C1]">Uploading file...</span>
          </div>
        </div>
      )}

      {/* Smart Reply Suggestions */}
      {smartReplies.length > 0 && (
        <div className="px-5 pb-1 pt-1 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {smartReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => onSmartReplySelect(reply)}
                className="px-3 py-1.5 text-[12px] text-[#2E86C1] bg-[#EBF5FF] hover:bg-[#D6EBFA] border border-[#BEE0F7] rounded-full transition-colors font-medium truncate max-w-[200px]"
                title={reply}
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-5 pb-4 pt-2 bg-gradient-to-t from-[#F1F5F9] to-[#F8FAFC] shrink-0">
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv" onChange={onFileSelect} />
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm shadow-[#E2E8F0]/60">
          <div className="flex items-end gap-1 px-3 py-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => { onInputChange(e.target.value); onTyping(); }}
              onKeyDown={handleKeyDown}
              onPaste={onPaste}
              placeholder={isUploading ? "Uploading file..." : "Type a message..."}
              disabled={isUploading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-[13px] text-[#334155] placeholder:text-[#94A3B8] focus:outline-none py-1.5 max-h-[120px] disabled:opacity-50"
            />
            {/* Schedule message button */}
            <div className="relative" ref={schedulePickerRef}>
              <button onClick={() => setShowSchedulePicker(!showSchedulePicker)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors shrink-0 ${scheduledAt ? "bg-[#F59E0B] hover:bg-[#D97706] text-white" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`} title={scheduledAt ? `Scheduled: ${scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}` : "Schedule message"}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </button>
              {showSchedulePicker && (
                <div className="absolute bottom-full mb-2 right-0 w-[240px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 py-1">
                  <p className="px-3 py-1.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Schedule send</p>
                  {getScheduleOptions().map((opt) => (
                    <button key={opt.label} onClick={() => handleSelectSchedule(opt.date)} className="w-full flex items-center justify-between px-3 py-2 text-left text-[12px] text-[#334155] hover:bg-[#F1F5F9] transition-colors">
                      <span className="font-medium">{opt.label}</span>
                      <span className="text-[10px] text-[#94A3B8]">{opt.sublabel}</span>
                    </button>
                  ))}
                  <div className="h-px bg-[#E2E8F0] my-0.5" />
                  {!showCustomSchedule ? (
                    <button onClick={() => setShowCustomSchedule(true)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] text-[#2E86C1] hover:bg-[#EBF5FF] transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
                      <span className="font-medium">Custom date &amp; time</span>
                    </button>
                  ) : (
                    <div className="px-3 py-2 space-y-2">
                      <input type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)} min={new Date().toISOString().split("T")[0]} className="w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1]" />
                      <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} className="w-full px-2 py-1.5 text-[12px] border border-[#E2E8F0] rounded-lg focus:outline-none focus:border-[#2E86C1]" />
                      <button onClick={handleCustomScheduleConfirm} className="w-full px-3 py-1.5 text-[11px] font-medium text-white bg-[#2E86C1] hover:bg-[#2471A3] rounded-lg transition-colors">Set time</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Send / Schedule send button */}
            <button onClick={onSend} disabled={!input.trim() || isUploading} className={`w-8 h-8 flex items-center justify-center rounded-full text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 ${scheduledAt ? "bg-[#F59E0B] hover:bg-[#D97706]" : "bg-[#2E86C1] hover:bg-[#2471A3]"}`} title={scheduledAt ? "Send scheduled message" : "Send message"}>
              {scheduledAt ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              )}
            </button>
          </div>
          {/* Scheduled time indicator */}
          {scheduledAt && (
            <div className="flex items-center gap-1.5 px-3 py-1 border-t border-[#FEF3C7] bg-[#FFFBEB] rounded-b-2xl">
              <svg className="w-3 h-3 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[11px] text-[#92400E] font-medium">Scheduling for: {scheduledAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              <button onClick={() => onScheduledAtChange(null)} className="ml-auto p-0.5 rounded hover:bg-[#FDE68A] text-[#92400E] transition-colors" title="Cancel scheduling">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          )}
          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-2 pb-1.5 pt-0.5 border-t border-[#F1F5F9]">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
              title="Attach file"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
              </svg>
            </button>
            <button
              onClick={() => {
                if (fileInputRef.current) {
                  fileInputRef.current.accept = "image/*";
                  fileInputRef.current.click();
                  fileInputRef.current.accept = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv";
                }
              }}
              className="p-1.5 rounded-md text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
              title="Send image"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
              </svg>
            </button>
            <div className="w-px h-4 bg-[#E2E8F0] mx-1" />
            {/* Emoji picker button */}
            <div className="relative" ref={emojiPickerRef}>
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className={`p-1.5 rounded-md transition-colors ${showEmojiPicker ? "text-[#2E86C1] bg-[#EBF5FF]" : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"}`}
                title="Emoji picker"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
                </svg>
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 right-0 w-[340px] max-h-[360px] bg-white border border-[#E2E8F0] rounded-xl shadow-xl z-50 flex flex-col overflow-hidden">
                  <div className="overflow-y-auto flex-1 p-3">
                    {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
                      <div key={category} className="mb-3">
                        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1.5">{category}</p>
                        <div className="flex flex-wrap gap-0.5">
                          {emojis.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => { onInputChange(input + emoji); }}
                              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-[#F1F5F9] transition-colors text-lg"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* GIF picker button */}
            <div className="relative" ref={gifPickerRef}>
              <button
                onClick={() => {
                  setShowGifPicker((prev) => !prev);
                  setShowEmojiPicker(false);
                }}
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors ${
                  showGifPicker
                    ? "text-[#2E86C1] bg-[#EBF5FF]"
                    : "text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
                title="GIF picker"
              >
                GIF
              </button>
              {showGifPicker && (
                <div className="absolute bottom-full mb-2 right-0">
                  <GifPicker onSelect={handleGifSelectInternal} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const ChatInput = React.memo(ChatInputInner);
