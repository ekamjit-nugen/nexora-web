"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface Webhook {
  _id: string;
  name: string;
  url: string;
  events: string[];
  active?: boolean;
  status?: "enabled" | "disabled";
  lastTriggeredAt?: string;
  successCount?: number;
  failureCount?: number;
  createdAt?: string;
}

interface EventCategory {
  key: string;
  label: string;
  events: string[];
}

const EVENT_CATEGORIES: EventCategory[] = [
  {
    key: "employees",
    label: "Employees",
    events: ["employee.created", "employee.updated", "employee.deleted"],
  },
  {
    key: "tasks",
    label: "Tasks",
    events: ["task.created", "task.updated", "task.completed", "task.deleted"],
  },
  {
    key: "projects",
    label: "Projects",
    events: ["project.created", "project.updated", "project.archived"],
  },
  {
    key: "leaves",
    label: "Leaves",
    events: ["leave.applied", "leave.approved", "leave.rejected"],
  },
  {
    key: "payroll",
    label: "Payroll",
    events: ["payroll.run_processed", "payroll.payslip_generated"],
  },
  {
    key: "attendance",
    label: "Attendance",
    events: ["attendance.checked_in", "attendance.checked_out"],
  },
];

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

function relativeTime(value?: string): string {
  if (!value) return "Never";
  const then = new Date(value).getTime();
  const now = Date.now();
  const diff = now - then;
  if (diff < 0) return "Just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return `${Math.floor(day / 30)}mo ago`;
}

export default function WebhooksPage() {
  const { user, hasOrgRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>([]);
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  // Created secret modal
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const allowed = hasOrgRole("admin");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!allowed) {
      toast.error("You don't have permission to manage webhooks");
      router.push("/settings/profile");
    }
  }, [authLoading, user, allowed, router]);

  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await authApi.listWebhooks();
      const data = Array.isArray(res) ? res : res?.data || res?.webhooks || [];
      setWebhooks(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load webhooks");
      setWebhooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) fetchWebhooks();
  }, [allowed, fetchWebhooks]);

  const resetForm = () => {
    setFormName("");
    setFormUrl("");
    setFormEvents([]);
    setFormActive(true);
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleCategory = (events: string[]) => {
    const allSelected = events.every((e) => formEvents.includes(e));
    if (allSelected) {
      setFormEvents((prev) => prev.filter((e) => !events.includes(e)));
    } else {
      setFormEvents((prev) => {
        const next = new Set(prev);
        events.forEach((e) => next.add(e));
        return Array.from(next);
      });
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!/^https:\/\//i.test(formUrl.trim())) {
      toast.error("URL must start with https://");
      return;
    }
    if (formEvents.length === 0) {
      toast.error("Please select at least one event");
      return;
    }
    setSaving(true);
    try {
      const res: any = await authApi.createWebhook({
        name: formName.trim(),
        url: formUrl.trim(),
        events: formEvents,
      });
      const secret = res?.secret || res?.data?.secret || res?.webhook?.secret;
      if (secret) {
        setCreatedSecret(secret);
      } else {
        toast.success("Webhook endpoint created");
      }
      setShowCreate(false);
      resetForm();
      await fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (webhook: Webhook) => {
    if (
      !window.confirm(
        `Delete webhook "${webhook.name}"? This cannot be undone and will stop event deliveries.`
      )
    )
      return;
    try {
      await authApi.deleteWebhook(webhook._id);
      toast.success("Webhook deleted");
      await fetchWebhooks();
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete webhook");
    }
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    try {
      await navigator.clipboard.writeText(createdSecret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error("Unable to copy");
    }
  };

  const isEnabled = (w: Webhook) => w.active !== false && w.status !== "disabled";

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">Webhooks</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Receive real-time event notifications in your systems. We sign each
            payload with HMAC-SHA256 using your endpoint's secret.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Endpoint
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading webhooks...</div>
        ) : webhooks.length === 0 ? (
          <div className="p-10 text-center">
            <svg className="w-10 h-10 mx-auto text-[#CBD5E1] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm text-[#64748B]">No webhook endpoints configured.</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Add your first endpoint to start receiving events.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] text-xs uppercase tracking-wider text-[#64748B]">
                  <th className="text-left font-semibold px-4 py-3">Name</th>
                  <th className="text-left font-semibold px-4 py-3">URL</th>
                  <th className="text-left font-semibold px-4 py-3">Events</th>
                  <th className="text-left font-semibold px-4 py-3">Status</th>
                  <th className="text-left font-semibold px-4 py-3">Last Triggered</th>
                  <th className="text-left font-semibold px-4 py-3">Success / Fail</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {webhooks.map((w) => {
                  const enabled = isEnabled(w);
                  const success = w.successCount ?? 0;
                  const fail = w.failureCount ?? 0;
                  return (
                    <tr key={w._id} className="hover:bg-[#F8FAFC] transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0F172A]">{w.name}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs font-mono text-[#334155] cursor-help"
                          title={w.url}
                        >
                          {truncate(w.url, 40)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {(w.events || []).slice(0, 3).map((e) => (
                            <span
                              key={e}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B]"
                            >
                              {e}
                            </span>
                          ))}
                          {(w.events?.length || 0) > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium text-[#94A3B8]">
                              +{(w.events?.length || 0) - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            enabled ? "text-green-600" : "text-[#94A3B8]"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              enabled ? "bg-green-500" : "bg-[#CBD5E1]"
                            }`}
                          />
                          {enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                        {relativeTime(w.lastTriggeredAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-green-600 font-medium">{success}</span>
                        <span className="text-[#CBD5E1] mx-1">/</span>
                        <span className={fail > 0 ? "text-red-500 font-medium" : "text-[#94A3B8]"}>
                          {fail}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleDelete(w)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0]">
              <h3 className="text-lg font-semibold text-[#0F172A]">Add Webhook Endpoint</h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="text-[#94A3B8] hover:text-[#64748B] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Production listener"
                  className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  URL <span className="text-red-500">*</span>
                </label>
                <input
                  type="url"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  placeholder="https://api.example.com/webhooks/nexora"
                  className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] font-mono focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                />
                <p className="mt-1 text-xs text-[#94A3B8]">Must be a valid HTTPS URL.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334155] mb-2">
                  Events <span className="text-red-500">*</span>
                </label>
                <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#E2E8F0]">
                  {EVENT_CATEGORIES.map((cat) => {
                    const selectedInCat = cat.events.filter((e) =>
                      formEvents.includes(e)
                    ).length;
                    return (
                      <div key={cat.key} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                            {cat.label}
                            {selectedInCat > 0 && (
                              <span className="ml-2 text-[#2E86C1] font-normal normal-case">
                                ({selectedInCat} selected)
                              </span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.events)}
                            className="text-[11px] text-[#2E86C1] hover:text-[#2874A6] font-medium"
                          >
                            {cat.events.every((e) => formEvents.includes(e))
                              ? "Clear"
                              : "Select all"}
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {cat.events.map((e) => {
                            const checked = formEvents.includes(e);
                            return (
                              <label
                                key={e}
                                className="flex items-center gap-2 cursor-pointer hover:bg-[#F8FAFC] rounded px-1 py-0.5"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleEvent(e)}
                                  className="w-4 h-4 rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1]"
                                />
                                <code className="text-xs font-mono text-[#334155]">{e}</code>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8]">
                  {formEvents.length} event{formEvents.length === 1 ? "" : "s"} selected
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formActive}
                    onChange={(e) => setFormActive(e.target.checked)}
                    className="w-4 h-4 rounded border-[#CBD5E1] text-[#2E86C1] focus:ring-[#2E86C1]"
                  />
                  <span className="text-sm font-medium text-[#334155]">
                    Active (receive events immediately)
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-[#64748B] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Secret Created Modal */}
      {createdSecret && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A]">Webhook Created</h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800 font-medium">
                  Your webhook secret (copy now — you won't see it again)
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                  Signing Secret
                </label>
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 min-w-0 text-xs bg-[#F1F5F9] px-3 py-2.5 rounded-lg font-mono text-[#0F172A] break-all select-all">
                    {createdSecret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="shrink-0 px-4 text-xs font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors"
                  >
                    {copiedSecret ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-[#64748B]">
                Use this secret to verify webhook signatures. Nexora signs each
                payload with HMAC-SHA256 and sends the signature in the{" "}
                <code className="bg-[#F1F5F9] px-1 py-0.5 rounded font-mono">
                  X-Nexora-Signature
                </code>{" "}
                header.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={() => setCreatedSecret(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors"
              >
                I've Saved It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
