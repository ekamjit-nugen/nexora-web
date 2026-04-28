"use client";

import { useEffect, useState, useCallback, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Component {
  code: string;
  name: string;
  type: "earning" | "deduction" | "employer_contribution" | "reimbursement";
  calculationMethod: "fixed" | "percentage_basic" | "percentage_ctc" | "percentage_gross";
  annualAmount: number;
  isTaxable: boolean;
  isPFApplicable: boolean;
  isESIApplicable: boolean;
}

interface EarningView {
  name: string;
  monthly: number;
  annual: number;
  type?: string;
}

interface DeductionView {
  name: string;
  monthly: number;
  annual: number;
}

// Shape returned by GET /salary-structures (list) — uses raw `components`.
interface SalaryStructureRow {
  _id: string;
  employeeId: string;
  structureName: string;
  ctc: number;
  status: string;
  effectiveFrom: string;
  components?: Component[];
  createdAt?: string;
  createdBy?: string;
}

// Shape returned by GET /salary-structures/:employeeId (employee self-view)
interface EmployeeViewStructure {
  _id: string;
  employeeId: string;
  ctc: number;
  status: string;
  earnings: EarningView[];
  deductions: DeductionView[];
  netPay: number;
  effectiveFrom?: string;
  createdAt?: string;
}

interface CTCSimulation {
  ctc: number;
  earnings: EarningView[];
  deductions: DeductionView[];
  netPay: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  pending_approval: { label: "Pending Approval", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  superseded: { label: "Superseded", color: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

function formatCurrency(paise: number, inPaise = true): string {
  // Admin list endpoint returns CTC / annualAmount in rupees (integers).
  // The employee self-view endpoint returns values in paise. Flag controls.
  const rupees = inPaise ? paise / 100 : paise;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees);
}

const DEFAULT_COMPONENTS: Component[] = [
  { code: "BASIC",   name: "Basic Salary",      type: "earning",   calculationMethod: "fixed", annualAmount: 0, isTaxable: true,  isPFApplicable: true,  isESIApplicable: false },
  { code: "HRA",     name: "HRA",               type: "earning",   calculationMethod: "fixed", annualAmount: 0, isTaxable: true,  isPFApplicable: false, isESIApplicable: false },
  { code: "SPECIAL", name: "Special Allowance", type: "earning",   calculationMethod: "fixed", annualAmount: 0, isTaxable: true,  isPFApplicable: false, isESIApplicable: false },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SalaryStructurePage() {
  const { user, loading: authLoading, logout, hasOrgRole, orgRole } = useAuth();
  const router = useRouter();

  // Admin view if user has admin / hr / owner / super_admin; else employee view.
  const isAdminView = useMemo(() => {
    if (!user) return false;
    if (orgRole === "owner" || orgRole === "admin") return true;
    if (hasOrgRole && hasOrgRole("hr")) return true;
    if (user.roles && (user.roles.includes("admin") || user.roles.includes("super_admin") || user.roles.includes("hr"))) return true;
    return false;
  }, [user, orgRole, hasOrgRole]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {isAdminView ? <AdminSalaryView /> : <EmployeeSalaryView />}
      </main>
    </div>
  );
}

// ===========================================================================
// Admin view
// ===========================================================================

function AdminSalaryView() {
  const [rows, setRows] = useState<SalaryStructureRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "pending_approval" | "draft">("all");
  const [employees, setEmployees] = useState<Employee[]>([]);

  // New / edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryStructureRow | null>(null);

  // Reject modal
  const [rejecting, setRejecting] = useState<SalaryStructureRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (activeTab !== "all") params.status = activeTab;
      const res: any = await payrollApi.listSalaryStructures(params);
      setRows(res?.data || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load salary structures");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchEmployees = useCallback(async () => {
    try {
      const res: any = await hrApi.getEmployees({ status: "active", limit: "100" });
      const list = Array.isArray(res?.data) ? res.data : (res?.data?.items || []);
      setEmployees(list);
    } catch {
      setEmployees([]);
    }
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const employeeLookup = useMemo(() => {
    const map: Record<string, Employee> = {};
    for (const e of employees) map[e._id] = e;
    return map;
  }, [employees]);

  const tabs = [
    { key: "all" as const, label: "All" },
    { key: "active" as const, label: "Active" },
    { key: "pending_approval" as const, label: "Pending Approval" },
    { key: "draft" as const, label: "Draft" },
  ];

  const stats = useMemo(() => {
    const s = { total: rows.length, active: 0, pending: 0, draft: 0 };
    for (const r of rows) {
      if (r.status === "active") s.active++;
      else if (r.status === "pending_approval") s.pending++;
      else if (r.status === "draft") s.draft++;
    }
    return s;
  }, [rows]);

  const handleSubmit = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.submitForApproval(id);
      toast.success("Submitted for approval", { id: "salary-" + id });
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await payrollApi.approveSalaryStructure(id);
      toast.success("Approved — structure is now active", { id: "salary-" + id });
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setActionLoading(rejecting._id);
    try {
      await payrollApi.rejectSalaryStructure(rejecting._id, rejectReason || undefined);
      toast.success("Rejected");
      setRejecting(null);
      setRejectReason("");
      fetchRows();
    } catch (err: any) {
      toast.error(err?.message || "Failed to reject");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">Salary Structures</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">Manage compensation for all employees in your organisation</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px] gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Salary Structure
        </Button>
      </div>

      {/* Stat cards */}
      <div className="px-8 pt-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={stats.total} tone="slate" />
          <StatCard label="Active" value={stats.active} tone="emerald" />
          <StatCard label="Pending Approval" value={stats.pending} tone="amber" />
          <StatCard label="Draft" value={stats.draft} tone="gray" />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-8 pt-5">
        <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-1 w-fit overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors ${
                activeTab === t.key
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 pt-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl border border-[#E2E8F0]">
            <div className="w-14 h-14 bg-[#F1F5F9] rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[15px] font-semibold text-[#0F172A]">No salary structures {activeTab !== "all" ? `in "${tabs.find(t => t.key === activeTab)?.label}"` : "yet"}</p>
            <p className="text-[13px] text-[#64748B] mt-1 mb-5">Create your first salary structure to start running payroll.</p>
            <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-[#2E86C1] hover:bg-[#2471A3]">
              + New Salary Structure
            </Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F8FAFC]">
                  <tr>
                    <Th>Employee</Th>
                    <Th>Structure</Th>
                    <Th className="text-right">CTC (Annual)</Th>
                    <Th>Status</Th>
                    <Th>Effective From</Th>
                    <Th className="text-right">Actions</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F5F9]">
                  {rows.map((r) => {
                    const cfg = statusConfig[r.status] || statusConfig.draft;
                    const emp = employeeLookup[r.employeeId];
                    const empName = emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.email : r.employeeId;
                    const isLoading = actionLoading === r._id;
                    return (
                      <tr key={r._id} className="hover:bg-[#FAFBFC]">
                        <td className="px-5 py-3 text-[13px]">
                          <div className="font-medium text-[#0F172A]">{empName}</div>
                          {emp?.email && <div className="text-[11px] text-[#94A3B8] truncate">{emp.email}</div>}
                        </td>
                        <td className="px-5 py-3 text-[13px] text-[#334155]">{r.structureName || "—"}</td>
                        <td className="px-5 py-3 text-[13px] text-right font-medium text-[#0F172A]">
                          {formatCurrency(r.ctc, false)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[12px] text-[#64748B]">
                          {r.effectiveFrom ? new Date(r.effectiveFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "draft" && (
                              <>
                                <button
                                  onClick={() => { setEditing(r); setModalOpen(true); }}
                                  className="h-7 px-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] rounded-md"
                                >
                                  Edit
                                </button>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleSubmit(r._id)}
                                  className="h-7 px-2 text-[12px] text-[#2E86C1] hover:bg-[#EBF5FB] rounded-md disabled:opacity-50"
                                >
                                  Submit
                                </button>
                              </>
                            )}
                            {r.status === "pending_approval" && (
                              <>
                                <button
                                  disabled={isLoading}
                                  onClick={() => handleApprove(r._id)}
                                  className="h-7 px-2 text-[12px] text-emerald-700 hover:bg-emerald-50 rounded-md disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => { setRejecting(r); setRejectReason(""); }}
                                  className="h-7 px-2 text-[12px] text-red-600 hover:bg-red-50 rounded-md"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {r.status === "active" && (
                              <button
                                onClick={() => { setEditing(r); setModalOpen(true); }}
                                className="h-7 px-2 text-[12px] text-[#334155] hover:bg-[#F1F5F9] rounded-md"
                              >
                                Revise
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <StructureFormModal
          initial={editing}
          employees={employees}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); fetchRows(); }}
        />
      )}

      {/* Reject modal */}
      {rejecting && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRejecting(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[#E2E8F0]">
              <h2 className="text-[15px] font-semibold text-[#0F172A]">Reject salary structure</h2>
              <p className="text-[12px] text-[#64748B] mt-0.5">
                This returns the structure to draft. The creator can revise and resubmit.
              </p>
            </div>
            <div className="p-5">
              <Label className="text-[12px] mb-1.5 block">Reason (optional)</Label>
              <textarea
                className="w-full min-h-[80px] text-[13px] rounded-md border border-[#E2E8F0] p-3 focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                placeholder="e.g. CTC exceeds department band"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center justify-end gap-2">
              <button onClick={() => setRejecting(null)} className="h-9 px-4 text-[13px] rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejecting._id}
                className="h-9 px-4 text-[13px] rounded-md bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create / Edit modal
// ---------------------------------------------------------------------------

function StructureFormModal({
  initial,
  employees,
  onClose,
  onSaved,
}: {
  initial: SalaryStructureRow | null;
  employees: Employee[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState<string>(initial?.employeeId || "");
  const [structureName, setStructureName] = useState<string>(initial?.structureName || "");
  const [effectiveFrom, setEffectiveFrom] = useState<string>(
    initial?.effectiveFrom ? initial.effectiveFrom.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [components, setComponents] = useState<Component[]>(
    initial?.components && initial.components.length > 0
      ? initial.components
      : DEFAULT_COMPONENTS
  );
  const [saving, setSaving] = useState(false);

  const ctc = useMemo(() => components.filter(c => c.type === "earning").reduce((s, c) => s + (Number(c.annualAmount) || 0), 0), [components]);

  const updateComponent = (idx: number, patch: Partial<Component>) => {
    setComponents(cs => cs.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const removeComponent = (idx: number) => {
    setComponents(cs => cs.filter((_, i) => i !== idx));
  };

  const addComponent = (type: "earning" | "deduction") => {
    setComponents(cs => [...cs, {
      code: type === "earning" ? "CUSTOM_EARN_" + (cs.length + 1) : "CUSTOM_DED_" + (cs.length + 1),
      name: type === "earning" ? "New earning" : "New deduction",
      type,
      calculationMethod: "fixed",
      annualAmount: 0,
      isTaxable: type === "earning",
      isPFApplicable: false,
      isESIApplicable: false,
    }]);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!employeeId) { toast.error("Please select an employee"); return; }
    if (!structureName.trim()) { toast.error("Structure name is required"); return; }
    if (components.filter(c => c.type === "earning").length === 0) { toast.error("At least one earning component is required"); return; }
    setSaving(true);
    try {
      const payload = {
        employeeId,
        structureName: structureName.trim(),
        effectiveFrom,
        ctc,
        components: components.map(c => ({ ...c, annualAmount: Number(c.annualAmount) || 0 })),
      };
      if (initial) {
        await payrollApi.updateSalaryStructure(initial._id, payload);
        toast.success("Salary structure updated");
      } else {
        await payrollApi.createSalaryStructure(payload);
        toast.success("Salary structure created — submit for approval to activate");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form
        onSubmit={handleSave}
        className="bg-white rounded-xl shadow-xl w-full max-w-3xl my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">
              {initial ? "Revise salary structure" : "New salary structure"}
            </h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              CTC is computed from earnings: <span className="font-semibold text-[#0F172A]">{formatCurrency(ctc, false)}</span>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#94A3B8] hover:text-[#64748B]">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top: employee + name + date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] mb-1.5 block">Employee <span className="text-red-500">*</span></Label>
              <select
                required
                disabled={!!initial}
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full h-9 text-[13px] rounded-md border border-[#E2E8F0] px-3 disabled:bg-[#F1F5F9]"
              >
                <option value="">Select employee…</option>
                {employees.map(e => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName} · {e.email}
                  </option>
                ))}
              </select>
              {initial && <p className="text-[11px] text-[#94A3B8] mt-1">Employee cannot be changed on an existing structure.</p>}
            </div>
            <div>
              <Label className="text-[12px] mb-1.5 block">Effective from <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="h-9 text-[13px]"
              />
            </div>
          </div>
          <div>
            <Label className="text-[12px] mb-1.5 block">Structure name <span className="text-red-500">*</span></Label>
            <Input
              required
              placeholder='e.g. "Sam Smith — Developer L1"'
              value={structureName}
              onChange={(e) => setStructureName(e.target.value)}
              className="h-9 text-[13px]"
            />
          </div>

          {/* Components */}
          {(["earning", "deduction"] as const).map((section) => {
            const sectionLabel = section === "earning" ? "Earnings" : "Deductions";
            const sectionRows = components.map((c, i) => ({ c, i })).filter(({ c }) => c.type === section);
            return (
              <div key={section}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">{sectionLabel}</h3>
                  <button
                    type="button"
                    onClick={() => addComponent(section)}
                    className="h-7 px-2.5 text-[12px] rounded-md text-[#2E86C1] hover:bg-[#EBF5FB]"
                  >
                    + Add {section === "earning" ? "earning" : "deduction"}
                  </button>
                </div>
                <div className="border border-[#E2E8F0] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
                  <table className="w-full text-[13px]">
                    <thead className="bg-[#F8FAFC]">
                      <tr>
                        <Th className="w-[32%]">Name</Th>
                        <Th className="w-[18%]">Code</Th>
                        <Th className="text-right w-[28%]">Annual Amount</Th>
                        <Th className="w-[18%]">Taxable?</Th>
                        <Th className="w-[4%]"></Th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {sectionRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-[12px] text-[#94A3B8]">
                            No {sectionLabel.toLowerCase()} yet.
                          </td>
                        </tr>
                      )}
                      {sectionRows.map(({ c, i }) => (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <input
                              value={c.name}
                              onChange={(e) => updateComponent(i, { name: e.target.value })}
                              className="w-full h-8 px-2 text-[13px] rounded border border-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={c.code}
                              onChange={(e) => updateComponent(i, { code: e.target.value.toUpperCase().replace(/\s/g, "_") })}
                              className="w-full h-8 px-2 text-[13px] rounded border border-[#E2E8F0] font-mono focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              value={c.annualAmount}
                              onChange={(e) => updateComponent(i, { annualAmount: Number(e.target.value) })}
                              className="w-full h-8 px-2 text-[13px] text-right rounded border border-[#E2E8F0] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                              min={0}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-2 text-[12px] text-[#64748B] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={c.isTaxable}
                                onChange={(e) => updateComponent(i, { isTaxable: e.target.checked })}
                              />
                              Taxable
                            </label>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeComponent(i)}
                              className="text-[#94A3B8] hover:text-red-500"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between bg-[#F8FAFC] rounded-b-xl">
          <div className="text-[12px] text-[#64748B]">
            Total CTC: <span className="font-semibold text-[#0F172A]">{formatCurrency(ctc, false)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-[13px] rounded-md border border-[#E2E8F0] text-[#64748B] hover:bg-white"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px]"
            >
              {saving ? "Saving…" : (initial ? "Update" : "Create structure")}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Employee view (unchanged behaviour — self-service view + simulate CTC)
// ---------------------------------------------------------------------------

function EmployeeSalaryView() {
  const { user } = useAuth();
  const [structure, setStructure] = useState<EmployeeViewStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"monthly" | "annual">("monthly");
  const [activeTab, setActiveTab] = useState<"active" | "pending_approval" | "draft">("active");

  const [showSimulate, setShowSimulate] = useState(false);
  const [ctcInput, setCtcInput] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState<CTCSimulation | null>(null);

  const fetchStructure = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Use `/salary-structures/me` — self-resolves the caller's HR
      // employee on the backend, so this works for any authenticated user
      // (the old `/:employeeId` endpoint is gated to admin/hr only).
      const res: any = await payrollApi.getMySalaryStructure(activeTab);
      const raw = res?.data;
      if (!raw) { setStructure(null); return; }

      // The backend returns the raw SalaryStructure document with a unified
      // `components[]` array and CTC in rupees. The employee-view tables
      // want split earnings/deductions plus a derived netPay. Do the
      // transformation client-side so the server stays source-of-truth.
      const components: any[] = Array.isArray(raw.components) ? raw.components : [];
      const earnings: EarningView[] = components
        .filter(c => c.type === "earning")
        .map(c => ({
          name: c.name,
          annual: Number(c.annualAmount) || 0,
          monthly: Math.round((Number(c.annualAmount) || 0) / 12),
          type: c.type,
        }));
      const deductions: DeductionView[] = components
        .filter(c => c.type === "deduction")
        .map(c => ({
          name: c.name,
          annual: Number(c.annualAmount) || 0,
          monthly: Math.round((Number(c.annualAmount) || 0) / 12),
        }));
      const totalEarningsAnnual = earnings.reduce((s, e) => s + e.annual, 0);
      const totalDeductionsAnnual = deductions.reduce((s, d) => s + d.annual, 0);
      const netPay = totalEarningsAnnual - totalDeductionsAnnual;

      setStructure({
        _id: raw._id,
        employeeId: raw.employeeId,
        ctc: Number(raw.ctc) || 0,
        status: raw.status,
        earnings,
        deductions,
        netPay,
        effectiveFrom: raw.effectiveFrom,
        createdAt: raw.createdAt,
      });
    } catch (err: any) {
      if (err?.status !== 404) toast.error(err?.message || "Failed to load salary structure");
      setStructure(null);
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  useEffect(() => { if (user) fetchStructure(); }, [fetchStructure, user]);

  const handleSimulateCTC = useCallback(async () => {
    const ctcRupees = parseFloat(ctcInput);
    if (!ctcRupees || ctcRupees <= 0) { toast.error("Enter a valid CTC amount"); return; }
    setSimulating(true);
    try {
      // Backend's /salary-structures/simulate accepts CTC in rupees (the
      // SimulateCTCDto just has `ctc: number`), not paise. It also returns
      // a unified `components[]` array, not split earnings/deductions. Map
      // the response into the `CTCSimulation` shape the UI expects.
      const res: any = await payrollApi.simulateCTC(ctcRupees);
      const raw = res?.data;
      if (!raw) { setSimulation(null); return; }
      const comps: any[] = Array.isArray(raw.components) ? raw.components : [];
      const earnings = comps
        .filter(c => c.type === "earning")
        .map(c => ({
          name: c.name,
          annual: Number(c.annualAmount) || 0,
          monthly: Number(c.monthlyAmount) || Math.round((Number(c.annualAmount) || 0) / 12),
          type: c.type,
        }));
      const deductions = comps
        .filter(c => c.type === "deduction")
        .map(c => ({
          name: c.name,
          annual: Number(c.annualAmount) || 0,
          monthly: Number(c.monthlyAmount) || Math.round((Number(c.annualAmount) || 0) / 12),
        }));
      const earningsSum = earnings.reduce((s, e) => s + e.annual, 0);
      const deductionsSum = deductions.reduce((s, d) => s + d.annual, 0);
      setSimulation({
        ctc: Number(raw.totalAnnualCTC ?? raw.ctc ?? ctcRupees),
        earnings,
        deductions,
        netPay: earningsSum - deductionsSum,
      });
    } catch (err: any) {
      toast.error(err?.message || "Failed to simulate CTC");
    } finally {
      setSimulating(false);
    }
  }, [ctcInput]);

  // Annual values are stored in rupees on the structure (and we've already
  // mapped `monthly = annual/12` above). `formatCurrency(_, false)` skips
  // the paise→rupees divide so we don't accidentally truncate by 100×.
  const getAmount = (annualRupees: number): string =>
    viewMode === "monthly"
      ? formatCurrency(Math.round(annualRupees / 12), false)
      : formatCurrency(annualRupees, false);

  const tabs = [
    { key: "active" as const, label: "Active" },
    { key: "pending_approval" as const, label: "Pending Approval" },
    { key: "draft" as const, label: "Draft" },
  ];

  return (
    <>
      <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-[20px] font-bold text-[#0F172A]">Salary Structure</h1>
          <p className="text-[13px] text-[#64748B] mt-0.5">View your salary breakdown and simulate CTC</p>
        </div>
        <Button
          onClick={() => { setShowSimulate(true); setSimulation(null); setCtcInput(""); }}
          className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px]"
        >
          Simulate CTC
        </Button>
      </div>

      <div className="px-8 pt-5">
        <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-1 w-fit">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                activeTab === t.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 pt-5">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
          </div>
        ) : !structure ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-[#F1F5F9] rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-[15px] font-medium text-[#0F172A]">No salary structure found</p>
            <p className="text-[13px] text-[#64748B] mt-1">Your salary structure will appear here once it is configured</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <h2 className="text-[16px] font-semibold text-[#0F172A]">Cost to Company (CTC)</h2>
                  {structure.status && statusConfig[structure.status] && (
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusConfig[structure.status].color}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusConfig[structure.status].dot}`} />
                      {statusConfig[structure.status].label}
                    </span>
                  )}
                </div>
                <div className="flex gap-1 bg-[#F1F5F9] rounded-lg p-0.5">
                  {(["monthly", "annual"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      className={`px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${viewMode === m ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B]"}`}
                    >
                      {m === "monthly" ? "Monthly" : "Annual"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[28px] font-bold text-[#2E86C1]">{getAmount(structure.ctc)}</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">
                {viewMode === "monthly" ? "per month" : "per annum"}
                {structure.effectiveFrom && ` | Effective from ${new Date(structure.effectiveFrom).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`}
              </p>
            </div>

            {/* Earnings / Deductions tables (unchanged) */}
            {(["Earnings", "Deductions"] as const).map((title) => {
              const list = title === "Earnings" ? (structure.earnings || []) : (structure.deductions || []);
              return (
                <div key={title} className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
                  <div className="px-6 py-4 border-b border-[#E2E8F0]">
                    <h3 className="text-[15px] font-semibold text-[#0F172A]">{title}</h3>
                  </div>
                  <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FAFC]">
                        <th className="text-left px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Component</th>
                        <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Monthly</th>
                        <th className="text-right px-6 py-3 text-[12px] font-medium text-[#64748B] uppercase tracking-wider">Annual</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F1F5F9]">
                      {list.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[#FAFBFC]">
                          <td className="px-6 py-3 text-[13px] text-[#0F172A]">{item.name}</td>
                          <td className={`px-6 py-3 text-[13px] text-right ${title === "Deductions" ? "text-red-600" : "text-[#0F172A]"}`}>{formatCurrency(item.monthly, false)}</td>
                          <td className={`px-6 py-3 text-[13px] text-right ${title === "Deductions" ? "text-red-600" : "text-[#0F172A]"}`}>{formatCurrency(item.annual, false)}</td>
                        </tr>
                      ))}
                      {list.length === 0 && (
                        <tr><td colSpan={3} className="px-6 py-4 text-center text-[13px] text-[#94A3B8]">No {title.toLowerCase()} components</td></tr>
                      )}
                    </tbody>
                  </table>
                  </div>
                </div>
              );
            })}

            <div className="bg-white rounded-xl border border-[#E2E8F0] p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-[16px] font-semibold text-[#0F172A]">Net Pay</h3>
                <span className="text-[22px] font-bold text-emerald-700">{getAmount(structure.netPay)}</span>
              </div>
              <p className="text-[12px] text-[#94A3B8] mt-1">{viewMode === "monthly" ? "Monthly take-home" : "Annual take-home"}</p>
            </div>
          </div>
        )}
      </div>

      {/* Simulate CTC Modal */}
      {showSimulate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={() => setShowSimulate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#0F172A]">Simulate CTC Breakdown</h2>
              <button onClick={() => setShowSimulate(false)} className="text-[#94A3B8] hover:text-[#64748B]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#0F172A] mb-1.5">Annual CTC (in Rupees)</label>
                <div className="flex gap-2">
                  <Input type="number" placeholder="e.g. 1200000" value={ctcInput} onChange={(e) => setCtcInput(e.target.value)} className="flex-1" />
                  <Button onClick={handleSimulateCTC} disabled={simulating || !ctcInput} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 text-[13px]">
                    {simulating ? "Simulating..." : "Simulate"}
                  </Button>
                </div>
              </div>
              {simulation && (
                <div className="space-y-4 pt-2">
                  <div className="bg-[#F0F9FF] rounded-lg p-4">
                    <p className="text-[12px] text-[#64748B] uppercase tracking-wider font-medium">Simulated CTC</p>
                    <p className="text-[22px] font-bold text-[#2E86C1] mt-1">{formatCurrency(simulation.ctc, false)}</p>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[#0F172A] mb-2">Earnings</h4>
                    <div className="space-y-1.5">
                      {(simulation.earnings || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-[#F8FAFC] rounded-lg">
                          <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                          <span className="text-[13px] font-medium text-[#0F172A]">{formatCurrency(item.monthly, false)}/mo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[#0F172A] mb-2">Deductions</h4>
                    <div className="space-y-1.5">
                      {(simulation.deductions || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-1.5 px-3 bg-[#FEF2F2] rounded-lg">
                          <span className="text-[13px] text-[#0F172A]">{item.name}</span>
                          <span className="text-[13px] font-medium text-red-600">{formatCurrency(item.monthly, false)}/mo</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-[#E2E8F0] pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-semibold text-[#0F172A]">Net Monthly Pay</span>
                      <span className="text-[16px] font-bold text-emerald-700">{formatCurrency(Math.round(simulation.netPay / 12), false)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-5 py-2.5 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "amber" | "gray" }) {
  const bar = {
    slate: "before:bg-slate-400",
    emerald: "before:bg-emerald-500",
    amber: "before:bg-amber-500",
    gray: "before:bg-gray-400",
  }[tone];
  return (
    <div className={`relative bg-white rounded-xl border border-[#E2E8F0] p-4 pl-5 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-r ${bar}`}>
      <p className="text-[12px] text-[#64748B]">{label}</p>
      <p className="text-[22px] font-bold text-[#0F172A] mt-0.5">{value}</p>
    </div>
  );
}
