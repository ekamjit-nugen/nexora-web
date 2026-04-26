"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Organization } from "@/lib/api";

interface OrgSwitcherProps {
  currentOrg: Organization | null;
  organizations: Organization[];
  onSwitch: (orgId: string) => Promise<void>;
}

export function OrgSwitcher({ currentOrg, organizations, onSwitch }: OrgSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitch = async (orgId: string) => {
    if (orgId === currentOrg?._id) {
      setOpen(false);
      return;
    }
    setSwitching(orgId);
    try {
      await onSwitch(orgId);
      setOpen(false);
      router.push("/dashboard");
    } finally {
      setSwitching(null);
    }
  };

  const orgInitial = (name: string) => name.charAt(0).toUpperCase();

  if (!currentOrg && organizations.length === 0) return null;

  return (
    <div ref={ref} className="relative px-3 mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded-lg p-2.5 transition-colors"
      >
        {/* Org avatar */}
        <div className="w-8 h-8 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white text-sm font-bold shrink-0">
          {currentOrg ? orgInitial(currentOrg.name) : "?"}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[13px] font-semibold text-[#0F172A] truncate">
            {currentOrg?.name || "Select Organization"}
          </p>
          {currentOrg && (
            <p className="text-[10px] text-[#94A3B8] truncate capitalize">{currentOrg.plan} plan</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-[#94A3B8] shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-lg shadow-black/[0.08] z-[60] overflow-hidden">
          <div className="p-1.5 max-h-[240px] overflow-y-auto">
            {organizations.map((org) => (
              <button
                key={org._id}
                onClick={() => handleSwitch(org._id)}
                disabled={switching === org._id}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left ${
                  org._id === currentOrg?._id
                    ? "bg-[#EBF5FF] text-[#2E86C1]"
                    : "hover:bg-[#F8FAFC] text-[#334155]"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                    org._id === currentOrg?._id
                      ? "bg-[#2E86C1] text-white"
                      : "bg-[#F1F5F9] text-[#64748B]"
                  }`}
                >
                  {orgInitial(org.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{org.name}</p>
                  <p className="text-[10px] text-[#94A3B8] capitalize">{org.industry || org.plan}</p>
                </div>
                {org._id === currentOrg?._id && (
                  <svg className="w-4 h-4 text-[#2E86C1] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {switching === org._id && (
                  <svg className="w-4 h-4 text-[#94A3B8] animate-spin shrink-0" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Create new org */}
          <div className="border-t border-[#E2E8F0] p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                router.push("/onboarding");
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#F8FAFC] text-[#64748B] transition-colors"
            >
              <div className="w-7 h-7 rounded-md bg-[#F1F5F9] flex items-center justify-center">
                <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-[13px] font-medium">Create New Organization</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
