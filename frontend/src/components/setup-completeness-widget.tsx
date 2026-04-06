"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import Link from "next/link";

interface CompletenessCategory {
  weight: number;
  complete: boolean;
}

interface CompletenessData {
  percentage: number;
  categories: Record<string, CompletenessCategory>;
  nextAction: string;
}

const CATEGORY_META: Record<string, { label: string; icon: string; link: string }> = {
  basicInfo: { label: "Basic Info", icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21", link: "/settings/organization" },
  businessDetails: { label: "Business Details", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", link: "/settings/business" },
  payrollSetup: { label: "Payroll Setup", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", link: "/settings/payroll" },
  workConfig: { label: "Work Config", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", link: "/settings/work-preferences" },
  branding: { label: "Branding", icon: "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z", link: "/settings/branding" },
  teamSetup: { label: "Team Setup", icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z", link: "/settings/members" },
};

export function SetupCompletenessWidget() {
  const [data, setData] = useState<CompletenessData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const wasDismissed = localStorage.getItem("nexora-setup-dismissed");
    if (wasDismissed === "true") {
      setDismissed(true);
      setLoading(false);
      return;
    }
    settingsApi.getCompleteness().then((res: any) => {
      setData(res.data || null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || dismissed || !data) return null;
  if (data.percentage >= 100) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("nexora-setup-dismissed", "true");
  };

  const completedCount = Object.values(data.categories).filter(c => c.complete).length;
  const totalCount = Object.keys(data.categories).length;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2E86C1]/10 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A]">Complete Your Setup</h3>
            <p className="text-xs text-[#64748B] mt-0.5">{completedCount} of {totalCount} steps completed — {data.percentage}%</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#64748B] transition-colors" title="Dismiss">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#E2E8F0] rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-[#2E86C1] to-[#5DADE2] rounded-full transition-all duration-700 ease-out"
          style={{ width: `${data.percentage}%` }} />
      </div>

      {/* Category checklist */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {Object.entries(data.categories).map(([key, cat]) => {
          const meta = CATEGORY_META[key];
          if (!meta) return null;
          return (
            <Link key={key} href={meta.link}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                cat.complete
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200/50"
                  : "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9] hover:text-[#334155]"
              }`}>
              {cat.complete ? (
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                </svg>
              )}
              <span className="font-medium">{meta.label}</span>
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
