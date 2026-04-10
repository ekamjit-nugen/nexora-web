"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface DeletionStatus {
  requested?: boolean;
  requestedAt?: string;
  scheduledFor?: string;
  reason?: string;
  daysRemaining?: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "\u2014";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function PrivacySettingsPage() {
  const { user } = useAuth();

  const [downloading, setDownloading] = useState(false);
  const [lastExportedAt, setLastExportedAt] = useState<string | null>(null);

  const [deletionStatus, setDeletionStatus] = useState<DeletionStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [submittingDelete, setSubmittingDelete] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancellingDelete, setCancellingDelete] = useState(false);

  // -------------------------------------------------------------------------
  // Load deletion status
  // -------------------------------------------------------------------------
  const fetchDeletionStatus = useCallback(async () => {
    try {
      const res = await authApi.getDeletionStatus();
      const data = (res as any)?.data ?? null;
      setDeletionStatus(data || null);
    } catch (err: any) {
      // If endpoint returns 404/not-found when no pending request, swallow gracefully
      if (!String(err?.message || "").toLowerCase().includes("not found")) {
        toast.error(err.message || "Failed to load deletion status");
      }
      setDeletionStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchDeletionStatus();
      // Last export timestamp from localStorage (best-effort local hint)
      try {
        const ts = localStorage.getItem("nexora:lastDataExport");
        if (ts) setLastExportedAt(ts);
      } catch {
        /* no-op */
      }
    }
  }, [user, fetchDeletionStatus]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await authApi.downloadDataExport();
      const data = (res as any).data;
      const content = data?.content ?? data;
      const filename =
        data?.filename ||
        `nexora-data-export-${new Date().toISOString().split("T")[0]}.json`;
      const blob = new Blob([JSON.stringify(content, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      const now = new Date().toISOString();
      setLastExportedAt(now);
      try {
        localStorage.setItem("nexora:lastDataExport", now);
      } catch {
        /* no-op */
      }
      toast.success("Data exported successfully");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setDownloading(false);
    }
  };

  const userEmail = (user as any)?.email || "";
  const emailMatches =
    confirmEmail.trim().toLowerCase() === userEmail.trim().toLowerCase() && userEmail.length > 0;

  const canSubmitDelete = emailMatches && understood && !submittingDelete;

  const handleSubmitDeletion = async () => {
    if (!canSubmitDelete) return;
    setSubmittingDelete(true);
    try {
      await authApi.requestAccountDeletion({
        reason: deleteReason.trim() || undefined,
        confirmEmail: confirmEmail.trim(),
      });
      toast.success("Account deletion scheduled. Check your email for details.");
      setShowDeleteModal(false);
      setDeleteReason("");
      setConfirmEmail("");
      setUnderstood(false);
      await fetchDeletionStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to request account deletion");
    } finally {
      setSubmittingDelete(false);
    }
  };

  const handleCancelDeletion = async () => {
    setCancellingDelete(true);
    try {
      await authApi.cancelAccountDeletion();
      toast.success("Account deletion cancelled");
      setShowCancelModal(false);
      await fetchDeletionStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel deletion");
    } finally {
      setCancellingDelete(false);
    }
  };

  // -------------------------------------------------------------------------
  // Derived
  // -------------------------------------------------------------------------
  const deletionRequested = useMemo(() => {
    if (!deletionStatus) return false;
    if (deletionStatus.requested === true) return true;
    if (deletionStatus.scheduledFor) return true;
    if (deletionStatus.status && ["pending", "scheduled"].includes(deletionStatus.status)) {
      return true;
    }
    return false;
  }, [deletionStatus]);

  const daysLeft = useMemo(() => {
    if (!deletionRequested) return 0;
    if (typeof deletionStatus?.daysRemaining === "number") {
      return Math.max(0, deletionStatus.daysRemaining);
    }
    if (deletionStatus?.scheduledFor) {
      const diff = new Date(deletionStatus.scheduledFor).getTime() - Date.now();
      return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
    return 0;
  }, [deletionRequested, deletionStatus]);

  if (!user) return null;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-[#0F172A]">Privacy &amp; Data</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Control your personal data. Export, port, or delete your account in accordance with GDPR.
        </p>
      </div>

      {/* Section 1: Data Export (Article 15) */}
      <Card className="rounded-xl border border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#EBF5FF] flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Data Export</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  GDPR Article 15
                </span>
              </div>
              <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
                Download a copy of all your personal data in JSON format. This includes your profile, messages,
                activity history, and associated records.
              </p>
              {lastExportedAt && (
                <p className="text-[12px] text-[#94A3B8] mt-2">
                  Last exported: {formatDateTime(lastExportedAt)}
                </p>
              )}
              <div className="mt-4">
                <Button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="bg-[#2E86C1] hover:bg-[#2574A9] h-9 gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloading ? "Preparing export..." : "Download My Data"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Data Portability (Article 20) */}
      <Card className="rounded-xl border border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Data Portability</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  GDPR Article 20
                </span>
              </div>
              <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
                Your exported data is machine-readable and can be imported into other services. The JSON schema
                follows open standards for maximum interoperability.
              </p>
              <ul className="mt-3 space-y-1.5 text-[12px] text-[#475569]">
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Structured JSON, compliant with ISO 8601 timestamps
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Includes all data you have provided to Nexora
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Free of charge, delivered on-demand
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Account Deletion (Article 17) */}
      <Card className="rounded-xl border border-[#E2E8F0] shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[15px] font-semibold text-[#0F172A]">Account Deletion</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#64748B] border border-[#E2E8F0]">
                  GDPR Article 17
                </span>
              </div>

              {loadingStatus ? (
                <div className="mt-4 h-20 rounded-lg bg-gray-100 animate-pulse" />
              ) : deletionRequested ? (
                <>
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-amber-900">
                          Deletion scheduled for {formatDate(deletionStatus?.scheduledFor)}
                        </p>
                        <p className="text-[12px] text-amber-800 mt-1">
                          You have <span className="font-semibold">{daysLeft}</span>{" "}
                          {daysLeft === 1 ? "day" : "days"} left to cancel this request. After the scheduled date
                          your account and all associated data will be permanently erased.
                        </p>
                        {deletionStatus?.requestedAt && (
                          <p className="text-[11px] text-amber-700 mt-1.5">
                            Requested on {formatDateTime(deletionStatus.requestedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => setShowCancelModal(true)}
                      className="bg-green-600 hover:bg-green-700 text-white h-9 gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Cancel Deletion Request
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <p className="text-[13px] text-red-900 leading-relaxed">
                        <span className="font-semibold">Deleting your account is permanent.</span> You will have a
                        30-day grace period during which you can cancel the request. After that, all your data
                        including messages, files, and organization memberships will be permanently erased.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => setShowDeleteModal(true)}
                      className="bg-red-600 hover:bg-red-700 text-white h-9 gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Request Account Deletion
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-[#0F172A]">Request Account Deletion</h3>
                <p className="text-[13px] text-[#64748B] mt-1">
                  This action schedules your account for deletion in 30 days.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[12px] font-medium text-[#64748B]">Reason (optional)</label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Help us improve. Why are you leaving?"
                  rows={3}
                  className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 resize-none"
                />
              </div>

              <div>
                <label className="text-[12px] font-medium text-[#64748B]">
                  Type your email to confirm
                </label>
                <input
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={userEmail}
                  className="mt-1 w-full text-[13px] rounded-lg border border-[#E2E8F0] px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400"
                />
                {confirmEmail.length > 0 && !emailMatches && (
                  <p className="mt-1 text-[11px] text-red-600">Email does not match your account.</p>
                )}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(e) => setUnderstood(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-red-600 border-[#E2E8F0] rounded focus:ring-red-500"
                />
                <span className="text-[12px] text-[#475569] leading-relaxed">
                  I understand this action cannot be undone after the 30-day grace period expires.
                </span>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteReason("");
                  setConfirmEmail("");
                  setUnderstood(false);
                }}
                disabled={submittingDelete}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitDeletion}
                disabled={!canSubmitDelete}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {submittingDelete ? "Submitting..." : "Confirm Deletion"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel deletion modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-[#0F172A]">Cancel account deletion?</h3>
            <p className="text-[13px] text-[#64748B] mt-1.5 leading-relaxed">
              Your account will remain active and no data will be removed. You can request deletion again at any
              time.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCancelModal(false)} disabled={cancellingDelete}>
                Keep Pending
              </Button>
              <Button
                onClick={handleCancelDeletion}
                disabled={cancellingDelete}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {cancellingDelete ? "Cancelling..." : "Yes, Cancel Deletion"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
