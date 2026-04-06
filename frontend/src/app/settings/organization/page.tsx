"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { orgApi, settingsApi } from "@/lib/api";
import { COUNTRIES } from "@/lib/countries";
import { toast } from "sonner";

const ORG_TYPES = ["IT Services", "Consulting", "Product Company", "Enterprise", "Startup", "Agency", "Other"];
const INDUSTRIES = ["Technology", "Healthcare", "Finance", "Education", "Retail", "Manufacturing", "Real Estate", "Media & Entertainment", "Logistics", "Government", "Non-Profit", "Other"];
const SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"];
const TIMEZONES = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Sao_Paulo", "Europe/London", "Europe/Berlin", "Europe/Paris", "Europe/Moscow", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Asia/Shanghai", "Asia/Seoul", "Australia/Sydney", "Pacific/Auckland"];
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY", "SGD", "AED", "CHF", "BRL"];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
const TIME_FORMATS = [{ value: "12h", label: "12-hour (2:30 PM)" }, { value: "24h", label: "24-hour (14:30)" }];
const NUMBER_FORMATS = [{ value: "indian", label: "Indian (1,00,000)" }, { value: "international", label: "International (100,000)" }, { value: "european", label: "European (100.000)" }];
const WEEK_DAYS = [{ value: "monday", label: "Monday" }, { value: "tuesday", label: "Tuesday" }, { value: "sunday", label: "Sunday" }, { value: "saturday", label: "Saturday" }];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function OrganizationSettingsPage() {
  const { user, currentOrg } = useAuth();
  const [saving, setSaving] = useState(false);

  // General Info
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEditing, setSlugEditing] = useState(false);
  const [orgType, setOrgType] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [domain, setDomain] = useState("");
  const [description, setDescription] = useState("");
  const [foundedYear, setFoundedYear] = useState("");
  const [website, setWebsite] = useState("");

  // Location & Regional
  const [country, setCountry] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const countryRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [numberFormat, setNumberFormat] = useState("indian");
  const [weekStartDay, setWeekStartDay] = useState("monday");
  const [financialYearStart, setFinancialYearStart] = useState(4);

  const userRoles = user?.roles || [];
  const isAdminOrHr = userRoles.some((r) => ["admin", "super_admin", "hr", "owner"].includes(r));

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || "");
      setSlug((currentOrg as any).slug || "");
      setOrgType((currentOrg as any).type || "");
      setIndustry(currentOrg.industry || "");
      setSize(currentOrg.size || "");
      setDomain(currentOrg.domain || "");
      setDescription((currentOrg as any).description || "");
      setFoundedYear((currentOrg as any).foundedYear?.toString() || "");
      setWebsite((currentOrg as any).website || "");
      setCountry((currentOrg as any).country || "");
      setState((currentOrg as any).state || "");
      setCity((currentOrg as any).city || "");
      setTimezone(currentOrg.settings?.timezone || "Asia/Kolkata");
      setCurrency(currentOrg.settings?.currency || "INR");
      setDateFormat(currentOrg.settings?.dateFormat || "DD/MM/YYYY");
      setTimeFormat((currentOrg.settings as any)?.timeFormat || "12h");
      setNumberFormat((currentOrg.settings as any)?.numberFormat || "indian");
      setWeekStartDay((currentOrg.settings as any)?.weekStartDay || "monday");
      setFinancialYearStart((currentOrg.settings as any)?.financialYearStart || 4);
    }
  }, [currentOrg]);

  // Country dropdown outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) setCountryOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) || c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );
  const selectedCountry = COUNTRIES.find(c => c.code === country);

  if (!user || !isAdminOrHr) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!currentOrg) { toast.error("No organization selected"); return; }
    setSaving(true);
    try {
      await orgApi.update(currentOrg._id, {
        name: orgName,
        industry,
        size,
        domain,
        type: orgType,
        country,
        state,
        settings: { timezone, currency, dateFormat },
      } as any);

      // Update extended fields via settings API
      try {
        await settingsApi.updateGeneral({
          description: description || undefined,
          foundedYear: foundedYear ? parseInt(foundedYear) : undefined,
          website: website || undefined,
          city: city || undefined,
          timeFormat,
          numberFormat,
          weekStartDay,
          financialYearStart,
        });
      } catch {}

      toast.success("Settings saved successfully");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">General Settings</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Manage your organization profile and regional preferences.</p>
      </div>

      {/* Organization Profile */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
          </svg>
          Organization Profile
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelClass}>Organization Name <span className="text-red-500">*</span></label>
            <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} className={inputClass} placeholder="Acme Corp" />
            {slug && (
              <p className="mt-1.5 text-xs text-[#94A3B8]">
                URL: <span className="font-mono text-[#64748B]">{slug}</span>
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Organization Type</label>
            <select value={orgType} onChange={(e) => setOrgType(e.target.value)} className={selectClass}>
              <option value="">Select type</option>
              {ORG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Industry</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Organization Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className={selectClass}>
              <option value="">Select size</option>
              {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Website</label>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className={inputClass} placeholder="https://yourcompany.com" />
          </div>

          <div>
            <label className={labelClass}>Founded Year</label>
            <input type="number" value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} className={inputClass} placeholder="2020" min="1800" max={new Date().getFullYear()} />
          </div>

          <div>
            <label className={labelClass}>Domain</label>
            <input type="text" value={domain} onChange={(e) => setDomain(e.target.value)} className={inputClass} placeholder="yourcompany.com" />
          </div>
        </div>

        <div className="mt-5">
          <label className={labelClass}>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass + " resize-none"} rows={3} placeholder="A short description of your organization..." maxLength={500} />
          <p className="mt-1 text-xs text-[#94A3B8]">{description.length}/500 characters</p>
        </div>
      </div>

      {/* Location & Regional */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
          Location & Regional
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Country dropdown */}
          <div ref={countryRef} className="relative">
            <label className={labelClass}>Country <span className="text-red-500">*</span></label>
            <button type="button" onClick={() => setCountryOpen(!countryOpen)}
              className="w-full px-4 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white flex items-center justify-between">
              {selectedCountry ? (
                <span className="flex items-center gap-2">
                  <span>{selectedCountry.flag}</span>
                  <span className="text-[#0F172A]">{selectedCountry.name}</span>
                </span>
              ) : <span className="text-[#94A3B8]">Select country</span>}
              <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${countryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {countryOpen && (
              <div className="absolute z-50 mt-1 w-full bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-56 overflow-hidden">
                <div className="p-2 border-b border-[#F1F5F9]">
                  <input type="text" value={countrySearch} onChange={(e) => setCountrySearch(e.target.value)} placeholder="Search..." autoFocus
                    className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#2E86C1]/30" />
                </div>
                <div className="overflow-y-auto max-h-44">
                  {filteredCountries.map((c) => (
                    <button key={c.code} type="button" onClick={() => { setCountry(c.code); setCountryOpen(false); setCountrySearch(""); }}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-[#F1F5F9] ${country === c.code ? "bg-[#2E86C1]/5 text-[#2E86C1] font-medium" : "text-[#334155]"}`}>
                      <span className="text-base">{c.flag}</span><span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>State / Region</label>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} className={inputClass} placeholder="Karnataka" />
          </div>

          <div>
            <label className={labelClass}>City</label>
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} placeholder="Bangalore" />
          </div>

          <div>
            <label className={labelClass}>Timezone <span className="text-red-500">*</span></label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Currency <span className="text-red-500">*</span></label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Date Format <span className="text-red-500">*</span></label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={selectClass}>
              {DATE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Time Format</label>
            <select value={timeFormat} onChange={(e) => setTimeFormat(e.target.value)} className={selectClass}>
              {TIME_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Number Format</label>
            <select value={numberFormat} onChange={(e) => setNumberFormat(e.target.value)} className={selectClass}>
              {NUMBER_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Week Starts On</label>
            <select value={weekStartDay} onChange={(e) => setWeekStartDay(e.target.value)} className={selectClass}>
              {WEEK_DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>

          <div>
            <label className={labelClass}>Financial Year Starts</label>
            <select value={financialYearStart} onChange={(e) => setFinancialYearStart(parseInt(e.target.value))} className={selectClass}>
              {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
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
