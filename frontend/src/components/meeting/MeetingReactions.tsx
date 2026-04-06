"use client";

import { useState, useCallback } from "react";

interface MeetingReactionsProps {
  handRaised: boolean;
  onHandRaise: () => void;
  onHandLower: () => void;
  onReaction: (emoji: string) => void;
  isHost?: boolean;
  onLowerAllHands?: () => void;
  raisedHandsCount?: number;
}

const QUICK_REACTIONS = [
  { emoji: "👏", label: "Applause" },
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "😄", label: "Laugh" },
  { emoji: "😮", label: "Surprised" },
  { emoji: "🤔", label: "Thinking" },
  { emoji: "⏩", label: "Speed up" },
  { emoji: "⏪", label: "Slow down" },
];

export function MeetingReactions({
  handRaised,
  onHandRaise,
  onHandLower,
  onReaction,
  isHost,
  onLowerAllHands,
  raisedHandsCount = 0,
}: MeetingReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleReaction = useCallback((emoji: string) => {
    onReaction(emoji);
    setShowPicker(false);
  }, [onReaction]);

  return (
    <div className="relative flex items-center gap-1">
      {/* Hand raise button */}
      <button
        onClick={handRaised ? onHandLower : onHandRaise}
        className={`relative p-2 rounded-lg transition-colors ${
          handRaised
            ? "bg-yellow-500 text-white hover:bg-yellow-600"
            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
        }`}
        title={handRaised ? "Lower hand" : "Raise hand"}
      >
        <span className="text-lg">✋</span>
        {raisedHandsCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-yellow-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
            {raisedHandsCount}
          </span>
        )}
      </button>

      {/* Host: lower all hands */}
      {isHost && raisedHandsCount > 0 && (
        <button
          onClick={onLowerAllHands}
          className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-xs"
          title="Lower all hands"
        >
          Clear
        </button>
      )}

      {/* Reaction picker toggle */}
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
        title="React"
      >
        <span className="text-lg">😄</span>
      </button>

      {/* Reaction picker dropdown */}
      {showPicker && (
        <div className="absolute bottom-full mb-2 right-0 bg-slate-800 rounded-xl shadow-2xl border border-slate-700 p-2 flex gap-1 z-50">
          {QUICK_REACTIONS.map(({ emoji, label }) => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors text-xl"
              title={label}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
