"use client";

import { useEffect, useState } from "react";
import { settingsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { OrgFeatures } from "@/lib/api";
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

// Each setup category maps to a feature flag. When the feature is
// disabled for the tenant (super-admin toggled it off), the category
// is hidden from the widget AND the percentage / nextAction are
// recomputed against only the visible ones — so a Nugen-style tenant
// (no payroll) doesn't see "Payroll Setup 0%" or "Next: Add business
// details to enable payroll" prompts that don't apply.
const CATEGORY_META: Record<string, {
  label: string;
  icon: string;
  link: string;
  feature?: keyof OrgFeatures;
}> = {
  basicInfo:       { label: "Basic Info",       icon: "M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21", link: "/settings/organization" },
  businessDetails: { label: "Business Details", icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", link: "/settings/business" },
  payrollSetup:    { label: "Payroll Setup",    icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z", link: "/settings/payroll", feature: "payroll" },
  workConfig:      { label: "Work Config",      icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", link: "/settings/work-preferences", feature: "attendance" },
  branding:        { label: "Branding",         icon: "M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z", link: "/settings/branding" },
  teamSetup:       { label: "Team Setup",       icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z", link: "/settings/members" },
};

// Keywords that indicate the backend's nextAction is recommending a
// step the tenant doesn't have enabled. If the next action mentions
// any of these AND the matching feature is OFF, we drop the action
// rather than nag the admin about something irrelevant.
const NEXT_ACTION_FEATURE_HINTS: Array<{ feature: keyof OrgFeatures; matches: RegExp }> = [
  { feature: "payroll",     matches: /payroll/i },
  { feature: "attendance",  matches: /attendance|work hours|shift/i },
  { feature: "leaves",      matches: /leave/i },
];

export function SetupCompletenessWidget() {
  const { isFeatureEnabled } = useAuth();
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

  // Filter out categories whose feature flag is OFF for the current
  // tenant (e.g. Nugen has payroll: false, so Payroll Setup is hidden).
  // We keep the original `data.categories` intact and just operate on
  // a derived `visibleCategories` map — that way the underlying API
  // contract stays unchanged.
  const visibleEntries = Object.entries(data.categories).filter(([key]) => {
    const meta = CATEGORY_META[key];
    if (!meta) return false; // unknown category — drop rather than render naked
    if (!meta.feature) return true; // no gate ⇒ always show
    return isFeatureEnabled(meta.feature);
  });

  if (visibleEntries.length === 0) return null;

  // Recompute percentage from only the visible categories. The
  // backend's number is computed against the full set, so an org
  // with payroll disabled would otherwise show "30%" even when the
  // visible work is 100% done. Weighted by each category's `weight`.
  const totalWeight = visibleEntries.reduce((s, [, c]) => s + (c.weight || 0), 0) || 1;
  const completedWeight = visibleEntries.reduce(
    (s, [, c]) => s + (c.complete ? (c.weight || 0) : 0),
    0,
  );
  const visiblePercentage = Math.round((completedWeight / totalWeight) * 100);

  if (visiblePercentage >= 100) return null;

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("nexora-setup-dismissed", "true");
  };

  const completedCount = visibleEntries.filter(([, c]) => c.complete).length;
  const totalCount = visibleEntries.length;

  // Suppress the "Next:" hint if it's recommending a step the tenant
  // doesn't have enabled (e.g. "Add business details to enable payroll"
  // makes no sense when payroll is off).
  const nextAction = (() => {
    if (!data.nextAction) return null;
    for (const hint of NEXT_ACTION_FEATURE_HINTS) {
      if (hint.matches.test(data.nextAction) && !isFeatureEnabled(hint.feature)) {
        return null;
      }
    }
    return data.nextAction;
  })();

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
            <p className="text-xs text-[#64748B] mt-0.5">{completedCount} of {totalCount} steps completed — {visiblePercentage}%</p>
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
          style={{ width: `${visiblePercentage}%` }} />
      </div>

      {/* Category checklist — only feature-enabled categories render. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {visibleEntries.map(([key, cat]) => {
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

      {/* Next action — suppressed when it references a disabled feature. */}
      {nextAction && (
        <div className="flex items-center gap-2 text-xs text-[#2E86C1] bg-[#2E86C1]/5 rounded-lg px-3 py-2">
          <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="font-medium">Next: {nextAction}</span>
        </div>
      )}
    </div>
  );
}
