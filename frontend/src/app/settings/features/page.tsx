"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

interface FeatureModule {
  key: string;
  name: string;
  description: string;
  icon: string;
  alwaysOn?: boolean;
  dependencies?: string[];
}

const FEATURES: FeatureModule[] = [
  { key: "projects", name: "Projects & Tasks", description: "Create and manage projects, tasks, sprints, and timesheets.", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  { key: "communication", name: "Communication", description: "Team chat, channels, direct messages, and announcements.", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { key: "calls", name: "Audio & Video Calls", description: "One-on-one and group calls with screen sharing.", icon: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" },
  { key: "attendance", name: "Attendance & Time Tracking", description: "Track check-ins, working hours, shifts, and overtime.", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", dependencies: ["Work Preferences must be configured"] },
  { key: "leaves", name: "Leave Management", description: "Apply, approve, and track employee leaves.", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", dependencies: ["Work Preferences must be configured"] },
  { key: "clients", name: "Client Management", description: "Manage clients, contacts, and client-specific projects.", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { key: "invoices", name: "Invoicing", description: "Generate and manage invoices, track payments.", icon: "M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z", dependencies: ["Business Details + GSTIN required"] },
  { key: "reports", name: "Reports & Analytics", description: "Generate reports across all enabled modules.", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "ai", name: "AI Assistant", description: "AI-powered insights, summaries, and recommendations.", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
  { key: "assetManagement", name: "Asset Management", description: "Track company assets like laptops, monitors, and equipment.", icon: "M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" },
  { key: "expenseManagement", name: "Expense Management", description: "Employee expense claims, approvals, and reimbursements.", icon: "M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" },
  { key: "recruitment", name: "Recruitment", description: "Job postings, applicant tracking, and hiring pipeline.", icon: "M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" },
];

export default function FeaturesPage() {
  const { currentOrg, refreshOrgs } = useAuth();
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    settingsApi.getFeatures().then((res: any) => {
      const f = res.data || {};
      const state: Record<string, boolean> = {};
      FEATURES.forEach(feat => {
        state[feat.key] = f[feat.key]?.enabled ?? f[feat.key] ?? true;
      });
      setFeatures(state);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentOrg]);

  const toggleFeature = (key: string) => {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, { enabled: boolean }> = {};
      Object.entries(features).forEach(([k, v]) => { payload[k] = { enabled: v }; });
      await settingsApi.updateFeatures(payload);
      await refreshOrgs();
      toast.success("Feature settings saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  const enabledCount = Object.values(features).filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">Feature Management</h2>
          <p className="text-[13px] text-[#64748B] mt-1">Enable or disable modules based on what your organization needs. {enabledCount}/{FEATURES.length} active.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="bg-[#2E86C1] text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50 shadow-sm">
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((feat) => {
          const enabled = features[feat.key] ?? true;
          return (
            <div key={feat.key} className={`bg-white rounded-xl border p-5 shadow-sm transition-all ${enabled ? "border-[#E2E8F0]" : "border-[#E2E8F0] opacity-60"}`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${enabled ? "bg-[#2E86C1]/10" : "bg-[#F1F5F9]"}`}>
                  <svg className={`w-5 h-5 ${enabled ? "text-[#2E86C1]" : "text-[#94A3B8]"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={feat.icon} />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-[#0F172A]">{feat.name}</h3>
                    {feat.alwaysOn ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">Always On</span>
                    ) : (
                      <button onClick={() => toggleFeature(feat.key)}
                        className={`relative inline-flex h-7 w-[52px] items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:ring-offset-2 ${enabled ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}>
                        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${enabled ? "translate-x-[26px]" : "translate-x-[3px]"}`} />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-1">{feat.description}</p>
                  {feat.dependencies && !enabled && (
                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {feat.dependencies[0]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
        <svg className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-amber-800">Disabling a module hides it from navigation</p>
          <p className="text-xs text-amber-600 mt-0.5">Data is retained — re-enabling will restore everything. API access is also blocked for disabled modules.</p>
        </div>
      </div>
    </div>
  );
}
