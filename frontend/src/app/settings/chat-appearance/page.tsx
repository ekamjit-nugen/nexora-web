"use client";

import { useEffect, useState, useCallback } from "react";
import { chatApi } from "@/lib/api";
import type { ChatSettings } from "@/lib/api";
import { toast } from "sonner";

const DEFAULTS = {
  chatBgColor: "#F8FAFC",
  myBubbleColor: "#2E86C1",
  myTextColor: "#FFFFFF",
  otherBubbleColor: "#F1F5F9",
  otherTextColor: "#334155",
  fontSize: "medium" as const,
};

const FONT_SIZE_MAP: Record<string, string> = {
  small: "13px",
  medium: "15px",
  large: "17px",
};

export default function ChatAppearancePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Appearance
  const [chatBgColor, setChatBgColor] = useState(DEFAULTS.chatBgColor);
  const [myBubbleColor, setMyBubbleColor] = useState(DEFAULTS.myBubbleColor);
  const [myTextColor, setMyTextColor] = useState(DEFAULTS.myTextColor);
  const [otherBubbleColor, setOtherBubbleColor] = useState(DEFAULTS.otherBubbleColor);
  const [otherTextColor, setOtherTextColor] = useState(DEFAULTS.otherTextColor);
  const [fontSize, setFontSize] = useState<string>(DEFAULTS.fontSize);

  // Read receipts
  const [showMyReadStatus, setShowMyReadStatus] = useState(true);
  const [showOthersReadStatus, setShowOthersReadStatus] = useState(true);

  useEffect(() => {
    chatApi.getSettings().then((res) => {
      const s = res.data as unknown as ChatSettings;
      if (s?.appearance) {
        setChatBgColor(s.appearance.chatBgColor || DEFAULTS.chatBgColor);
        setMyBubbleColor(s.appearance.myBubbleColor || DEFAULTS.myBubbleColor);
        setMyTextColor(s.appearance.myTextColor || DEFAULTS.myTextColor);
        setOtherBubbleColor(s.appearance.otherBubbleColor || DEFAULTS.otherBubbleColor);
        setOtherTextColor(s.appearance.otherTextColor || DEFAULTS.otherTextColor);
        setFontSize(s.appearance.fontSize || DEFAULTS.fontSize);
      }
      if (s?.readReceipts) {
        setShowMyReadStatus(s.readReceipts.showMyReadStatus ?? true);
        setShowOthersReadStatus(s.readReceipts.showOthersReadStatus ?? true);
      }
    }).catch(() => {
      // Use defaults
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await chatApi.updateSettings({
        appearance: { chatBgColor, myBubbleColor, myTextColor, otherBubbleColor, otherTextColor, fontSize },
        readReceipts: { showMyReadStatus, showOthersReadStatus },
      } as Partial<ChatSettings>);
      toast.success("Chat appearance saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }, [chatBgColor, myBubbleColor, myTextColor, otherBubbleColor, otherTextColor, fontSize, showMyReadStatus, showOthersReadStatus]);

  const handleReset = useCallback(() => {
    setChatBgColor(DEFAULTS.chatBgColor);
    setMyBubbleColor(DEFAULTS.myBubbleColor);
    setMyTextColor(DEFAULTS.myTextColor);
    setOtherBubbleColor(DEFAULTS.otherBubbleColor);
    setOtherTextColor(DEFAULTS.otherTextColor);
    setFontSize(DEFAULTS.fontSize);
    setShowMyReadStatus(true);
    setShowOthersReadStatus(true);
    toast.info("Reset to defaults (save to apply)");
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-64" />
        <div className="h-64 bg-slate-100 rounded-xl" />
      </div>
    );
  }

  const currentFontSize = FONT_SIZE_MAP[fontSize] || FONT_SIZE_MAP.medium;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Chat Appearance</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Customize how your chat bubbles and messages look.
        </p>
      </div>

      {/* Color Pickers */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Bubble Colors</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <ColorPicker label="Chat Background" value={chatBgColor} onChange={setChatBgColor} />
          <ColorPicker label="My Bubble Color" value={myBubbleColor} onChange={setMyBubbleColor} />
          <ColorPicker label="My Text Color" value={myTextColor} onChange={setMyTextColor} />
          <ColorPicker label="Other Bubble Color" value={otherBubbleColor} onChange={setOtherBubbleColor} />
          <ColorPicker label="Other Text Color" value={otherTextColor} onChange={setOtherTextColor} />
        </div>
      </div>

      {/* Font Size */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Message Font Size</h3>
        <p className="text-xs text-[#64748B] mb-4">Controls the font size of chat messages.</p>

        <div className="flex gap-1 p-1 bg-[#F1F5F9] rounded-lg max-w-md">
          {(["small", "medium", "large"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFontSize(opt)}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors capitalize ${
                fontSize === opt
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Live Preview */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Preview</h3>

        <div
          className="rounded-xl border border-[#E2E8F0] p-5 min-h-[200px] space-y-3"
          style={{ backgroundColor: chatBgColor }}
        >
          {/* Other person's message */}
          <div className="flex items-end gap-2 max-w-[70%]">
            <div className="w-7 h-7 rounded-full bg-[#94A3B8] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
              JD
            </div>
            <div>
              <p className="text-[10px] text-[#64748B] ml-1 mb-0.5">Jane Doe</p>
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-2.5"
                style={{ backgroundColor: otherBubbleColor, color: otherTextColor, fontSize: currentFontSize }}
              >
                Hey! How is the project going?
              </div>
              <p className="text-[10px] text-[#94A3B8] ml-1 mt-0.5">10:30 AM</p>
            </div>
          </div>

          {/* My message */}
          <div className="flex items-end gap-2 justify-end max-w-[70%] ml-auto">
            <div>
              <div
                className="rounded-2xl rounded-br-sm px-4 py-2.5"
                style={{ backgroundColor: myBubbleColor, color: myTextColor, fontSize: currentFontSize }}
              >
                Going great! Just finishing up the last feature.
              </div>
              <p className="text-[10px] text-[#94A3B8] text-right mr-1 mt-0.5">10:32 AM</p>
            </div>
          </div>

          {/* Other person's message */}
          <div className="flex items-end gap-2 max-w-[70%]">
            <div className="w-7 h-7 rounded-full bg-[#94A3B8] flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
              JD
            </div>
            <div>
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-2.5"
                style={{ backgroundColor: otherBubbleColor, color: otherTextColor, fontSize: currentFontSize }}
              >
                Awesome, let me know if you need any help!
              </div>
              <p className="text-[10px] text-[#94A3B8] ml-1 mt-0.5">10:33 AM</p>
            </div>
          </div>
        </div>
      </div>

      {/* Read Receipt Toggles */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Read Receipts</h3>

        <div className="space-y-4 max-w-lg">
          <ToggleRow
            label="Show my read status"
            description="Let others see when you have read their messages."
            checked={showMyReadStatus}
            onChange={setShowMyReadStatus}
          />
          <ToggleRow
            label="Show others' read status"
            description="See when others have read your messages."
            checked={showOthersReadStatus}
            onChange={setShowOthersReadStatus}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pb-4">
        <button
          onClick={handleReset}
          className="text-sm text-[#64748B] hover:text-[#EF4444] transition-colors underline underline-offset-2"
        >
          Reset to defaults
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-[#2E86C1] text-white text-sm font-medium rounded-lg hover:bg-[#2471A3] transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-10 h-10 rounded-lg border border-[#E2E8F0] cursor-pointer p-0.5"
      />
      <div>
        <p className="text-xs font-medium text-[#334155]">{label}</p>
        <p className="text-xs text-[#94A3B8] font-mono">{value}</p>
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[#0F172A]">{label}</p>
        <p className="text-xs text-[#64748B] mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
