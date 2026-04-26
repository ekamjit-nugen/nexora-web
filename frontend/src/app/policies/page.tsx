"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { policyApi, hrApi, Policy } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { ConfirmModal } from "@/components/confirm-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

// ── Category definitions ──

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "working_hours", label: "Working Hours" },
  { key: "leave", label: "Leave" },
  { key: "wfh", label: "WFH" },
  { key: "overtime", label: "Overtime" },
  { key: "shift", label: "Shift" },
  { key: "expenses", label: "Expenses" },
  { key: "travel", label: "Travel" },
  { key: "reimbursement", label: "Reimbursement" },
  { key: "attendance", label: "Attendance" },
  { key: "invoices", label: "Invoices" },
  { key: "exemptions", label: "Exemptions" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const CATEGORY_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  attendance: { color: "text-blue-600", bg: "bg-blue-50", label: "Attendance" },
  working_hours: { color: "text-indigo-600", bg: "bg-indigo-50", label: "Working Hours" },
  leave: { color: "text-green-600", bg: "bg-green-50", label: "Leave" },
  wfh: { color: "text-purple-600", bg: "bg-purple-50", label: "WFH" },
  overtime: { color: "text-orange-600", bg: "bg-orange-50", label: "Overtime" },
  shift: { color: "text-cyan-600", bg: "bg-cyan-50", label: "Shift" },
  invoices: { color: "text-slate-600", bg: "bg-slate-100", label: "Invoices" },
  expenses: { color: "text-rose-600", bg: "bg-rose-50", label: "Expenses" },
  exemptions: { color: "text-amber-600", bg: "bg-amber-50", label: "Exemptions" },
  travel: { color: "text-teal-600", bg: "bg-teal-50", label: "Travel" },
  reimbursement: { color: "text-pink-600", bg: "bg-pink-50", label: "Reimbursement" },
};

const RULE_OPERATORS = ["equals", "not_equals", "greater_than", "less_than", "contains", "in", "between"];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function categoryStyle(cat: string) {
  return CATEGORY_STYLES[cat] || { color: "text-gray-600", bg: "bg-gray-100", label: cat };
}

// ── Default config builders ──

function defaultWorkTiming() {
  return { startTime: "09:00", endTime: "18:00", graceMinutes: 15, minWorkingHours: 8, breakMinutes: 60, timezone: "Asia/Kolkata" };
}

function defaultLeaveConfig() {
  return {
    leaveTypes: [
      { type: "casual", label: "Casual Leave", annualAllocation: 12, accrualFrequency: "monthly", accrualAmount: 1, maxCarryForward: 3, encashable: false, maxConsecutiveDays: 3, requiresDocument: false, applicableTo: "all", minServiceMonths: 0 },
      { type: "sick", label: "Sick Leave", annualAllocation: 12, accrualFrequency: "monthly", accrualAmount: 1, maxCarryForward: 6, encashable: false, maxConsecutiveDays: 5, requiresDocument: true, applicableTo: "all", minServiceMonths: 0 },
    ],
    yearStart: "january",
    halfDayAllowed: true,
  };
}

function defaultWfhConfig() {
  return { maxDaysPerMonth: 4, requiresApproval: true, allowedDays: [] as string[] };
}

function defaultOvertimeConfig() {
  return { maxOvertimeHoursPerDay: 4, maxOvertimeHoursPerWeek: 20, multiplier: 1.5, requiresApproval: true };
}

function defaultShiftConfig() {
  return { shifts: [{ name: "Morning", startTime: "06:00", endTime: "14:00" }, { name: "Evening", startTime: "14:00", endTime: "22:00" }] };
}

function defaultExpenseConfig() {
  return { maxAmountPerTransaction: 50000, requiresReceipt: true, approvalThreshold: 5000, allowedCategories: ["travel", "food", "office_supplies", "software"] };
}

function defaultTravelConfig() {
  return { perDiemAmount: 2000, maxHotelRate: 5000, requiresPreApproval: true, advanceAllowed: true };
}

function defaultReimbursementConfig() {
  return { maxClaimAmount: 100000, submissionDeadlineDays: 30, requiresReceipts: true };
}

function defaultInvoiceConfig() {
  return { paymentTermDays: 30, lateFeePercentage: 2, currency: "INR" };
}

function defaultExemptionConfig() {
  return { type: "tax", criteria: "", autoApprove: false };
}

function defaultAttendanceConfig() {
  return { maxWorkingHoursPerWeek: 40, alerts: { lateArrival: true, earlyDeparture: true, missedClockIn: false, overtimeAlert: false } };
}

function getDefaultConfigForCategory(cat: string): Record<string, unknown> {
  switch (cat) {
    case "working_hours": return defaultWorkTiming();
    case "leave": return defaultLeaveConfig();
    case "wfh": return defaultWfhConfig();
    case "overtime": return defaultOvertimeConfig();
    case "shift": return defaultShiftConfig();
    case "expenses": return defaultExpenseConfig();
    case "travel": return defaultTravelConfig();
    case "reimbursement": return defaultReimbursementConfig();
    case "invoices": return defaultInvoiceConfig();
    case "exemptions": return defaultExemptionConfig();
    case "attendance": return defaultAttendanceConfig();
    default: return {};
  }
}

function getConfigKey(cat: string): string {
  const map: Record<string, string> = {
    working_hours: "workTiming",
    leave: "leaveConfig",
    wfh: "wfhConfig",
    overtime: "overtimeConfig",
    shift: "shiftConfig",
    expenses: "expenseConfig",
    travel: "travelConfig",
    reimbursement: "reimbursementConfig",
    invoices: "invoiceConfig",
    exemptions: "exemptionConfig",
    attendance: "attendanceConfig",
  };
  return map[cat] || "workTiming";
}

// ── Empty form ──

function emptyForm(): Partial<Policy> {
  return {
    policyName: "",
    description: "",
    category: "working_hours",
    workTiming: defaultWorkTiming(),
    applicableTo: "all",
    applicableIds: [],
    isActive: true,
    rules: [],
  };
}

// ── Spinner component ──

function Spinner({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={`animate-spin text-[#2E86C1] ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Checkbox component ──

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={onChange}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          checked ? "bg-[#2E86C1] border-[#2E86C1] text-white" : "border-[#CBD5E1] hover:border-[#94A3B8]"
        }`}
      >
        {checked && (
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <span className="text-[12px] text-[#334155] font-medium">{label}</span>
    </label>
  );
}

// ════════════════════════════════════════════════════════════
// ── MAIN PAGE COMPONENT ──
// ════════════════════════════════════════════════════════════

export default function PoliciesPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [policies, setPolicies] = useState<Policy[]>([]);
  const [templates, setTemplates] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "templates">("active");
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [showModal, setShowModal] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [historyPolicy, setHistoryPolicy] = useState<Policy | null>(null);
  const [versionHistory, setVersionHistory] = useState<Policy[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [form, setForm] = useState<Partial<Policy>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; variant?: "danger" | "warning" | "info"; confirmLabel?: string; action: () => void}>({open: false, title: "", message: "", action: () => {}});

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [policiesRes, templatesRes] = await Promise.all([
        policyApi.getAll(),
        policyApi.getTemplates(),
      ]);
      setPolicies(policiesRes.data || []);
      setTemplates(templatesRes.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load policies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  // ── Form helpers ──

  const setField = (key: string, value: unknown) => {
    if (key === "category") {
      const cat = value as string;
      const configKey = getConfigKey(cat);
      setForm((p) => ({
        ...p,
        category: cat,
        [configKey]: (p as Record<string, unknown>)[configKey] || getDefaultConfigForCategory(cat),
      }));
      return;
    }
    setForm((p) => ({ ...p, [key]: value }));
  };

  // Parse number input value — keeps as string while editing, converts to number on non-empty
  const numVal = (v: string): string | number => {
    if (v === "" || v === "-") return v;
    const n = Number(v);
    return isNaN(n) ? v : n;
  };
  // Safe value for inputs — converts null/undefined/object to fallback string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nv = (val: any, fallback: number | string = ""): string | number => {
    if (val === null || val === undefined || typeof val === "object") return fallback;
    return val;
  };

  const setConfig = (configKey: string, fieldKey: string, value: unknown) => {
    setForm((p) => ({
      ...p,
      [configKey]: { ...((p as Record<string, unknown>)[configKey] as Record<string, unknown> || {}), [fieldKey]: value },
    }));
  };

  const getConfig = (configKey: string): Record<string, unknown> => {
    return ((form as Record<string, unknown>)[configKey] as Record<string, unknown>) || {};
  };

  // ── Rule helpers ──

  const addRule = () => {
    setForm((p) => ({
      ...p,
      rules: [...(p.rules || []), { key: "", operator: "equals", value: "", description: "" }],
    }));
  };

  const updateRule = (idx: number, field: string, value: unknown) => {
    setForm((p) => {
      const rules = [...(p.rules || [])];
      rules[idx] = { ...rules[idx], [field]: value };
      return { ...p, rules };
    });
  };

  const removeRule = (idx: number) => {
    setForm((p) => {
      const rules = [...(p.rules || [])];
      rules.splice(idx, 1);
      return { ...p, rules };
    });
  };

  // ── Leave type helpers ──

  const getLeaveTypes = (): Array<Record<string, unknown>> => {
    const cfg = getConfig("leaveConfig");
    return (cfg.leaveTypes as Array<Record<string, unknown>>) || [];
  };

  const updateLeaveType = (idx: number, key: string, value: unknown) => {
    const types = [...getLeaveTypes()];
    types[idx] = { ...types[idx], [key]: value };
    setConfig("leaveConfig", "leaveTypes", types);
  };

  const removeLeaveType = (idx: number) => {
    const types = [...getLeaveTypes()];
    types.splice(idx, 1);
    setConfig("leaveConfig", "leaveTypes", types);
  };

  const addLeaveType = () => {
    const types = [...getLeaveTypes()];
    types.push({ type: "", label: "", annualAllocation: 0, accrualFrequency: "monthly", accrualAmount: 0, maxCarryForward: 0, encashable: false, maxConsecutiveDays: 0, requiresDocument: false, applicableTo: "all", minServiceMonths: 0 });
    setConfig("leaveConfig", "leaveTypes", types);
  };

  // ── Shift helpers ──

  const getShifts = (): Array<Record<string, unknown>> => {
    const cfg = getConfig("shiftConfig");
    return (cfg.shifts as Array<Record<string, unknown>>) || [];
  };

  const updateShift = (idx: number, key: string, value: unknown) => {
    const shifts = [...getShifts()];
    shifts[idx] = { ...shifts[idx], [key]: value };
    setConfig("shiftConfig", "shifts", shifts);
  };

  const removeShift = (idx: number) => {
    const shifts = [...getShifts()];
    shifts.splice(idx, 1);
    setConfig("shiftConfig", "shifts", shifts);
  };

  const addShift = () => {
    const shifts = [...getShifts()];
    shifts.push({ name: "", startTime: "09:00", endTime: "17:00" });
    setConfig("shiftConfig", "shifts", shifts);
  };

  // ── Expense categories helpers ──

  const getExpenseCategories = (): string[] => {
    const cfg = getConfig("expenseConfig");
    return (cfg.categories as string[]) || [];
  };

  const addExpenseCategory = () => {
    setConfig("expenseConfig", "categories", [...getExpenseCategories(), ""]);
  };

  const updateExpenseCategory = (idx: number, val: string) => {
    const cats = [...getExpenseCategories()];
    cats[idx] = val;
    setConfig("expenseConfig", "categories", cats);
  };

  const removeExpenseCategory = (idx: number) => {
    const cats = [...getExpenseCategories()];
    cats.splice(idx, 1);
    setConfig("expenseConfig", "categories", cats);
  };

  // ── Modal openers ──

  const openCreate = () => {
    setEditingPolicy(null);
    setForm(emptyForm());
    setShowModal(true);
  };

  const openEdit = (p: Policy) => {
    setEditingPolicy(p);
    setForm({ ...p });
    setShowModal(true);
  };

  const openFromTemplate = (t: Policy) => {
    setEditingPolicy(null);
    setForm({
      ...t,
      _id: undefined as unknown as string,
      policyName: `${t.policyName} (Copy)`,
      isTemplate: false,
      isActive: true,
      sourceTemplateId: t._id,
    });
    setShowModal(true);
  };

  // ── Save ──

  const handleSave = async () => {
    if (!form.policyName?.trim()) {
      toast.error("Policy name is required");
      return;
    }
    try {
      setSaving(true);
      const configKey = getConfigKey(form.category || "working_hours");
      const payload: Partial<Policy> = {
        policyName: form.policyName,
        description: form.description,
        category: form.category,
        [configKey]: (form as Record<string, unknown>)[configKey],
        rules: form.rules,
        applicableTo: form.applicableTo,
        applicableIds: form.applicableIds,
        isActive: form.isActive,
        changeLog: form.changeLog,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo,
        acknowledgementRequired: form.acknowledgementRequired,
        sourceTemplateId: form.sourceTemplateId,
      };

      if (editingPolicy) {
        await policyApi.update(editingPolicy._id, payload);
        toast.success("Policy updated");
      } else if (form.sourceTemplateId) {
        await policyApi.createFromTemplate(form.sourceTemplateId, payload);
        toast.success("Policy created from template");
      } else {
        await policyApi.create(payload);
        toast.success("Policy created");
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──

  const handleDelete = (p: Policy) => {
    setConfirmState({
      open: true,
      title: "Delete Policy",
      message: `Are you sure you want to delete "${p.policyName}"?`,
      variant: "danger",
      confirmLabel: "Delete",
      action: async () => {
        setConfirmState(s => ({...s, open: false}));
        try {
          await policyApi.delete(p._id);
          toast.success("Policy deleted");
          fetchData();
        } catch {
          toast.error("Failed to delete");
        }
      },
    });
  };

  // ── Toggle active ──

  const handleToggleActive = async (p: Policy) => {
    try {
      await policyApi.update(p._id, { isActive: !p.isActive });
      setPolicies((prev) => prev.map((x) => (x._id === p._id ? { ...x, isActive: !x.isActive } : x)));
      toast.success(p.isActive ? "Policy deactivated" : "Policy activated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  // ── Version history ──

  const [userNames, setUserNames] = useState<Record<string, string>>({});

  const openVersionHistory = async (p: Policy) => {
    setHistoryPolicy(p);
    setShowHistoryDrawer(true);
    setHistoryLoading(true);
    try {
      const res = await policyApi.getVersionHistory(p._id);
      setVersionHistory(res.data || []);

      // Resolve user names (best effort)
      const names: Record<string, string> = {};
      if (user) names[user._id] = `${user.firstName} ${user.lastName}`.trim();
      try {
        const empRes = await hrApi.getEmployees({ limit: "200" });
        for (const emp of (empRes.data || [])) {
          if (emp.userId) names[emp.userId] = `${emp.firstName} ${emp.lastName}`.trim();
          if (emp._id) names[emp._id] = `${emp.firstName} ${emp.lastName}`.trim();
        }
      } catch { /* employees fetch is optional */ }
      setUserNames(names);
    } catch (err) {
      console.error("Version history error:", err);
      toast.error("Failed to load version history");
      setVersionHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── Auth loading / unauthenticated ──

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <Spinner />
      </div>
    );
  }

  // ── Access check ──

  const hasAccess = user.roles?.some((r) => ["admin", "super_admin", "hr"].includes(r));
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 min-w-0 md:ml-[260px] p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="border-0 shadow-sm max-w-md w-full">
              <CardContent className="flex flex-col items-center justify-center py-16 px-8">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-[#0F172A] mb-2">Access Denied</h2>
                <p className="text-[13px] text-[#64748B] text-center mb-6">You don&apos;t have permission to view this page. Contact your administrator.</p>
                <Link href="/dashboard" className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white transition-colors">
                  Go to Dashboard
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // ── Filter data ──

  const activePolicies = policies.filter((p) => !p.isDeleted && !p.isTemplate);
  const filteredPolicies = selectedCategory === "all" ? activePolicies : activePolicies.filter((p) => p.category === selectedCategory);
  const filteredTemplates = selectedCategory === "all" ? templates : templates.filter((t) => t.category === selectedCategory);
  const activeCount = activePolicies.filter((p) => p.isActive).length;
  const inactiveCount = activePolicies.filter((p) => !p.isActive).length;

  // ════════════════════════════════════════════════════════════
  // ── RENDER ──
  // ════════════════════════════════════════════════════════════

  return (
    <RouteGuard minOrgRole="member">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] p-8">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Policies</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Manage organizational policies across all categories — working hours, leave, attendance, expenses, and more
            </p>
          </div>
          <Button onClick={openCreate} className="h-10 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-4 rounded-xl text-[13px]">
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Policy
          </Button>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Policies", value: activePolicies.length, icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z", color: "text-blue-600 bg-blue-50" },
            { label: "Active", value: activeCount, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-emerald-600 bg-emerald-50" },
            { label: "Templates", value: templates.length, icon: "M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2", color: "text-violet-600 bg-violet-50" },
            { label: "Draft / Inactive", value: inactiveCount, icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636", color: "text-amber-600 bg-amber-50" },
          ].map((s) => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748B]">{s.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5">{s.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${s.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Category filter pills ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                selectedCategory === cat.key
                  ? "bg-[#2E86C1] text-white border-[#2E86C1]"
                  : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#2E86C1] hover:text-[#2E86C1]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 bg-white rounded-xl p-1 shadow-sm w-fit">
          {(["active", "templates"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                activeTab === tab ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"
              }`}
            >
              {tab === "active" ? "Active Policies" : "Templates"}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : activeTab === "active" ? (
          /* ── Active Policies Tab ── */
          filteredPolicies.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#334155]">No policies found</p>
                <p className="text-[13px] text-[#94A3B8] mt-1">
                  {selectedCategory !== "all" ? `No ${categoryStyle(selectedCategory).label} policies. ` : ""}
                  Create your first policy or use a template.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPolicies.map((p) => {
                const cs = categoryStyle(p.category);
                return (
                  <Card key={p._id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openEdit(p)}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2.5 mb-2">
                        <div className={`w-9 h-9 rounded-lg ${cs.bg} ${cs.color} flex items-center justify-center shrink-0`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">{p.policyName}</p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cs.bg} ${cs.color} shrink-0`}>
                              {cs.label}
                            </span>
                            {p.version != null && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] shrink-0">
                                v{p.version}
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] text-[#64748B] line-clamp-1 mt-0.5">{p.description || "No description"}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] bg-[#F1F5F9] text-[#64748B] px-1.5 py-0.5 rounded-full capitalize">
                          {p.applicableTo === "all" ? "All Employees" : p.applicableTo === "department" ? "Department" : p.applicableTo === "designation" ? "Designation" : "Specific"}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(p); }}
                          className={`relative w-8 h-[18px] rounded-full transition-colors ${p.isActive ? "bg-emerald-500" : "bg-[#CBD5E1]"}`}
                        >
                          <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${p.isActive ? "left-[16px]" : "left-[2px]"}`} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pt-2.5 border-t border-[#F1F5F9]">
                        <button onClick={(e) => { e.stopPropagation(); openEdit(p); }} className="flex-1 text-center py-1.5 text-[12px] font-medium text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors">
                          Edit
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openVersionHistory(p); }} className="flex-1 text-center py-1.5 text-[12px] font-medium text-[#64748B] hover:bg-[#F1F5F9] rounded-lg transition-colors">
                          History
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(p); }} className="flex-1 text-center py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                          Delete
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* ── Templates Tab ── */
          filteredTemplates.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                  <svg className="w-7 h-7 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-[#334155]">No templates available</p>
                <p className="text-[13px] text-[#94A3B8] mt-1">Templates will appear here once created</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((t) => {
                const cs = categoryStyle(t.category);
                return (
                  <Card key={t._id} className="border-0 shadow-sm hover:shadow-md transition-shadow relative">
                    <CardContent className="p-4">
                      {/* Template badge */}
                      <div className="absolute top-3 right-3">
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          TEMPLATE
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5 mb-2 pr-20">
                        <div className={`w-9 h-9 rounded-lg ${cs.bg} ${cs.color} flex items-center justify-center shrink-0`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-[13px] font-semibold text-[#0F172A] truncate">
                              {t.templateName || t.policyName}
                            </p>
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cs.bg} ${cs.color} shrink-0`}>
                              {cs.label}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#64748B] line-clamp-2 mt-0.5">{t.description || "No description"}</p>
                        </div>
                      </div>
                      <div className="pt-2.5 border-t border-[#F1F5F9]">
                        <button
                          onClick={() => openFromTemplate(t)}
                          className="w-full text-center py-1.5 text-[12px] font-medium text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors"
                        >
                          Use Template
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )
        )}
      </main>

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── CREATE / EDIT MODAL ── */}
      {/* ════════════════════════════════════════════════════════════ */}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2E8F0] sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-sm font-bold text-[#0F172A]">
                {editingPolicy ? "Edit Policy" : form.sourceTemplateId ? "Create from Template" : "Create Policy"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* ── Basic Info ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Basic Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-[12px] font-medium text-[#334155]">Policy Name</Label>
                    <Input
                      value={form.policyName || ""}
                      onChange={(e) => setField("policyName", e.target.value)}
                      placeholder="e.g. Standard Work Hours"
                      className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-[12px] font-medium text-[#334155]">Category</Label>
                    <select
                      value={form.category || "working_hours"}
                      onChange={(e) => setField("category", e.target.value)}
                      className="w-full h-9 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 mt-1 outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                    >
                      {CATEGORIES.filter((c) => c.key !== "all").map((c) => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <Label className="text-[12px] font-medium text-[#334155]">Description</Label>
                  <textarea
                    value={form.description || ""}
                    onChange={(e) => setField("description", e.target.value)}
                    placeholder="Brief description of this policy"
                    rows={2}
                    className="w-full text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 mt-1 outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  />
                </div>
              </div>

              {/* ── Category-specific fields ── */}

              {/* Working Hours */}
              {form.category === "working_hours" && (() => {
                const cfg = getConfig("workTiming");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Working Hours Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Start Time</Label>
                        <Input type="time" value={(cfg.startTime as string) || "09:00"} onChange={(e) => setConfig("workTiming", "startTime", e.target.value)} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">End Time</Label>
                        <Input type="time" value={(cfg.endTime as string) || "18:00"} onChange={(e) => setConfig("workTiming", "endTime", e.target.value)} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Grace Period (min)</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.graceMinutes, 15)} onChange={(e) => setConfig("workTiming", "graceMinutes", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Min Working Hours</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.minWorkingHours, 8)} onChange={(e) => setConfig("workTiming", "minWorkingHours", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Break Duration (min)</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.breakMinutes, 60)} onChange={(e) => setConfig("workTiming", "breakMinutes", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Leave */}
              {form.category === "leave" && (() => {
                const cfg = getConfig("leaveConfig");
                const leaveTypes = getLeaveTypes();
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Leave Types</p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {leaveTypes.map((lt, idx) => (
                        <div key={idx} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[12px] font-semibold text-[#334155]">{(lt.label as string) || `Leave Type #${idx + 1}`}</p>
                            <button type="button" onClick={() => removeLeaveType(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Type Key</Label>
                              <Input value={(lt.type as string) || ""} onChange={(e) => updateLeaveType(idx, "type", e.target.value)} placeholder="e.g. casual" className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Label</Label>
                              <Input value={(lt.label as string) || ""} onChange={(e) => updateLeaveType(idx, "label", e.target.value)} placeholder="e.g. Casual Leave" className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Annual Allocation</Label>
                              <Input type="text" inputMode="numeric" value={nv(lt.annualAllocation)} onChange={(e) => updateLeaveType(idx, "annualAllocation", numVal(e.target.value))} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Max Carry Forward</Label>
                              <Input type="text" inputMode="numeric" value={nv(lt.maxCarryForward)} onChange={(e) => updateLeaveType(idx, "maxCarryForward", numVal(e.target.value))} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Max Consec. Days</Label>
                              <Input type="text" inputMode="numeric" value={nv(lt.maxConsecutiveDays)} onChange={(e) => updateLeaveType(idx, "maxConsecutiveDays", numVal(e.target.value))} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Applicable To</Label>
                              <select value={(lt.applicableTo as string) || "all"} onChange={(e) => updateLeaveType(idx, "applicableTo", e.target.value)} className="w-full h-8 text-[12px] bg-white border border-[#E2E8F0] rounded-md px-2 mt-0.5 outline-none">
                                <option value="all">All</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                              </select>
                            </div>
                          </div>
                          <div className="flex gap-4 pt-1">
                            <Checkbox checked={!!lt.encashable} onChange={() => updateLeaveType(idx, "encashable", !lt.encashable)} label="Encashable" />
                            <Checkbox checked={!!lt.requiresDocument} onChange={() => updateLeaveType(idx, "requiresDocument", !lt.requiresDocument)} label="Requires Document" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addLeaveType} className="mt-2 text-[12px] font-medium text-[#2E86C1] hover:text-[#2471A3] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Add Leave Type
                    </button>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Year Start</Label>
                        <select value={(cfg.yearStart as string) || "january"} onChange={(e) => setConfig("leaveConfig", "yearStart", e.target.value)} className="w-full h-9 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 mt-1 outline-none focus:ring-2 focus:ring-[#2E86C1]/20">
                          <option value="january">January (Calendar Year)</option>
                          <option value="april">April (Financial Year)</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <Checkbox checked={!!cfg.halfDayAllowed} onChange={() => setConfig("leaveConfig", "halfDayAllowed", !cfg.halfDayAllowed)} label="Half-Day Allowed" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* WFH */}
              {form.category === "wfh" && (() => {
                const cfg = getConfig("wfhConfig");
                const allowedDays = (cfg.allowedDays as string[]) || [];
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">WFH Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Days / Month</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxDaysPerMonth)} onChange={(e) => setConfig("wfhConfig", "maxDaysPerMonth", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="flex items-end pb-1">
                        <Checkbox checked={!!cfg.requiresApproval} onChange={() => setConfig("wfhConfig", "requiresApproval", !cfg.requiresApproval)} label="Requires Approval" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-[12px] font-medium text-[#334155] mb-2 block">Allowed Days</Label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS_OF_WEEK.map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              const next = allowedDays.includes(day) ? allowedDays.filter((d) => d !== day) : [...allowedDays, day];
                              setConfig("wfhConfig", "allowedDays", next);
                            }}
                            className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                              allowedDays.includes(day) ? "bg-[#2E86C1] text-white border-[#2E86C1]" : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#2E86C1]"
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Overtime */}
              {form.category === "overtime" && (() => {
                const cfg = getConfig("overtimeConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Overtime Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Hours / Day</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxOvertimeHoursPerDay)} onChange={(e) => setConfig("overtimeConfig", "maxOvertimeHoursPerDay", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Hours / Week</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxOvertimeHoursPerWeek)} onChange={(e) => setConfig("overtimeConfig", "maxOvertimeHoursPerWeek", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Multiplier</Label>
                        <Input type="text" inputMode="numeric" step="0.1" value={nv(cfg.multiplier)} onChange={(e) => setConfig("overtimeConfig", "multiplier", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="flex items-end pb-1">
                        <Checkbox checked={!!cfg.requiresApproval} onChange={() => setConfig("overtimeConfig", "requiresApproval", !cfg.requiresApproval)} label="Requires Approval" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Shift */}
              {form.category === "shift" && (() => {
                const shifts = getShifts();
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Shift Configuration</p>
                    <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                      {shifts.map((sh, idx) => (
                        <div key={idx} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[12px] font-semibold text-[#334155]">{(sh.name as string) || `Shift #${idx + 1}`}</p>
                            <button type="button" onClick={() => removeShift(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Name</Label>
                              <Input value={(sh.name as string) || ""} onChange={(e) => updateShift(idx, "name", e.target.value)} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">Start Time</Label>
                              <Input type="time" value={(sh.startTime as string) || "09:00"} onChange={(e) => updateShift(idx, "startTime", e.target.value)} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                            <div>
                              <Label className="text-[11px] text-[#64748B]">End Time</Label>
                              <Input type="time" value={(sh.endTime as string) || "17:00"} onChange={(e) => updateShift(idx, "endTime", e.target.value)} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addShift} className="mt-2 text-[12px] font-medium text-[#2E86C1] hover:text-[#2471A3] flex items-center gap-1">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Add Shift
                    </button>
                  </div>
                );
              })()}

              {/* Expenses */}
              {form.category === "expenses" && (() => {
                const cfg = getConfig("expenseConfig");
                const cats = getExpenseCategories();
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Expense Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Amount</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxAmountPerTransaction)} onChange={(e) => setConfig("expenseConfig", "maxAmountPerTransaction", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Approval Threshold</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.approvalThreshold)} onChange={(e) => setConfig("expenseConfig", "approvalThreshold", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="col-span-2 flex items-center">
                        <Checkbox checked={!!cfg.requiresReceipt} onChange={() => setConfig("expenseConfig", "requiresReceipt", !cfg.requiresReceipt)} label="Receipt Required" />
                      </div>
                    </div>
                    <div className="mt-3">
                      <Label className="text-[12px] font-medium text-[#334155] mb-1 block">Categories</Label>
                      <div className="space-y-1.5">
                        {cats.map((cat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input value={cat} onChange={(e) => updateExpenseCategory(idx, e.target.value)} className="h-8 text-[12px] bg-[#F8FAFC] border-[#E2E8F0] rounded-md flex-1" />
                            <button type="button" onClick={() => removeExpenseCategory(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={addExpenseCategory} className="mt-1.5 text-[12px] font-medium text-[#2E86C1] hover:text-[#2471A3] flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                        Add Category
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* Travel */}
              {form.category === "travel" && (() => {
                const cfg = getConfig("travelConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Travel Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Per Diem</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.perDiemAmount)} onChange={(e) => setConfig("travelConfig", "perDiemAmount", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Hotel Rate</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxHotelRate)} onChange={(e) => setConfig("travelConfig", "maxHotelRate", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="flex items-center">
                        <Checkbox checked={!!cfg.requiresPreApproval} onChange={() => setConfig("travelConfig", "requiresPreApproval", !cfg.requiresPreApproval)} label="Pre-Approval Required" />
                      </div>
                      <div className="flex items-center">
                        <Checkbox checked={!!cfg.advanceAllowed} onChange={() => setConfig("travelConfig", "advanceAllowed", !cfg.advanceAllowed)} label="Advance Allowed" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Reimbursement */}
              {form.category === "reimbursement" && (() => {
                const cfg = getConfig("reimbursementConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Reimbursement Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Claim Amount</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxClaimAmount)} onChange={(e) => setConfig("reimbursementConfig", "maxClaimAmount", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Deadline (days)</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.submissionDeadlineDays)} onChange={(e) => setConfig("reimbursementConfig", "submissionDeadlineDays", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="col-span-2 flex items-center">
                        <Checkbox checked={!!cfg.receiptsRequired} onChange={() => setConfig("reimbursementConfig", "receiptsRequired", !cfg.receiptsRequired)} label="Receipts Required" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Invoices */}
              {form.category === "invoices" && (() => {
                const cfg = getConfig("invoiceConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Invoice Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Payment Term (days)</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.paymentTermDays)} onChange={(e) => setConfig("invoiceConfig", "paymentTermDays", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Late Fee (%)</Label>
                        <Input type="text" inputMode="numeric" step="0.1" value={nv(cfg.lateFeePercentage)} onChange={(e) => setConfig("invoiceConfig", "lateFeePercentage", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Currency</Label>
                        <Input value={(cfg.currency as string) || "INR"} onChange={(e) => setConfig("invoiceConfig", "currency", e.target.value)} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Exemptions */}
              {form.category === "exemptions" && (() => {
                const cfg = getConfig("exemptionConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Exemption Configuration</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Type</Label>
                        <Input value={(cfg.type as string) || ""} onChange={(e) => setConfig("exemptionConfig", "type", e.target.value)} placeholder="e.g. tax, policy" className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                      <div className="flex items-end pb-1">
                        <Checkbox checked={!!cfg.autoApprove} onChange={() => setConfig("exemptionConfig", "autoApprove", !cfg.autoApprove)} label="Auto Approve" />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-[12px] font-medium text-[#334155]">Criteria</Label>
                        <textarea
                          value={(cfg.criteria as string) || ""}
                          onChange={(e) => setConfig("exemptionConfig", "criteria", e.target.value)}
                          placeholder="Criteria for this exemption"
                          rows={2}
                          className="w-full text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 mt-1 outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Attendance */}
              {form.category === "attendance" && (() => {
                const cfg = getConfig("attendanceConfig");
                return (
                  <div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Attendance Configuration</p>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <Label className="text-[12px] font-medium text-[#334155]">Max Hours / Week</Label>
                        <Input type="text" inputMode="numeric" value={nv(cfg.maxWorkingHoursPerWeek)} onChange={(e) => setConfig("attendanceConfig", "maxWorkingHoursPerWeek", numVal(e.target.value))} className="h-9 text-[13px] bg-[#F8FAFC] border-[#E2E8F0] rounded-lg mt-1" />
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Alert Toggles</p>
                    <div className="grid grid-cols-2 gap-2">
                      {([["lateArrival", "Late Arrival"], ["earlyDeparture", "Early Departure"], ["missedClockIn", "Missed Clock-in"], ["overtimeAlert", "Overtime"]] as const).map(([key, label]) => (
                        <Checkbox key={key} checked={!!cfg[key]} onChange={() => setConfig("attendanceConfig", key, !cfg[key])} label={label} />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── Custom Rules Section ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Custom Rules</p>
                {(form.rules || []).length === 0 ? (
                  <p className="text-[12px] text-[#94A3B8] mb-2">No custom rules added.</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {(form.rules || []).map((rule, idx) => (
                      <div key={idx} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[12px] font-semibold text-[#334155]">Rule #{idx + 1}</p>
                          <button type="button" onClick={() => removeRule(idx)} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[11px] text-[#64748B]">Key</Label>
                            <Input value={rule.key || ""} onChange={(e) => updateRule(idx, "key", e.target.value)} placeholder="e.g. minHours" className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                          </div>
                          <div>
                            <Label className="text-[11px] text-[#64748B]">Operator</Label>
                            <select value={rule.operator || "equals"} onChange={(e) => updateRule(idx, "operator", e.target.value)} className="w-full h-8 text-[12px] bg-white border border-[#E2E8F0] rounded-md px-2 mt-0.5 outline-none">
                              {RULE_OPERATORS.map((op) => <option key={op} value={op}>{op}</option>)}
                            </select>
                          </div>
                          <div>
                            <Label className="text-[11px] text-[#64748B]">Value</Label>
                            <Input value={String(rule.value ?? "")} onChange={(e) => updateRule(idx, "value", e.target.value)} className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                          </div>
                          <div className="col-span-3">
                            <Label className="text-[11px] text-[#64748B]">Description</Label>
                            <Input value={rule.description || ""} onChange={(e) => updateRule(idx, "description", e.target.value)} placeholder="Optional description" className="h-8 text-[12px] bg-white border-[#E2E8F0] rounded-md mt-0.5" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <button type="button" onClick={addRule} className="mt-2 text-[12px] font-medium text-[#2E86C1] hover:text-[#2471A3] flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Rule
                </button>
              </div>

              {/* ── Applicability ── */}
              <div>
                <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Applicability</p>
                <select
                  value={form.applicableTo || "all"}
                  onChange={(e) => setField("applicableTo", e.target.value)}
                  className="w-full h-9 text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 outline-none focus:ring-2 focus:ring-[#2E86C1]/20"
                >
                  <option value="all">All Employees</option>
                  <option value="department">Department</option>
                  <option value="designation">Designation</option>
                  <option value="specific">Specific Employees</option>
                </select>
              </div>

              {/* ── Change Log (for edits) ── */}
              {editingPolicy && (
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Change Log</p>
                  <textarea
                    value={form.changeLog || ""}
                    onChange={(e) => setField("changeLog", e.target.value)}
                    placeholder="Describe what changed in this version"
                    rows={2}
                    className="w-full text-[13px] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[#2E86C1]/20 resize-none"
                  />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-[#E2E8F0] sticky bottom-0 bg-white rounded-b-2xl">
              <Button onClick={() => setShowModal(false)} className="h-9 px-4 rounded-lg text-[13px] bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC]">
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="h-9 px-5 rounded-lg text-[13px] bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium">
                {saving ? "Saving..." : editingPolicy ? "Save Changes" : "Create Policy"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════ */}
      {/* ── VERSION HISTORY DRAWER ── */}
      {/* ════════════════════════════════════════════════════════════ */}

      {showHistoryDrawer && (
        <div className="fixed inset-0 bg-black/40 flex justify-end z-[100]">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-sm font-bold text-[#0F172A]">Version History</h2>
                {historyPolicy && (
                  <p className="text-[12px] text-[#64748B] mt-0.5">{historyPolicy.policyName}</p>
                )}
              </div>
              <button onClick={() => setShowHistoryDrawer(false)} className="p-1.5 rounded-lg text-[#94A3B8] hover:bg-[#F1F5F9] hover:text-[#334155] transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Drawer Content */}
            <div className="px-6 py-4">
              {historyLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="h-6 w-6" />
                </div>
              ) : versionHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-12 h-12 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-[#334155]">No version history</p>
                  <p className="text-[12px] text-[#94A3B8] mt-1">This is the first version of this policy.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#E2E8F0]" />

                  <div className="space-y-4">
                    {versionHistory.map((v, idx) => (
                      <div key={v._id || idx} className="relative pl-8">
                        {/* Timeline dot */}
                        <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center ${
                          idx === 0 ? "bg-[#2E86C1] border-[#2E86C1]" : "bg-white border-[#CBD5E1]"
                        }`}>
                          <span className={`text-[8px] font-bold ${idx === 0 ? "text-white" : "text-[#64748B]"}`}>
                            v{v.version ?? versionHistory.length - idx}
                          </span>
                        </div>

                        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-semibold text-[#0F172A]">
                              Version {v.version ?? versionHistory.length - idx}
                            </span>
                            <span className="text-[10px] text-[#94A3B8]">
                              {v.createdAt ? new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Unknown date"}
                            </span>
                          </div>
                          {v.changeLog && (
                            <p className="text-[12px] text-[#64748B] mt-1">{v.changeLog}</p>
                          )}
                          {!v.changeLog && (v as Record<string, unknown>).version === 1 && (
                            <p className="text-[12px] text-[#64748B] mt-1">Initial version created</p>
                          )}
                          {(v.updatedBy || v.createdBy) && (
                            <p className="text-[10px] text-[#94A3B8] mt-1.5">
                              By: {userNames[v.updatedBy || ""] || userNames[v.createdBy || ""] || v.updatedBy || v.createdBy}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({...s, open: false}))}
      />
    </div>
    </RouteGuard>
  );
}
