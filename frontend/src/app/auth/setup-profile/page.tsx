"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { COUNTRIES, getCountryByCode } from "@/lib/countries";
import { toast } from "sonner";

const DEPARTMENTS = ["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Operations", "Leadership", "Other"];

const STEPS = [
  { num: 1, label: "Organization", desc: "Your workspace" },
  { num: 2, label: "Profile", desc: "About you" },
  { num: 3, label: "Team", desc: "Invite members" },
];

export default function SetupProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName === "Pending" ? "" : user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName === "User" ? "" : user?.lastName || "");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("");
  const [phoneCountryOpen, setPhoneCountryOpen] = useState(false);
  const [phoneCountrySearch, setPhoneCountrySearch] = useState("");
  const phoneCountryRef = useRef<HTMLDivElement>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [department, setDepartment] = useState("");

  // Pre-fill phone country from org setup step
  useEffect(() => {
    const saved = localStorage.getItem("setupCountryCode");
    if (saved) setPhoneCountryCode(saved);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (phoneCountryRef.current && !phoneCountryRef.current.contains(e.target as Node)) {
        setPhoneCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filteredPhoneCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(phoneCountrySearch.toLowerCase()) ||
    c.dialCode.includes(phoneCountrySearch)
  );

  const selectedPhoneCountry = getCountryByCode(phoneCountryCode);

  const validatePhone = (value: string): string => {
    if (!value.trim()) return ""; // optional
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7) return "Phone number must be at least 7 digits";
    if (digits.length > 15) return "Phone number is too long";
    return "";
  };

  const handlePhoneChange = (value: string) => {
    // Only allow digits, spaces, dashes
    const cleaned = value.replace(/[^\d\s\-]/g, "");
    setPhone(cleaned);
    setPhoneError(validatePhone(cleaned));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }
    if (phone.trim()) {
      const err = validatePhone(phone);
      if (err) { toast.error(err); return; }
      if (!phoneCountryCode) { toast.error("Please select a country code for your phone number"); return; }
    }
    setLoading(true);
    try {
      const fullPhone = phone.trim() && selectedPhoneCountry
        ? `${selectedPhoneCountry.dialCode} ${phone.trim()}`
        : phone.trim() || undefined;
      await authApi.completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password: "",
      });
      if (phone || jobTitle || department) {
        await authApi.updateProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phoneNumber: fullPhone,
        });
      }
      toast.success("Profile saved!");
      router.push("/auth/invite-team");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = 1;

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] relative">
      {/* ── Blurred Dashboard Shell ── */}
      <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
        <div className="fixed top-0 left-0 bottom-0 w-[260px] bg-white border-r border-[#E2E8F0] blur-[3px]">
          <div className="px-5 py-5 flex items-center gap-2.5 border-b border-[#F1F5F9]">
            <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-lg">N</div>
            <span className="text-lg font-bold text-[#0F172A]">Nexora</span>
          </div>
          <div className="px-3 py-4 space-y-1">
            {["Dashboard","Calendar","Team Chat","Projects","Tasks","Attendance","Leaves","Directory"].map((l,i) => (
              <div key={l} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${i===0 ? "bg-[#2E86C1]/10 text-[#2E86C1] font-semibold" : "text-[#64748B]"}`}>
                <div className="w-5 h-5 rounded bg-current opacity-20" /><span>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="ml-[260px] p-8 blur-[3px]">
          <div className="h-7 w-48 bg-[#E2E8F0] rounded-lg mb-8" />
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-xl border border-[#E2E8F0] p-6 h-28"><div className="h-4 w-20 bg-[#F1F5F9] rounded mb-3" /><div className="h-8 w-16 bg-[#E2E8F0] rounded" /></div>)}
          </div>
        </div>
      </div>
      <div className="fixed inset-0 bg-[#0F172A]/30 z-40" />

      {/* ── Modal content ── */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto">
        <div className="w-full max-w-[560px] my-auto">
          {/* Stepper */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-0">
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
                      <div className="hidden sm:block">
                        <p className={`text-sm font-semibold ${isActive || isDone ? "text-white" : "text-white/50"}`}>{step.label}</p>
                        <p className={`text-xs ${isActive || isDone ? "text-white/70" : "text-white/30"}`}>{step.desc}</p>
                      </div>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-12 sm:w-20 h-[2px] mx-3 rounded-full ${isDone ? "bg-emerald-500" : "bg-[#E2E8F0]"}`} />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 h-1 bg-[#E2E8F0] rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-500" style={{ width: "50%" }} />
            </div>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-[#E2E8F0]/60 overflow-hidden">
            <div className="bg-gradient-to-r from-[#2E86C1]/5 via-[#2E86C1]/[0.02] to-transparent px-8 pt-8 pb-6 border-b border-[#E2E8F0]/60">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#2E86C1]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#0F172A]">Complete Your Profile</h2>
                  <p className="text-sm text-[#64748B] mt-1">Tell us a bit about yourself</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#334155] mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                    className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Phone Number</label>
                <div className="flex gap-2">
                  {/* Country code selector */}
                  <div ref={phoneCountryRef} className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setPhoneCountryOpen(!phoneCountryOpen)}
                      className={`h-full px-3 py-2.5 border rounded-xl text-sm flex items-center gap-1.5 bg-white transition-all min-w-[100px] ${phoneError ? "border-red-300" : "border-[#E2E8F0]"} focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20`}
                    >
                      {selectedPhoneCountry ? (
                        <>
                          <span className="text-base">{selectedPhoneCountry.flag}</span>
                          <span className="text-[#0F172A] font-medium">{selectedPhoneCountry.dialCode}</span>
                        </>
                      ) : (
                        <span className="text-[#94A3B8]">Code</span>
                      )}
                      <svg className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${phoneCountryOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </button>
                    {phoneCountryOpen && (
                      <div className="absolute z-[60] mt-1 w-64 bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-h-56 overflow-hidden left-0">
                        <div className="p-2 border-b border-[#F1F5F9]">
                          <input
                            type="text"
                            value={phoneCountrySearch}
                            onChange={(e) => setPhoneCountrySearch(e.target.value)}
                            placeholder="Search..."
                            autoFocus
                            className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]/30"
                          />
                        </div>
                        <div className="overflow-y-auto max-h-44">
                          {filteredPhoneCountries.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => {
                                setPhoneCountryCode(c.code);
                                setPhoneCountryOpen(false);
                                setPhoneCountrySearch("");
                              }}
                              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-[#F1F5F9] transition-colors ${phoneCountryCode === c.code ? "bg-[#2E86C1]/5 text-[#2E86C1] font-medium" : "text-[#334155]"}`}
                            >
                              <span className="text-base">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-[#94A3B8] text-xs">{c.dialCode}</span>
                            </button>
                          ))}
                          {filteredPhoneCountries.length === 0 && (
                            <p className="px-3 py-4 text-sm text-[#94A3B8] text-center">No results</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Phone input */}
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="98765 43210"
                    className={`flex-1 px-3.5 py-2.5 border rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all ${phoneError ? "border-red-300" : "border-[#E2E8F0]"}`}
                  />
                </div>
                {phoneError && (
                  <p className="mt-1.5 text-xs text-red-500">{phoneError}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Job Title / Designation</label>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Engineering Manager"
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#334155] mb-1.5">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-[#E2E8F0] rounded-xl text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] transition-all bg-white"
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => router.push("/auth/setup-organization")}
                  className="px-6 py-3 border border-[#E2E8F0] text-[#64748B] rounded-xl text-sm font-semibold hover:bg-[#F8FAFC] transition-all"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !firstName.trim() || !lastName.trim() || !!phoneError}
                  className="flex-1 py-3 bg-[#2E86C1] text-white rounded-xl text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-[#2E86C1]/20"
                >
                  {loading && (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {loading ? "Saving..." : "Save & Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
