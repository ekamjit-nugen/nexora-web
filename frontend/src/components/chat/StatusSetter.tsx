"use client";

import { useState, useEffect, useRef } from "react";
import { chatApi } from "@/lib/api";

interface StatusSetterProps {
  currentStatus: string;
  onClose: () => void;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: "online", label: "Online", color: "bg-green-500", icon: "🟢" },
  { value: "away", label: "Away", color: "bg-yellow-500", icon: "🟡" },
  { value: "busy", label: "Busy", color: "bg-red-500", icon: "🔴" },
  { value: "dnd", label: "Do Not Disturb", color: "bg-red-600", icon: "⛔" },
  { value: "ooo", label: "Out of Office", color: "bg-slate-400", icon: "🏖️" },
];

export function StatusSetter({ currentStatus, onClose, onStatusChange }: StatusSetterProps) {
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);
  const [customText, setCustomText] = useState("");
  const [saving, setSaving] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trapping within the dialog
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusableEls = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await chatApi.setPresenceStatus(selectedStatus, undefined, customText || undefined);
      onStatusChange(selectedStatus);
      onClose();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div ref={dialogRef} className="bg-white rounded-xl shadow-xl w-[360px] p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-slate-800 mb-4">Set your status</h3>

        {/* Custom status text */}
        <div className="mb-4">
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="What's your status? (e.g. In a meeting)"
            maxLength={100}
            className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Status options */}
        <div className="space-y-1 mb-4">
          {STATUS_OPTIONS.map(({ value, label, icon }) => (
            <button
              key={value}
              onClick={() => setSelectedStatus(value)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                selectedStatus === value ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span className="text-base">{icon}</span>
              <span className="font-medium">{label}</span>
              {selectedStatus === value && (
                <svg className="ml-auto w-4 h-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              )}
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
