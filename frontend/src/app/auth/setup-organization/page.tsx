"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { orgApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES } from "@/lib/countries";
import { toast } from "sonner";

const ORG_TYPES = ["IT Services", "Consulting", "Product Company", "Enterprise", "Startup", "Agency", "Other"];
const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", "Real Estate", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 50);
}

const STEPS = [
  { num: 1, label: "Organization", desc: "Your workspace" },
  { num: 2, label: "Profile", desc: "About you" },
  { num: 3, label: "Team", desc: "Invite members" },
];

// Fake sidebar nav items for the blurred background
const FAKE_NAV = [
  { label: "Dashboard", active: true },
  { label: "Calendar" },
  { label: "Team Chat" },
  { label: "Calls" },
  { label: "Projects" },
  { label: "Tasks" },
  { label: "Timesheets" },
  { label: "Attendance" },
  { label: "Leaves" },
  { label: "Directory" },
  { label: "Reports" },
];

export default function SetupOrganizationPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const [timezone, setTimezone] = useState("");

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      setTimezone("UTC");
    }
  }, []);

  // Close country dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode);

  useEffect(() => {
    setSlug(generateSlug(name));
  }, [name]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      toast.error("Organization name must be at least 3 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await orgApi.create({
        name: name.trim(),
        industry: industry || undefined,
        size: size || undefined,
      });
      const d = res.data as any;
      const orgId = d?.organization?._id || d?._id;
      if (orgId) {
        localStorage.setItem("currentOrgId", orgId);
        if (countryCode) localStorage.setItem("setupCountryCode", countryCode);
        try {
          const switchRes = await orgApi.switchOrg(orgId);
          if (switchRes.data) {
            localStorage.setItem("accessToken", switchRes.data.accessToken);
            localStorage.setItem("refreshToken", switchRes.data.refreshToken);
          }
        } catch {}
      }
      toast.success("Organization created!");
      router.push("/auth/setup-profile");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = 0;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] relative">
      {/* ── Blurred Dashboard Shell (background) ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        {/* Sidebar */}
        <div className="fixed top-0 left-0 bottom-0 w-[260px] bg-white border-r border-[#E2E8F0] flex flex-col blur-[3px]">
          <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[#F1F5F9]">
            <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">N</div>
            <span className="text-lg font-bold text-[#0F172A]">Nexora</span>
          </div>
          <div className="flex-1 px-3 py-4 space-y-1">
            {FAKE_NAV.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${
                  item.active ? "bg-[#2E86C1]/10 text-[#2E86C1] font-semibold" : "text-[#64748B]"
                }`}
              >
                <div className="w-5 h-5 rounded bg-current opacity-20" />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Main content area */}
        <div className="md:ml-[260px] p-8 blur-[3px]">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="h-7 w-48 bg-[#E2E8F0] rounded-lg" />
              <div className="h-4 w-72 bg-[#F1F5F9] rounded mt-2" />
            </div>
            <div className="h-10 w-10 rounded-full bg-[#E2E8F0]" />
          </div>
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-28">
                <div className="h-4 w-20 bg-[#F1F5F9] rounded mb-3" />
                <div className="h-8 w-16 bg-[#E2E8F0] rounded" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-64">
              <div className="h-5 w-32 bg-[#F1F5F9] rounded mb-4" />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-3 bg-[#F8FAFC] rounded w-full" />)}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-64">
              <div className="h-5 w-32 bg-[#F1F5F9] rounded mb-4" />
              <div className="space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-3 bg-[#F8FAFC] rounded w-full" />)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Overlay backdrop ── */}
      <div className="fixed inset-0 bg-[#0F172A]/30 z-40" />

      {/* ── Modal content (foreground) ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-[580px] my-auto">
          {/* Stepper */}
          <div className="mb-8">
            {/* Mobile (<640px): current-step label + progress bar */}
            <div className="sm:hidden mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-white/80 uppercase tracking-wider">
                  Step {currentStep + 1} of {STEPS.length}
                </p>
                <p className="text-xs font-semibold text-white">
                  {STEPS[currentStep].label}
                </p>
              </div>
            </div>
            {/* Desktop (≥640px): full 3-circle stepper with labels */}
            <div className="hidden sm:flex items-center justify-center gap-0">
              {STEPS.map((step, i) => {
                const isActive = i === currentStep;
                const isDone = i < currentStep;
                return (
                  <div key={step.num} className="flex items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        isDone
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                          : isActive
                            ? "bg-[#2E86C1] text-white shadow-lg shadow-[#2E86C1]/25 ring-4 ring-[#2E86C1]/10"
                            : "bg-[#F1F5F9] text-[#94A3B8] border-2 border-[#E2E8F0]"
                      }`}>
                        {isDone ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : step.num}
                      </div>
                      <div>
                        <p className={`text-sm font-semibold ${isActive || isDone ? "text-white" : "text-white/50"}`}>{step.label}</p>
                        <p className={`text-xs ${isActive || isDone ? "text-white/70" : "text-white/30"}`}>{step.desc}</p>
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-20 h-[2px] mx-3 rounded-full ${isDone ? "bg-emerald-500" : "bg-[#E2E8F0]"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-500"
                style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-[#E2E8F0]/60 overflow-visible">
            <div className="bg-gradient-to-r from-[#2E86C1]/5 via-[#2E86C1]/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60 rounded-t-2xl">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Create Your Organization</h2>
                  <p className="text-sm text-[#64748B] mt-1">Set up your workspace to get started with Nexora</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                  Organization Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                  required
                  minLength={3}
                  maxLength={100}
                  autoFocus
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                />
                {slug && (
                  <p className="mt-1.5 text-xs text-[#94A3B8]">
                    URL: <span className="font-mono text-[#64748B]">{slug}</span>
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Organization Type</label>
                <select
                  value={orgType}
                  onChange={(e) => setOrgType(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white"
                >
                  <option value="">Select type</option>
                  {ORG_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">Team Size</label>
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white"
                  >
                    <option value="">Select size</option>
                    {SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div ref={countryRef} className="relative">
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">Country</label>
                  <button
                    type="button"
                    onClick={() => setCountryOpen(!countryOpen)}
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white flex items-center justify-between"
                  >
                    {selectedCountry ? (
                      <span className="flex items-center gap-2">
                        <span>{selectedCountry.flag}</span>
                        <span className="text-[#0F172A]">{selectedCountry.name}</span>
                      </span>
                    ) : (
                      <span className="text-[#94A3B8]">Select country</span>
                    )}
                    <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${countryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {countryOpen && (
                    <div className="absolute z-[60] mt-1 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-56 overflow-hidden">
                      <div className="p-2 border-b border-[#F1F5F9]">
                        <input
                          type="text"
                          value={countrySearch}
                          onChange={(e) => setCountrySearch(e.target.value)}
                          placeholder="Search countries..."
                          autoFocus
                          className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]/30"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-44">
                        {filteredCountries.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(c.code);
                              setCountryOpen(false);
                              setCountrySearch("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-[#F1F5F9] transition-colors ${countryCode === c.code ? "bg-[#2E86C1]/5 text-[#2E86C1] font-medium" : "text-[#334155]"}`}
                          >
                            <span className="text-base">{c.flag}</span>
                            <span>{c.name}</span>
                            <span className="text-[#94A3B8] text-xs ml-auto">{c.dialCode}</span>
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="px-3 py-4 text-sm text-[#94A3B8] text-center">No countries found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">Timezone</label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    placeholder="Asia/Kolkata"
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || name.trim().length < 3}
                className="w-full py-3 bg-[#2E86C1] text-white rounded-xl text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#2E86C1]/20"
              >
                {loading && (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
                {loading ? "Creating..." : "Create & Continue"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
