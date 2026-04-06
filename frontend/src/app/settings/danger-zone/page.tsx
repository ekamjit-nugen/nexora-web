"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { orgApi, authApi } from "@/lib/api";
import { toast } from "sonner";

export default function DangerZonePage() {
  const { user, currentOrg, logout, orgRole } = useAuth();

  // Transfer ownership
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferEmail, setTransferEmail] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  // Delete org
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isOwner = orgRole === "owner" || user?.roles?.includes("owner");

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Owner Access Required</h2>
        <p className="text-sm text-[#64748B] mt-1 text-center max-w-sm">Only the organization owner can access the Danger Zone. Contact your admin for assistance.</p>
      </div>
    );
  }

  const handleTransfer = async () => {
    if (!transferEmail.trim()) { toast.error("Enter the new owner's email"); return; }
    setTransferLoading(true);
    try {
      toast.info("Ownership transfer is coming soon. This feature requires OTP verification.");
    } catch {
      toast.error("Failed to transfer ownership");
    } finally {
      setTransferLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrg || deleteConfirm !== currentOrg.name) {
      toast.error("Organization name doesn't match");
      return;
    }
    setDeleteLoading(true);
    try {
      await orgApi.deleteOrg(currentOrg._id);
      toast.success("Organization has been scheduled for deletion (30-day grace period)");
      setShowDelete(false);
      setTimeout(() => { window.location.href = "/login"; }, 2000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete organization");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-red-600">Danger Zone</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Irreversible actions that affect your entire organization. Proceed with caution.</p>
      </div>

      {/* Transfer Ownership */}
      <div className="bg-white rounded-xl border-2 border-red-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Transfer Ownership</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-lg">Transfer organization ownership to another admin. You will be demoted to admin role. This action requires OTP verification.</p>
            </div>
          </div>
          <button onClick={() => setShowTransfer(!showTransfer)}
            className="px-4 py-2 border border-red-300 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-all flex-shrink-0">
            Transfer
          </button>
        </div>
        {showTransfer && (
          <div className="mt-5 pt-5 border-t border-red-100">
            <label className="block text-sm font-medium text-[#334155] mb-1.5">New Owner Email</label>
            <div className="flex gap-3">
              <input type="email" value={transferEmail} onChange={(e) => setTransferEmail(e.target.value)}
                className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-300 outline-none"
                placeholder="admin@company.com" />
              <button onClick={handleTransfer} disabled={transferLoading || !transferEmail.trim()}
                className="bg-red-500 text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-all">
                {transferLoading ? "Processing..." : "Confirm Transfer"}
              </button>
            </div>
            <p className="text-xs text-[#94A3B8] mt-2">The new owner must be an existing admin in your organization.</p>
          </div>
        )}
      </div>

      {/* Export Data */}
      <div className="bg-white rounded-xl border-2 border-red-200 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12M12 16.5V3" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#0F172A]">Export All Data</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-lg">Download a complete export of your organization data including members, projects, attendance, leave, payroll, and audit logs.</p>
            </div>
          </div>
          <button onClick={() => toast.info("Data export feature coming soon")}
            className="px-4 py-2 border border-amber-300 text-amber-700 rounded-xl text-sm font-medium hover:bg-amber-50 transition-all flex-shrink-0">
            Export
          </button>
        </div>
      </div>

      {/* Delete Organization */}
      <div className="bg-white rounded-xl border-2 border-red-300 p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-red-700">Delete Organization</h3>
              <p className="text-xs text-[#64748B] mt-1 max-w-lg">Permanently delete this organization and all associated data. There is a 30-day grace period during which you can cancel. After that, all data is permanently removed.</p>
            </div>
          </div>
          <button onClick={() => setShowDelete(!showDelete)}
            className="bg-red-500 text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-red-600 transition-all flex-shrink-0">
            Delete Organization
          </button>
        </div>
        {showDelete && (
          <div className="mt-5 pt-5 border-t border-red-200">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-sm text-red-800 font-medium">This will permanently delete:</p>
              <ul className="text-xs text-red-700 mt-2 space-y-1 ml-4 list-disc">
                <li>All organization members and their access</li>
                <li>All projects, tasks, and documents</li>
                <li>All payroll records and attendance data</li>
                <li>All audit logs and settings</li>
              </ul>
            </div>
            <label className="block text-sm font-medium text-[#334155] mb-1.5">
              Type <strong className="text-red-600">{currentOrg?.name}</strong> to confirm
            </label>
            <input type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full rounded-xl border border-red-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-200 focus:border-red-400 outline-none mb-4"
              placeholder="Organization name" />
            <div className="flex justify-end gap-3">
              <button onClick={() => { setShowDelete(false); setDeleteConfirm(""); }}
                className="px-4 py-2.5 text-sm text-[#64748B] hover:text-[#334155]">Cancel</button>
              <button onClick={handleDelete} disabled={deleteLoading || deleteConfirm !== currentOrg?.name}
                className="bg-red-600 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-all">
                {deleteLoading ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
