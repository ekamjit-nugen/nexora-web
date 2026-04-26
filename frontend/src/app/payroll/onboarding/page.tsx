"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { EmployeePicker } from "@/components/EmployeePicker";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// Backend stores `isCompleted` / `isRequired` on the schema. The page
// previously read `completed` / `required` which always came back as
// undefined, so (a) Mark Complete never visibly flipped the checkbox,
// (b) task-done counters stayed at 0/10 forever, and (c) the Required
// badge never rendered. Typed with both shapes for safety; the helpers
// below always prefer the `isX` fields.
interface ChecklistItem {
  _id?: string;
  taskId: string;
  title: string;
  category: string;
  assignedTo?: string;
  dueDate?: string;
  required?: boolean;
  isRequired?: boolean;
  completed?: boolean;
  isCompleted?: boolean;
  completedAt?: string;
}

const isTaskCompleted = (t: ChecklistItem): boolean =>
  Boolean(t.isCompleted ?? t.completed);
const isTaskRequired = (t: ChecklistItem): boolean =>
  Boolean(t.isRequired ?? t.required ?? false);

interface OnboardingDocument {
  type: string;
  status: string;
  url?: string;
  rejectionReason?: string;
}

interface OnboardingRecord {
  _id: string;
  employeeId: string;
  status: string;
  startDate: string;
  targetCompletionDate: string;
  buddyId?: string;
  probationEndDate?: string;
  confirmed?: boolean;
  checklist: ChecklistItem[];
  documents: OnboardingDocument[];
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Status configs
// ---------------------------------------------------------------------------
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600 border-gray-200" },
  in_progress: { label: "In Progress", color: "bg-blue-50 text-blue-700 border-blue-200" },
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
};

const docStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-600" },
  uploaded: { label: "Uploaded", color: "bg-blue-50 text-blue-700" },
  verified: { label: "Verified", color: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "Rejected", color: "bg-red-50 text-red-700" },
};

const categoryConfig: Record<string, { label: string; color: string }> = {
  documents: { label: "Documents", color: "bg-amber-50 text-amber-700" },
  it_setup: { label: "IT Setup", color: "bg-blue-50 text-blue-700" },
  training: { label: "Training", color: "bg-purple-50 text-purple-700" },
  compliance: { label: "Compliance", color: "bg-red-50 text-red-700" },
  welcome: { label: "Welcome", color: "bg-emerald-50 text-emerald-700" },
  other: { label: "Other", color: "bg-gray-50 text-gray-700" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (d?: string) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
};

const getDefaultTarget = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

const getToday = () => new Date().toISOString().split("T")[0];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function OnboardingPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [onboardings, setOnboardings] = useState<OnboardingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showInitiateModal, setShowInitiateModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state for initiate modal
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formStartDate, setFormStartDate] = useState(getToday());
  const [formTargetDate, setFormTargetDate] = useState(getDefaultTarget());
  const [formBuddyId, setFormBuddyId] = useState("");
  const [formProbationEnd, setFormProbationEnd] = useState("");

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
    if (!authLoading && user && !hasOrgRole("manager")) router.push("/dashboard");
  }, [user, authLoading, router, hasOrgRole]);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  // Build a lookup so the onboarding cards can show "Jamie Jones (NXR-0003)"
  // instead of just the raw business id. Backend only returns `employeeId`
  // on onboarding records — no joined name — so we resolve client-side
  // against the HR employee list.
  const [employeeLookup, setEmployeeLookup] = useState<Record<string, Employee>>({});

  const fetchOnboardings = useCallback(async () => {
    setLoading(true);
    try {
      const [res, empsRes] = await Promise.all([
        payrollApi.getAllOnboardings(),
        hrApi.getEmployees({ limit: "100" }).catch(() => ({ data: [] as any })),
      ]);
      const data = Array.isArray(res.data) ? res.data : (res.data as any)?.records ?? [];
      setOnboardings(data);

      const empsList: any[] = Array.isArray(empsRes?.data)
        ? empsRes.data
        : Array.isArray((empsRes?.data as any)?.data)
          ? (empsRes.data as any).data
          : [];
      const map: Record<string, Employee> = {};
      // Onboarding records use the business `employeeId` (e.g. NXR-0003),
      // not the HR ObjectId, so key the lookup by that.
      for (const e of empsList) if (e?.employeeId) map[e.employeeId] = e;
      setEmployeeLookup(map);
    } catch (err: any) {
      toast.error(err.message || "Failed to load onboarding records");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchOnboardings();
  }, [fetchOnboardings, user]);

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------
  const totalCount = onboardings.length;
  const pendingCount = onboardings.filter((o) => o.status === "pending").length;
  const inProgressCount = onboardings.filter((o) => o.status === "in_progress").length;
  const completedCount = onboardings.filter((o) => o.status === "completed").length;

  // Pagination
  const ITEMS_PER_PAGE = 20;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(onboardings.length / ITEMS_PER_PAGE);
  const paginatedOnboardings = onboardings.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  // Reset page when data changes significantly
  useEffect(() => { setCurrentPage(1); }, [onboardings.length]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------
  const handleInitiate = async () => {
    if (!formEmployeeId.trim()) {
      toast.error("Employee ID is required");
      return;
    }
    setActionLoading("initiate");
    try {
      const payload: Record<string, unknown> = {
        employeeId: formEmployeeId.trim(),
        startDate: formStartDate,
        targetCompletionDate: formTargetDate,
      };
      if (formBuddyId.trim()) payload.buddyId = formBuddyId.trim();
      if (formProbationEnd) payload.probationEndDate = formProbationEnd;
      await payrollApi.initiateOnboarding(payload);
      toast.success("Onboarding initiated successfully");
      setShowInitiateModal(false);
      resetForm();
      fetchOnboardings();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate onboarding");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteTask = async (empId: string, taskId: string) => {
    setActionLoading(`task-${taskId}`);
    try {
      await payrollApi.completeChecklistItem(empId, { taskId });
      toast.success("Task marked as complete");
      fetchOnboardings();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete task");
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyDoc = async (empId: string, docIdx: number, status: string) => {
    setActionLoading(`doc-${empId}-${docIdx}`);
    try {
      await payrollApi.verifyDocument(empId, docIdx, { status });
      toast.success(`Document ${status === "verified" ? "verified" : "rejected"} successfully`);
      fetchOnboardings();
    } catch (err: any) {
      toast.error(err.message || "Failed to update document status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleConfirm = async (empId: string) => {
    if (!window.confirm("Confirm this employee? This action cannot be undone.")) return;
    setActionLoading(`confirm-${empId}`);
    try {
      await payrollApi.confirmEmployee(empId);
      toast.success("Employee confirmed successfully");
      fetchOnboardings();
    } catch (err: any) {
      toast.error(err.message || "Failed to confirm employee");
    } finally {
      setActionLoading(null);
    }
  };

  const resetForm = () => {
    setFormEmployeeId("");
    setFormStartDate(getToday());
    setFormTargetDate(getDefaultTarget());
    setFormBuddyId("");
    setFormProbationEnd("");
  };

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isManager = hasOrgRole("manager");

  // ---------------------------------------------------------------------------
  // Helpers for cards
  // ---------------------------------------------------------------------------
  const getProgress = (rec: OnboardingRecord) => {
    if (!rec.checklist || rec.checklist.length === 0) return 0;
    const done = rec.checklist.filter(isTaskCompleted).length;
    return Math.round((done / rec.checklist.length) * 100);
  };

  const getChecklistSummary = (rec: OnboardingRecord) => {
    const total = rec.checklist?.length ?? 0;
    const done = rec.checklist?.filter(isTaskCompleted).length ?? 0;
    return `${done} of ${total} tasks complete`;
  };

  const getDocSummary = (rec: OnboardingRecord) => {
    const total = rec.documents?.length ?? 0;
    const verified = rec.documents?.filter((d) => d.status === "verified").length ?? 0;
    return `${verified} of ${total} documents verified`;
  };

  const canConfirm = (rec: OnboardingRecord) => {
    // Only tasks explicitly marked required gate confirmation; the rest
    // are optional welcome/training niceties.
    const allRequiredDone = rec.checklist
      ?.filter(isTaskRequired)
      .every(isTaskCompleted) ?? false;
    const allDocsVerified = rec.documents?.every((d) => d.status === "verified") ?? false;
    return allRequiredDone && allDocsVerified && !rec.confirmed;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 min-w-0 md:ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-bold text-[#0F172A]">Employee Onboarding</h1>
              <p className="text-[13px] text-[#64748B] mt-0.5">Track new employee onboarding progress</p>
            </div>
            {isManager && (
              <Button
                onClick={() => setShowInitiateModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium px-4 py-2 rounded-lg"
              >
                Initiate Onboarding
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Total Onboardings", value: totalCount, color: "text-[#0F172A]" },
              { label: "Pending", value: pendingCount, color: "text-gray-600" },
              { label: "In Progress", value: inProgressCount, color: "text-blue-600" },
              { label: "Completed", value: completedCount, color: "text-emerald-600" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-xl border border-[#E2E8F0] px-5 py-4"
              >
                <p className="text-[12px] font-medium text-[#64748B] uppercase tracking-wide">
                  {stat.label}
                </p>
                <p className={`text-[28px] font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {/* Empty State */}
          {!loading && onboardings.length === 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 text-center">
              <p className="text-[15px] text-[#64748B]">No onboarding records found.</p>
              {isManager && (
                <p className="text-[13px] text-[#94A3B8] mt-1">
                  Click &quot;Initiate Onboarding&quot; to get started.
                </p>
              )}
            </div>
          )}

          {/* Onboarding Cards */}
          {!loading && onboardings.length > 0 && (
            <div className="space-y-4">
              {paginatedOnboardings.map((rec) => {
                const stCfg = statusConfig[rec.status] || statusConfig.pending;
                const progress = getProgress(rec);
                const isExpanded = expandedId === rec._id;

                return (
                  <div
                    key={rec._id}
                    className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden"
                  >
                    {/* Card Summary */}
                    <div className="px-6 py-5">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center flex-wrap gap-2">
                            {(() => {
                              const emp = employeeLookup[rec.employeeId];
                              const fullName = emp
                                ? [emp.firstName, emp.lastName].filter(Boolean).join(" ")
                                : "";
                              return fullName ? (
                                <>
                                  <h3 className="text-[15px] font-semibold text-[#0F172A]">{fullName}</h3>
                                  <span className="text-[12px] text-[#94A3B8]">{rec.employeeId}</span>
                                </>
                              ) : (
                                <h3 className="text-[15px] font-semibold text-[#0F172A]">{rec.employeeId}</h3>
                              );
                            })()}
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${stCfg.color}`}
                            >
                              {stCfg.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-[13px] text-[#64748B]">
                            <span>Start: {formatDate(rec.startDate)}</span>
                            <span className="text-[#E2E8F0]">|</span>
                            <span>Target: {formatDate(rec.targetCompletionDate)}</span>
                            {rec.buddyId && (
                              <>
                                <span className="text-[#E2E8F0]">|</span>
                                <span>Buddy: {rec.buddyId}</span>
                              </>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="mt-3 max-w-md">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] text-[#64748B]">
                                {getChecklistSummary(rec)}
                              </span>
                              <span className="text-[12px] font-medium text-[#0F172A]">
                                {progress}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <p className="text-[12px] text-[#64748B] mt-1">
                              {getDocSummary(rec)}
                            </p>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          onClick={() => setExpandedId(isExpanded ? null : rec._id)}
                          className="text-[13px] font-medium ml-4 shrink-0"
                        >
                          {isExpanded ? "Hide Details" : "View Details"}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-[#E2E8F0] px-6 py-5 bg-[#FAFBFC]">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Checklist Section */}
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#0F172A] mb-3">
                              Checklist
                            </h4>
                            {(!rec.checklist || rec.checklist.length === 0) ? (
                              <p className="text-[13px] text-[#94A3B8]">No checklist items.</p>
                            ) : (
                              <div className="space-y-2">
                                {rec.checklist.map((task) => {
                                  const catCfg = categoryConfig[task.category] || categoryConfig.other;
                                  const taskDone = isTaskCompleted(task);
                                  const taskRequired = isTaskRequired(task);
                                  return (
                                    <div
                                      key={task.taskId}
                                      className="flex items-center justify-between bg-white rounded-lg border border-[#E2E8F0] px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={taskDone}
                                          readOnly
                                          className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-default"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <span
                                              className={`text-[13px] font-medium ${
                                                taskDone
                                                  ? "text-[#94A3B8] line-through"
                                                  : "text-[#0F172A]"
                                              }`}
                                            >
                                              {task.title}
                                            </span>
                                            <span
                                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${catCfg.color}`}
                                            >
                                              {catCfg.label}
                                            </span>
                                            {taskRequired && (
                                              <span className="text-[10px] text-red-500 font-medium">
                                                Required
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[#94A3B8]">
                                            {task.assignedTo && <span>Assigned: {task.assignedTo}</span>}
                                            {task.dueDate && <span>Due: {formatDate(task.dueDate)}</span>}
                                          </div>
                                        </div>
                                      </div>
                                      {!taskDone && isManager && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleCompleteTask(rec.employeeId, task.taskId)}
                                          disabled={actionLoading === `task-${task.taskId}`}
                                          className="text-[11px] bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded ml-2 shrink-0"
                                        >
                                          {actionLoading === `task-${task.taskId}` ? "..." : "Mark Complete"}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          {/* Documents Section */}
                          <div>
                            <h4 className="text-[14px] font-semibold text-[#0F172A] mb-3">
                              Documents
                            </h4>
                            {(!rec.documents || rec.documents.length === 0) ? (
                              <p className="text-[13px] text-[#94A3B8]">No documents required.</p>
                            ) : (
                              <div className="space-y-2">
                                {rec.documents.map((doc, idx) => {
                                  const dCfg = docStatusConfig[doc.status] || docStatusConfig.pending;
                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between bg-white rounded-lg border border-[#E2E8F0] px-4 py-3"
                                    >
                                      <div className="flex items-center gap-3">
                                        <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                        </svg>
                                        <div>
                                          <span className="text-[13px] font-medium text-[#0F172A]">
                                            {doc.type}
                                          </span>
                                          <span
                                            className={`ml-2 inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${dCfg.color}`}
                                          >
                                            {dCfg.label}
                                          </span>
                                          {doc.rejectionReason && (
                                            <p className="text-[11px] text-red-500 mt-0.5">
                                              Reason: {doc.rejectionReason}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {isManager && doc.status === "uploaded" && (
                                        <div className="flex items-center gap-2 ml-2 shrink-0">
                                          <Button
                                            size="sm"
                                            onClick={() => handleVerifyDoc(rec.employeeId, idx, "verified")}
                                            disabled={actionLoading === `doc-${rec.employeeId}-${idx}`}
                                            className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded"
                                          >
                                            Verify
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleVerifyDoc(rec.employeeId, idx, "rejected")}
                                            disabled={actionLoading === `doc-${rec.employeeId}-${idx}`}
                                            className="text-[11px] text-red-600 border-red-200 hover:bg-red-50 px-3 py-1 rounded"
                                          >
                                            Reject
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Info Section */}
                            <div className="mt-6">
                              <h4 className="text-[14px] font-semibold text-[#0F172A] mb-3">
                                Info
                              </h4>
                              <div className="bg-white rounded-lg border border-[#E2E8F0] px-4 py-3 space-y-2 text-[13px]">
                                <div className="flex justify-between">
                                  <span className="text-[#64748B]">Start Date</span>
                                  <span className="text-[#0F172A] font-medium">{formatDate(rec.startDate)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-[#64748B]">Target Completion</span>
                                  <span className="text-[#0F172A] font-medium">{formatDate(rec.targetCompletionDate)}</span>
                                </div>
                                {rec.buddyId && (
                                  <div className="flex justify-between">
                                    <span className="text-[#64748B]">Buddy</span>
                                    <span className="text-[#0F172A] font-medium">{rec.buddyId}</span>
                                  </div>
                                )}
                                {rec.probationEndDate && (
                                  <div className="flex justify-between">
                                    <span className="text-[#64748B]">Probation End</span>
                                    <span className="text-[#0F172A] font-medium">{formatDate(rec.probationEndDate)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-[#64748B]">Confirmation</span>
                                  <span className={`font-medium ${rec.confirmed ? "text-emerald-600" : "text-amber-600"}`}>
                                    {rec.confirmed ? "Confirmed" : "Pending"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Confirm Employee Button */}
                            {isManager && canConfirm(rec) && (
                              <Button
                                onClick={() => handleConfirm(rec.employeeId)}
                                disabled={actionLoading === `confirm-${rec.employeeId}`}
                                className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-medium py-2 rounded-lg"
                              >
                                {actionLoading === `confirm-${rec.employeeId}`
                                  ? "Confirming..."
                                  : "Confirm Employee"}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-[#E2E8F0]">
                  <p className="text-[12px] text-[#64748B]">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, onboardings.length)} of {onboardings.length}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-[12px] rounded-lg border border-[#E2E8F0] disabled:opacity-40 hover:bg-[#F8FAFC]"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Initiate Onboarding Modal */}
      {showInitiateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setShowInitiateModal(false);
              resetForm();
            }}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[17px] font-bold text-[#0F172A]">Initiate Onboarding</h2>
              <button
                onClick={() => {
                  setShowInitiateModal(false);
                  resetForm();
                }}
                className="text-[#94A3B8] hover:text-[#0F172A] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Employee — autocomplete picker (was free-text).
                  Onboarding records key off the business `employeeId`
                  (e.g. NXR-0003), so we request `valueKind="businessId"`.
                  This matches the existing backend contract without a
                  migration. */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">
                  Employee <span className="text-red-500">*</span>
                </label>
                <EmployeePicker
                  value={formEmployeeId}
                  onChange={(next) => setFormEmployeeId(next)}
                  valueKind="businessId"
                  placeholder="Search employees by name, ID, or email…"
                  required
                />
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Target Completion Date */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">
                  Target Completion Date
                </label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Buddy ID */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">
                  Buddy ID <span className="text-[#94A3B8] text-[11px]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={formBuddyId}
                  onChange={(e) => setFormBuddyId(e.target.value)}
                  placeholder="e.g. EMP-042"
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Probation End Date */}
              <div>
                <label className="block text-[13px] font-medium text-[#374151] mb-1">
                  Probation End Date <span className="text-[#94A3B8] text-[11px]">(optional)</span>
                </label>
                <input
                  type="date"
                  value={formProbationEnd}
                  onChange={(e) => setFormProbationEnd(e.target.value)}
                  className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-[13px] text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInitiateModal(false);
                  resetForm();
                }}
                className="text-[13px] px-4 py-2"
              >
                Cancel
              </Button>
              <Button
                onClick={handleInitiate}
                disabled={actionLoading === "initiate" || !formEmployeeId.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-medium px-4 py-2 rounded-lg"
              >
                {actionLoading === "initiate" ? "Initiating..." : "Initiate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
