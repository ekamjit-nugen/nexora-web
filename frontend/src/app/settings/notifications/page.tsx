"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { settingsApi } from "@/lib/api";
import { toast } from "sonner";

interface NotificationPrefs {
  channels: {
    inApp: boolean;
    email: boolean;
    desktopPush: boolean;
    mobilePush: boolean;
    internalChat: boolean;
  };
  categories: {
    attendance: { inApp: boolean; email: boolean };
    leave: { inApp: boolean; email: boolean };
    payroll: { inApp: boolean; email: boolean };
    tasks: { inApp: boolean; email: boolean };
    projects: { inApp: boolean; email: boolean };
    members: { inApp: boolean; email: boolean };
    system: { inApp: boolean; email: boolean };
    announcements: { inApp: boolean; email: boolean };
  };
  escalation: {
    leavePendingReminderHours: number;
    leaveAutoEscalationDays: number;
    leaveAutoApproveDays: number | null;
  };
}

const defaultPrefs: NotificationPrefs = {
  channels: { inApp: true, email: false, desktopPush: false, mobilePush: false, internalChat: true },
  categories: {
    attendance: { inApp: true, email: false },
    leave: { inApp: true, email: true },
    payroll: { inApp: true, email: true },
    tasks: { inApp: true, email: false },
    projects: { inApp: true, email: false },
    members: { inApp: true, email: true },
    system: { inApp: true, email: true },
    announcements: { inApp: true, email: true },
  },
  escalation: { leavePendingReminderHours: 24, leaveAutoEscalationDays: 3, leaveAutoApproveDays: 0 },
};

const CATEGORY_META: Record<string, { label: string; description: string; icon: string }> = {
  attendance: { label: "Attendance", description: "Late marks, absences, regularization requests", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  leave: { label: "Leave", description: "New requests, approvals, rejections, upcoming leave", icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" },
  payroll: { label: "Payroll", description: "Payslip generated, tax proof deadline, salary revision", icon: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" },
  tasks: { label: "Tasks", description: "Assigned, due soon, overdue, completed, comments", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  projects: { label: "Projects", description: "Milestone due, status updates, member changes", icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" },
  members: { label: "Members", description: "New members joined, deactivated, role changes", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  system: { label: "System", description: "Maintenance, feature updates, security alerts", icon: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" },
  announcements: { label: "Announcements", description: "Company-wide announcements and updates", icon: "M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" },
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (val: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const { currentOrg } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    setLoading(true);
    settingsApi.getNotifications().then((res: any) => {
      const d = res.data;
      if (d) {
        setPrefs({
          channels: { ...defaultPrefs.channels, ...(d.channels || {}) },
          categories: { ...defaultPrefs.categories, ...(d.categories || {}) },
          escalation: { ...defaultPrefs.escalation, ...(d.escalation || {}) },
        });
      }
    }).catch(() => {
      // Fall back to localStorage for backward compat
      try {
        const saved = localStorage.getItem("nexora-notification-preferences");
        if (saved) {
          const old = JSON.parse(saved);
          setPrefs(prev => ({
            ...prev,
            channels: { ...prev.channels, email: old.emailEnabled ?? false, inApp: old.inAppEnabled ?? true },
          }));
        }
      } catch {}
    }).finally(() => setLoading(false));
  }, [currentOrg]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.updateNotifications(prefs as any);
      toast.success("Notification preferences saved");
    } catch (err: unknown) {
      // Fallback to localStorage
      localStorage.setItem("nexora-notification-preferences", JSON.stringify(prefs));
      toast.success("Preferences saved locally");
    } finally {
      setSaving(false);
    }
  };

  const updateChannel = (key: keyof NotificationPrefs["channels"], val: boolean) => {
    setPrefs(p => ({ ...p, channels: { ...p.channels, [key]: val } }));
  };

  const updateCategory = (cat: string, type: "email" | "inApp", val: boolean) => {
    setPrefs(p => ({
      ...p,
      categories: { ...p.categories, [cat]: { ...(p.categories as any)[cat], [type]: val } },
    }));
  };

  const updateEscalation = (key: string, val: number) => {
    setPrefs(p => ({ ...p, escalation: { ...p.escalation, [key]: val } }));
  };

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

  if (loading) return <div className="flex justify-center py-20"><svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">Notification Preferences</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Configure how and when your organization receives notifications.</p>
      </div>

      {/* Channels */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
          Notification Channels
        </h3>
        <div className="space-y-4">
          {([
            { key: "inApp" as const, label: "In-App Notifications", desc: "Show notifications inside Nexora" },
            { key: "email" as const, label: "Email Notifications", desc: "Send notifications via email" },
            { key: "desktopPush" as const, label: "Desktop Push", desc: "Browser push notifications" },
            { key: "internalChat" as const, label: "Nexora Chat", desc: "Send via the communication module" },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm font-medium text-[#0F172A]">{label}</p>
                <p className="text-xs text-[#64748B]">{desc}</p>
              </div>
              <Toggle checked={prefs.channels[key]} onChange={(v) => updateChannel(key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
          </svg>
          Notification Categories
        </h3>

        <div className="flex items-center gap-4 mb-3 px-4">
          <div className="flex-1" />
          <span className="w-16 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">Email</span>
          <span className="w-16 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">In-App</span>
        </div>

        <div className="space-y-1">
          {Object.keys(prefs.categories).map((cat) => {
            const meta = CATEGORY_META[cat];
            if (!meta) return null;
            const catPrefs = (prefs.categories as any)[cat];
            return (
              <div key={cat} className="flex items-center gap-4 p-4 rounded-lg hover:bg-[#F8FAFC] transition-colors">
                <div className="w-8 h-8 rounded-lg bg-[#F1F5F9] flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={meta.icon} />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#0F172A]">{meta.label}</p>
                  <p className="text-xs text-[#64748B]">{meta.description}</p>
                </div>
                <div className="w-16 flex justify-center">
                  <Toggle checked={catPrefs.email} onChange={(v) => updateCategory(cat, "email", v)} />
                </div>
                <div className="w-16 flex justify-center">
                  <Toggle checked={catPrefs.inApp} onChange={(v) => updateCategory(cat, "inApp", v)} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Escalation Rules */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
          <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Escalation Rules
        </h3>
        <p className="text-xs text-[#94A3B8] mb-5">Configure automatic reminders and escalation for leave requests.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={labelClass}>Leave Pending Reminder</label>
            <div className="flex items-center gap-2">
              <input type="number" value={prefs.escalation.leavePendingReminderHours}
                onChange={(e) => updateEscalation("leavePendingReminderHours", parseInt(e.target.value) || 24)}
                className={inputClass} min={1} max={168} />
              <span className="text-xs text-[#94A3B8] whitespace-nowrap">hours</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">Remind approver after this many hours</p>
          </div>
          <div>
            <label className={labelClass}>Auto-Escalation</label>
            <div className="flex items-center gap-2">
              <input type="number" value={prefs.escalation.leaveAutoEscalationDays}
                onChange={(e) => updateEscalation("leaveAutoEscalationDays", parseInt(e.target.value) || 3)}
                className={inputClass} min={1} max={30} />
              <span className="text-xs text-[#94A3B8] whitespace-nowrap">days</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">Escalate to dept head / HR after</p>
          </div>
          <div>
            <label className={labelClass}>Auto-Approve</label>
            <div className="flex items-center gap-2">
              <input type="number" value={prefs.escalation.leaveAutoApproveDays || 0}
                onChange={(e) => updateEscalation("leaveAutoApproveDays", parseInt(e.target.value) || 0)}
                className={inputClass} min={0} max={30} />
              <span className="text-xs text-[#94A3B8] whitespace-nowrap">days</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">0 = never auto-approve</p>
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
