"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

interface NotificationPrefs {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  categories: {
    attendance: { email: boolean; inApp: boolean };
    leaveApprovals: { email: boolean; inApp: boolean };
    taskAssignments: { email: boolean; inApp: boolean };
    projectUpdates: { email: boolean; inApp: boolean };
    systemAlerts: { email: boolean; inApp: boolean };
  };
}

const defaultNotifPrefs: NotificationPrefs = {
  emailEnabled: true,
  inAppEnabled: true,
  categories: {
    attendance: { email: true, inApp: true },
    leaveApprovals: { email: true, inApp: true },
    taskAssignments: { email: true, inApp: true },
    projectUpdates: { email: false, inApp: true },
    systemAlerts: { email: true, inApp: true },
  },
};

const STORAGE_KEY = "nexora-notification-preferences";

function loadNotifPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return defaultNotifPrefs;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return { ...defaultNotifPrefs, ...JSON.parse(saved) };
  } catch {
    // ignore
  }
  return defaultNotifPrefs;
}

const categoryLabels: Record<string, { label: string; description: string }> = {
  attendance: { label: "Attendance", description: "Clock-in reminders, late arrival alerts" },
  leaveApprovals: { label: "Leave Approvals", description: "Leave request updates and approvals" },
  taskAssignments: { label: "Task Assignments", description: "New task assignments and status changes" },
  projectUpdates: { label: "Project Updates", description: "Project milestones and team changes" },
  systemAlerts: { label: "System Alerts", description: "Security alerts and system notifications" },
};

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(defaultNotifPrefs);

  useEffect(() => {
    setPrefs(loadNotifPrefs());
  }, []);

  const save = (updated: NotificationPrefs) => {
    setPrefs(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    toast.success("Notification preferences saved");
  };

  const updateGlobal = (key: "emailEnabled" | "inAppEnabled", val: boolean) => {
    save({ ...prefs, [key]: val });
  };

  const updateCategory = (
    cat: keyof NotificationPrefs["categories"],
    type: "email" | "inApp",
    val: boolean
  ) => {
    save({
      ...prefs,
      categories: {
        ...prefs.categories,
        [cat]: { ...prefs.categories[cat], [type]: val },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Notifications</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Choose how and when you want to be notified.
        </p>
      </div>

      {/* Global toggles */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Global Settings</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">Email Notifications</p>
              <p className="text-xs text-[#64748B]">Receive notifications via email</p>
            </div>
            <Toggle checked={prefs.emailEnabled} onChange={(v) => updateGlobal("emailEnabled", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#0F172A]">In-App Notifications</p>
              <p className="text-xs text-[#64748B]">Show notifications inside Nexora</p>
            </div>
            <Toggle checked={prefs.inAppEnabled} onChange={(v) => updateGlobal("inAppEnabled", v)} />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Notification Categories</h3>

        {/* Header row */}
        <div className="flex items-center gap-4 mb-3 px-4">
          <div className="flex-1" />
          <span className="w-16 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            Email
          </span>
          <span className="w-16 text-center text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            In-App
          </span>
        </div>

        <div className="space-y-1">
          {(Object.keys(prefs.categories) as (keyof NotificationPrefs["categories"])[]).map(
            (cat) => {
              const info = categoryLabels[cat];
              return (
                <div
                  key={cat}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#0F172A]">{info.label}</p>
                    <p className="text-xs text-[#64748B]">{info.description}</p>
                  </div>
                  <div className="w-16 flex justify-center">
                    <Toggle
                      checked={prefs.categories[cat].email}
                      onChange={(v) => updateCategory(cat, "email", v)}
                    />
                  </div>
                  <div className="w-16 flex justify-center">
                    <Toggle
                      checked={prefs.categories[cat].inApp}
                      onChange={(v) => updateCategory(cat, "inApp", v)}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>
    </div>
  );
}
