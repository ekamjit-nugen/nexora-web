"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { orgApi } from "@/lib/api";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Consulting",
  "Media",
  "Real Estate",
  "Other",
];

const companySizes = [
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1000+",
];

const timezones = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const currencies = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CNY"];
const dateFormats = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

export default function OrganizationSettingsPage() {
  const { user, currentOrg } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [domain, setDomain] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [currency, setCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("DD/MM/YYYY");

  const userRoles = user?.roles || [];
  const isAdminOrHr = userRoles.some((r) => ["admin", "super_admin", "hr"].includes(r));

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name || "");
      setIndustry(currentOrg.industry || "");
      setSize(currentOrg.size || "");
      setDomain(currentOrg.domain || "");
      setTimezone(currentOrg.settings?.timezone || "UTC");
      setCurrency(currentOrg.settings?.currency || "USD");
      setDateFormat(currentOrg.settings?.dateFormat || "DD/MM/YYYY");
    }
  }, [currentOrg]);

  if (!user) return null;

  if (!isAdminOrHr) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">Access Denied</h2>
        <p className="text-sm text-[#64748B] mt-1">You do not have permission to view this page.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!currentOrg) {
      toast.error("No organization selected");
      return;
    }
    setSaving(true);
    try {
      await orgApi.update(currentOrg._id, {
        name: orgName,
        industry,
        size,
        domain,
        settings: { timezone, currency, dateFormat },
      } as Parameters<typeof orgApi.update>[1]);
      toast.success("Organization settings saved");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save settings";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentOrg) return;
    if (deleteConfirmText !== currentOrg.name) {
      toast.error("Organization name does not match");
      return;
    }
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3005"}/api/v1/auth/organizations/${currentOrg._id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to delete organization");
      }
      toast.success("Organization deleted");
      setShowDeleteModal(false);
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete organization";
      toast.error(message);
    }
  };

  const selectClass =
    "w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors appearance-none cursor-pointer";
  const inputClass =
    "w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors";

  return (
    <RouteGuard minOrgRole="admin">
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0F172A]">Organization</h2>
        <p className="text-[13px] text-[#64748B] mt-1">
          Manage your organization settings and preferences.
        </p>
      </div>

      {/* General Info */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">General Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organization Name</label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className={inputClass}
              placeholder="Your organization"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
            <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectClass}>
              <option value="">Select industry</option>
              {industries.map((i) => (
                <option key={i} value={i.toLowerCase()}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company Size</label>
            <select value={size} onChange={(e) => setSize(e.target.value)} className={selectClass}>
              <option value="">Select size</option>
              {companySizes.map((s) => (
                <option key={s} value={s}>{s} employees</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Domain</label>
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className={inputClass}
              placeholder="yourcompany.com"
            />
          </div>
        </div>
      </div>

      {/* Regional Settings */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#0F172A] mb-5">Regional Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={selectClass}>
              {timezones.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selectClass}>
              {currencies.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
            <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={selectClass}>
              {dateFormats.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#2E86C1] text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-[#2874A6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-[#64748B] mb-4">
          Once you delete an organization, there is no going back. Please be certain.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="bg-red-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-red-600 transition-colors"
        >
          Delete Organization
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#0F172A]">Delete Organization</h3>
                <p className="text-xs text-[#64748B]">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-sm text-[#334155] mb-4">
              Type <strong>{currentOrg?.name}</strong> to confirm deletion.
            </p>

            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none mb-4"
              placeholder="Organization name"
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
                }}
                className="px-4 py-2.5 text-sm font-medium text-[#64748B] hover:text-[#334155] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirmText !== currentOrg?.name}
                className="bg-red-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Organization
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </RouteGuard>
  );
}
