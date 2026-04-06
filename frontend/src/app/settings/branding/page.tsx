"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { name: "Nexora Blue", value: "#2E86C1" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Emerald", value: "#10B981" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Slate", value: "#475569" },
];

export default function BrandingPage() {
  const { user, currentOrg } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [primaryColor, setPrimaryColor] = useState("#2E86C1");
  const [secondaryColor, setSecondaryColor] = useState("#64748B");
  const [sidebarColor, setSidebarColor] = useState("#FFFFFF");
  const [logoAlignment, setLogoAlignment] = useState("left");
  const [payslipHeader, setPayslipHeader] = useState("");
  const [payslipFooter, setPayslipFooter] = useState("");
  const [letterHeader, setLetterHeader] = useState("");
  const [letterFooter, setLetterFooter] = useState("");

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    settingsApi.getBranding().then((res: any) => {
      const b = res.data || {};
      setPrimaryColor(b.primaryColor || "#2E86C1");
      setSecondaryColor(b.secondaryColor || "#64748B");
      setSidebarColor(b.sidebarColor || "#FFFFFF");
      setLogoAlignment(b.logoAlignment || "left");
      setPayslipHeader(b.payslipHeader || "");
      setPayslipFooter(b.payslipFooter || "");
      setLetterHeader(b.letterHeader || "");
      setLetterFooter(b.letterFooter || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentOrg]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateBranding({
        primaryColor, secondaryColor, sidebarColor, logoAlignment,
        payslipHeader, payslipFooter, letterHeader, letterFooter,
      });
      toast.success("Branding settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Branding & Appearance</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Customize your organization&apos;s visual identity across the platform.</p>
      </div>

      {/* Logo Upload */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
          Logo & Identity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {["Primary Logo", "Icon / Favicon", "Dark Mode Logo"].map((label) => (
            <div key={label}>
              <label className={labelClass}>{label}</label>
              <div className="border-2 border-dashed border-[#E2E8F0] rounded-xl p-8 text-center hover:border-[#2E86C1]/30 transition-colors cursor-pointer">
                <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <p className="text-xs text-[#94A3B8]">PNG, SVG, or JPG — max 2MB</p>
                <span className="inline-flex items-center mt-2 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">Coming Soon</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <label className={labelClass}>Logo Alignment in Documents</label>
          <div className="flex gap-4">
            {[{ v: "left", l: "Left" }, { v: "center", l: "Center" }].map(({ v, l }) => (
              <label key={v} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${logoAlignment === v ? "border-[#2E86C1] bg-[#2E86C1]/5 text-[#2E86C1]" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"}`}>
                <input type="radio" name="logoAlignment" value={v} checked={logoAlignment === v} onChange={() => setLogoAlignment(v)} className="sr-only" />
                <span className="text-sm font-medium">{l}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Colors */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
          </svg>
          Brand Colors
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { label: "Primary Color", value: primaryColor, setter: setPrimaryColor, desc: "Buttons, active states, links" },
            { label: "Secondary Color", value: secondaryColor, setter: setSecondaryColor, desc: "Accents, badges" },
            { label: "Sidebar Color", value: sidebarColor, setter: setSidebarColor, desc: "Sidebar background" },
          ].map(({ label, value, setter, desc }) => (
            <div key={label}>
              <label className={labelClass}>{label}</label>
              <div className="flex items-center gap-3">
                <input type="color" value={value} onChange={(e) => setter(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-[#E2E8F0] cursor-pointer p-0.5" />
                <div className="flex-1">
                  <input type="text" value={value} onChange={(e) => setter(e.target.value)}
                    className={inputClass} placeholder="#2E86C1" maxLength={7} />
                </div>
              </div>
              <p className="text-xs text-[#94A3B8] mt-1.5">{desc}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {COLOR_PRESETS.map((c) => (
                  <button key={c.value} onClick={() => setter(c.value)} title={c.name}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${value === c.value ? "border-[#0F172A] scale-110" : "border-transparent hover:scale-110"}`}
                    style={{ backgroundColor: c.value }} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live Preview */}
        <div className="mt-6 pt-6 border-t border-[#E2E8F0]">
          <label className={labelClass}>Preview</label>
          <div className="flex gap-4 items-start">
            <div className="w-48 rounded-xl overflow-hidden border border-[#E2E8F0]" style={{ backgroundColor: sidebarColor }}>
              <div className="p-3 border-b border-[#E2E8F0]/50 flex items-center gap-2">
                <div className="w-6 h-6 rounded" style={{ backgroundColor: primaryColor }} />
                <span className="text-xs font-bold" style={{ color: primaryColor === "#FFFFFF" || sidebarColor !== "#FFFFFF" ? "#0F172A" : primaryColor }}>Nexora</span>
              </div>
              <div className="p-2 space-y-1">
                {["Dashboard", "Projects", "Team"].map((item, i) => (
                  <div key={item} className={`px-2 py-1.5 rounded text-xs ${i === 0 ? "font-medium" : ""}`}
                    style={i === 0 ? { backgroundColor: primaryColor + "15", color: primaryColor } : { color: "#64748B" }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              <button className="px-4 py-2 rounded-lg text-white text-xs font-medium" style={{ backgroundColor: primaryColor }}>Primary Button</button>
              <button className="px-4 py-2 rounded-lg text-white text-xs font-medium ml-2" style={{ backgroundColor: secondaryColor }}>Secondary</button>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: primaryColor + "15", color: primaryColor }}>Badge</span>
                <span className="text-xs" style={{ color: primaryColor }}>Link text</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Branding */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          Document Branding
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Payslip Header Text</label>
            <textarea value={payslipHeader} onChange={(e) => setPayslipHeader(e.target.value)}
              className={inputClass + " resize-none"} rows={2} placeholder="Custom text for payslip headers..." />
          </div>
          <div>
            <label className={labelClass}>Payslip Footer Text</label>
            <textarea value={payslipFooter} onChange={(e) => setPayslipFooter(e.target.value)}
              className={inputClass + " resize-none"} rows={2} placeholder="e.g., This is a computer-generated document" />
          </div>
          <div>
            <label className={labelClass}>Letter Header Template</label>
            <textarea value={letterHeader} onChange={(e) => setLetterHeader(e.target.value)}
              className={inputClass + " resize-none"} rows={2} placeholder="Header for offer letters, memos..." />
          </div>
          <div>
            <label className={labelClass}>Letter Footer Template</label>
            <textarea value={letterFooter} onChange={(e) => setLetterFooter(e.target.value)}
              className={inputClass + " resize-none"} rows={2} placeholder="Footer with address, registration details..." />
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 shadow-sm">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
