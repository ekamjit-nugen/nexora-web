"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  type NexoraTheme,
  defaultTheme,
  applyTheme,
  loadThemeFromBackend,
  saveThemeToBackend,
  colorPresets,
  fontOptions,
  fontSizeOptions,
  radiusOptions,
  type FontSizeOption,
  type RadiusOption,
  type SidebarStyle,
} from "@/lib/theme";

export default function AppearanceSettingsPage() {
  const [theme, setTheme] = useState<NexoraTheme>(defaultTheme);

  useEffect(() => {
    // Load theme from backend (user-specific)
    loadThemeFromBackend().then(setTheme);
  }, []);

  const updateTheme = useCallback(
    <K extends keyof NexoraTheme>(key: K, value: NexoraTheme[K]) => {
      const updated = { ...theme, [key]: value };
      setTheme(updated);
      saveThemeToBackend(updated);
      applyTheme(updated);
    },
    [theme]
  );

  const resetToDefaults = () => {
    setTheme(defaultTheme);
    saveThemeToBackend(defaultTheme);
    applyTheme(defaultTheme);
    toast.success("Theme reset to defaults");
  };

  const themeOptions: { value: NexoraTheme["mode"]; label: string; icon: string; desc: string }[] = [
    {
      value: "light",
      label: "Light",
      desc: "Clean and bright",
      icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
    },
    {
      value: "dark",
      label: "Dark",
      desc: "Easy on the eyes",
      icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
    },
    {
      value: "system",
      label: "System",
      desc: "Match your OS",
      icon: "M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
    },
  ];

  const sidebarOptions: { value: SidebarStyle; label: string; desc: string; bgClass: string; textClass: string; itemClass: string }[] = [
    { value: "light", label: "Light", desc: "White background", bgClass: "bg-white", textClass: "text-[#64748B]", itemClass: "bg-[#EBF5FF]" },
    { value: "dark", label: "Dark", desc: "Dark background", bgClass: "bg-[#0F172A]", textClass: "text-[#CBD5E1]", itemClass: "bg-white/10" },
    { value: "colored", label: "Colored", desc: "Primary color", bgClass: "bg-primary", textClass: "text-white/80", itemClass: "bg-white/15" },
  ];

  const dateFormats: NexoraTheme["dateFormat"][] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

  // Get current primary hex for the custom picker and preview
  const currentPreset = colorPresets.find((c) => c.name === theme.color);
  const currentHex = theme.color === "custom" ? (theme.customColor || "#2E86C1") : (currentPreset?.hex || "#2E86C1");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Appearance</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Customize how Nexora looks and feels. Changes apply instantly.
        </p>
      </div>

      {/* Section 1: Color Scheme */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Accent Color</h3>
        <p className="text-xs text-[#64748B] mb-4">Choose the primary color used across the interface.</p>

        <div className="flex flex-wrap gap-3 mb-5">
          {colorPresets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => updateTheme("color", preset.name)}
              className="group flex flex-col items-center gap-1.5"
              title={preset.label}
            >
              <div
                className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all ${
                  theme.color === preset.name
                    ? "border-[#0F172A] scale-110 shadow-md"
                    : "border-transparent hover:scale-105"
                }`}
                style={{ backgroundColor: preset.hex }}
              >
                {theme.color === preset.name && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-[10px] text-[#64748B] font-medium">{preset.label}</span>
            </button>
          ))}

          {/* Custom color */}
          <button
            onClick={() => updateTheme("color", "custom")}
            className="group flex flex-col items-center gap-1.5"
            title="Custom"
          >
            <div
              className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all overflow-hidden ${
                theme.color === "custom"
                  ? "border-[#0F172A] scale-110 shadow-md"
                  : "border-[#E2E8F0] hover:scale-105"
              }`}
              style={{
                background: theme.color === "custom" && theme.customColor
                  ? theme.customColor
                  : "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            >
              {theme.color === "custom" && (
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-[10px] text-[#64748B] font-medium">Custom</span>
          </button>
        </div>

        {/* Custom color picker */}
        {theme.color === "custom" && (
          <div className="flex items-center gap-3 p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] mb-5 max-w-xs">
            <input
              type="color"
              value={theme.customColor || "#2E86C1"}
              onChange={(e) => {
                const updated = { ...theme, color: "custom" as const, customColor: e.target.value };
                setTheme(updated);
                saveThemeToBackend(updated);
                applyTheme(updated);
              }}
              className="w-10 h-10 rounded-lg border border-[#E2E8F0] cursor-pointer p-0.5"
            />
            <div>
              <p className="text-xs font-medium text-[#334155]">Custom Color</p>
              <p className="text-xs text-[#94A3B8] font-mono">{theme.customColor || "#2E86C1"}</p>
            </div>
          </div>
        )}

        {/* Preview strip */}
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: currentHex }}
          >
            Button
          </button>
          <span
            className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: currentHex }}
          >
            Badge
          </span>
          <span className="text-sm font-medium underline" style={{ color: currentHex }}>
            Link text
          </span>
        </div>
      </div>

      {/* Section 2: Font Family */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Font Family</h3>
        <p className="text-xs text-[#64748B] mb-4">Select the typeface used across the interface.</p>

        {/* Sans-serif */}
        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Sans-serif</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
          {fontOptions.filter((f) => f.category === "sans").map((font) => (
            <button
              key={font.name}
              onClick={() => updateTheme("font", font.name)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                theme.font === font.name
                  ? "border-[var(--primary-hex,#2E86C1)] bg-[#F8FAFC]"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              <p className="text-sm font-semibold text-[#0F172A] mb-1" style={{ fontFamily: font.value }}>
                {font.label}
              </p>
              <p className="text-xs text-[#94A3B8]" style={{ fontFamily: font.value }}>
                The quick brown fox
              </p>
            </button>
          ))}
        </div>

        {/* Serif & Mono */}
        <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Serif & Monospace</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {fontOptions.filter((f) => f.category !== "sans").map((font) => (
            <button
              key={font.name}
              onClick={() => updateTheme("font", font.name)}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                theme.font === font.name
                  ? "border-[var(--primary-hex,#2E86C1)] bg-[#F8FAFC]"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              <p className="text-sm font-semibold text-[#0F172A] mb-1" style={{ fontFamily: font.value }}>
                {font.label}
              </p>
              <p className="text-xs text-[#94A3B8]" style={{ fontFamily: font.value }}>
                The quick brown fox
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Section 3: Font Size */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Font Size</h3>
        <p className="text-xs text-[#64748B] mb-4">Adjust the base text size of the interface.</p>

        <div className="flex gap-1 p-1 bg-[#F1F5F9] rounded-lg max-w-md mb-4">
          {fontSizeOptions.map((opt) => (
            <button
              key={opt.name}
              onClick={() => updateTheme("fontSize", opt.name as FontSizeOption)}
              className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                theme.fontSize === opt.name
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
          <p
            className="text-[#334155] font-medium"
            style={{ fontSize: `${(fontSizeOptions.find((f) => f.name === theme.fontSize)?.scale || 1) * 16}px` }}
          >
            This is how your text will look at the selected size.
          </p>
          <p
            className="text-[#94A3B8] mt-1"
            style={{ fontSize: `${(fontSizeOptions.find((f) => f.name === theme.fontSize)?.scale || 1) * 13}px` }}
          >
            Secondary text and descriptions will also scale accordingly.
          </p>
        </div>
      </div>

      {/* Section 4: Border Radius */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Border Radius</h3>
        <p className="text-xs text-[#64748B] mb-4">Control the roundness of buttons, cards, and inputs.</p>

        <div className="flex flex-wrap gap-3">
          {radiusOptions.map((opt) => (
            <button
              key={opt.name}
              onClick={() => updateTheme("radius", opt.name as RadiusOption)}
              className={`flex flex-col items-center gap-2 p-3 border-2 transition-colors ${
                theme.radius === opt.name
                  ? "border-[var(--primary-hex,#2E86C1)]"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
              style={{ borderRadius: opt.value }}
            >
              <div
                className="w-14 h-10 border-2 border-[#CBD5E1] bg-[#F8FAFC]"
                style={{ borderRadius: opt.value }}
              />
              <span className="text-[11px] font-medium text-[#64748B]">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Section 5: Theme Mode */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Theme Mode</h3>
        <p className="text-xs text-[#64748B] mb-4">Choose between light, dark, or system preference.</p>

        <div className="grid grid-cols-3 gap-3 max-w-md">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateTheme("mode", option.value)}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                theme.mode === option.value
                  ? "border-[var(--primary-hex,#2E86C1)] bg-[#F8FAFC]"
                  : "border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#CBD5E1]"
              }`}
            >
              <svg
                className={`w-6 h-6 ${
                  theme.mode === option.value ? "text-[var(--primary-hex,#2E86C1)]" : "text-[#64748B]"
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
              </svg>
              <div className="text-center">
                <p
                  className={`text-sm font-medium ${
                    theme.mode === option.value ? "text-[var(--primary-hex,#2E86C1)]" : "text-[#64748B]"
                  }`}
                >
                  {option.label}
                </p>
                <p className="text-[10px] text-[#94A3B8] mt-0.5">{option.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 6: Sidebar Style */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1">Sidebar Style</h3>
        <p className="text-xs text-[#64748B] mb-4">Choose the sidebar appearance.</p>

        <div className="grid grid-cols-3 gap-3 max-w-lg mb-5">
          {sidebarOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateTheme("sidebarStyle", option.value)}
              className={`rounded-lg border-2 overflow-hidden transition-all ${
                theme.sidebarStyle === option.value
                  ? "border-[var(--primary-hex,#2E86C1)] shadow-md"
                  : "border-[#E2E8F0] hover:border-[#CBD5E1]"
              }`}
            >
              {/* Mini sidebar preview */}
              <div
                className={`p-3 h-28 flex flex-col ${option.bgClass}`}
                style={option.value === "colored" ? { backgroundColor: currentHex } : undefined}
              >
                {/* Mini logo */}
                <div className="flex items-center gap-1.5 mb-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: option.value === "light" ? currentHex : "rgba(255,255,255,0.2)" }}
                  />
                  <div
                    className="h-2 w-10 rounded"
                    style={{
                      backgroundColor:
                        option.value === "light" ? "#0F172A" : "rgba(255,255,255,0.7)",
                    }}
                  />
                </div>
                {/* Mini nav items */}
                <div className="space-y-1.5 flex-1">
                  <div className={`h-2.5 rounded ${option.itemClass}`} style={{ width: "70%" }} />
                  <div
                    className="h-2.5 rounded"
                    style={{
                      width: "55%",
                      backgroundColor:
                        option.value === "light" ? "#F1F5F9" : "rgba(255,255,255,0.06)",
                    }}
                  />
                  <div
                    className="h-2.5 rounded"
                    style={{
                      width: "65%",
                      backgroundColor:
                        option.value === "light" ? "#F1F5F9" : "rgba(255,255,255,0.06)",
                    }}
                  />
                </div>
              </div>
              <div className="p-2 bg-[#F8FAFC] text-center border-t border-[#E2E8F0]">
                <p className="text-xs font-medium text-[#334155]">{option.label}</p>
                <p className="text-[10px] text-[#94A3B8]">{option.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Compact sidebar toggle */}
        <div className="flex items-center justify-between max-w-lg">
          <div>
            <p className="text-sm font-medium text-[#0F172A]">Compact Sidebar</p>
            <p className="text-xs text-[#64748B] mt-0.5">
              Show a narrower sidebar with icons only.
            </p>
          </div>
          <button
            onClick={() => updateTheme("compactSidebar", !theme.compactSidebar)}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              theme.compactSidebar ? "bg-[var(--primary-hex,#2E86C1)]" : "bg-[#CBD5E1]"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                theme.compactSidebar ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Section 7: Date & Time Format */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Date & Time Format</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Date Format */}
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-2">Date Format</p>
            <div className="space-y-2">
              {dateFormats.map((fmt) => (
                <label
                  key={fmt}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    theme.dateFormat === fmt
                      ? "border-[var(--primary-hex,#2E86C1)] bg-[#F8FAFC]"
                      : "border-[#E2E8F0] hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => updateTheme("dateFormat", fmt)}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      theme.dateFormat === fmt ? "border-[var(--primary-hex,#2E86C1)]" : "border-[#CBD5E1]"
                    }`}
                  >
                    {theme.dateFormat === fmt && (
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: currentHex }} />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      theme.dateFormat === fmt ? "text-[#0F172A]" : "text-[#334155]"
                    }`}
                  >
                    {fmt}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Time Format */}
          <div>
            <p className="text-xs font-medium text-[#64748B] mb-2">Time Format</p>
            <div className="flex gap-3">
              {(["12h", "24h"] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => updateTheme("timeFormat", fmt)}
                  className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                    theme.timeFormat === fmt
                      ? "border-[var(--primary-hex,#2E86C1)] bg-[#F8FAFC] text-[#0F172A]"
                      : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:border-[#CBD5E1]"
                  }`}
                >
                  {fmt === "12h" ? "12-hour (AM/PM)" : "24-hour"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 8: Reset */}
      <div className="flex justify-end pb-4">
        <button
          onClick={resetToDefaults}
          className="text-sm text-[#64748B] hover:text-[#EF4444] transition-colors underline underline-offset-2"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
