"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import Link from "next/link";

interface CompletenessCategory {
  weight: number;
  complete: boolean;
  label: string;
  link: string;
}

interface CompletenessData {
  percentage: number;
  categories: Record<string, CompletenessCategory>;
  nextAction: string;
}

// Icons keyed to the backend's category keys. Only things a non-admin user
// can actually change from /settings/profile.
const CATEGORY_META: Record<string, { icon: string }> = {
  basicInfo: {
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  profilePhoto: {
    icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  contactInfo: {
    icon: "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z",
  },
  roleInfo: {
    icon: "M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z",
  },
  bio: {
    icon: "M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z",
  },
};

export function ProfileCompletenessWidget() {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("nexora-profile-setup-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
      setLoading(false);
      return;
    }
    settingsApi
      .getProfileCompleteness()
      .then((res: any) => setData(res.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || dismissed || !data) return null;
  // Already complete — no nag.
  if (data.percentage >= 100) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("nexora-profile-setup-dismissed", "true");
  };

  const categoryEntries = Object.entries(data.categories);
  const completedCount = categoryEntries.filter(([, c]) => c.complete).length;
  const totalCount = categoryEntries.length;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2E86C1]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Complete Your Profile</h3>
            <p className="text-xs text-[#64748B] mt-0.5">
              {completedCount} of {totalCount} steps completed — {data.percentage}%
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#64748B] transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${data.percentage}%` }}
        />
      </div>

      {/* Category checklist */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {categoryEntries.map(([key, cat]) => {
          const meta = CATEGORY_META[key];
          return (
            <Link
              key={key}
              href={cat.link}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                cat.complete
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  : "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9] hover:text-[#334155]"
              }`}
            >
              {cat.complete ? (
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={meta?.icon || "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                </svg>
              )}
              <span className="font-medium">{cat.label}</span>
              <span className="ml-auto text-[10px] opacity-60">{cat.weight}%</span>
            </Link>
          );
        })}
      </div>

      {/* Next action */}
      {data.nextAction && (
        <div className="flex items-center gap-2 text-xs text-[#2E86C1] bg-[#2E86C1]/5 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="font-medium">Next: {data.nextAction}</span>
        </div>
      )}
    </div>
  );
}
