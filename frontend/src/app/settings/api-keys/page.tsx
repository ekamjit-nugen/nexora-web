"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface ApiKey {
  _id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt?: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

interface ScopeGroup {
  resource: string;
  label: string;
  scopes: { value: string; label: string }[];
}

const SCOPE_GROUPS: ScopeGroup[] = [
  {
    resource: "employees",
    label: "Employees",
    scopes: [
      { value: "employees:read", label: "Read" },
      { value: "employees:write", label: "Write" },
    ],
  },
  {
    resource: "tasks",
    label: "Tasks",
    scopes: [
      { value: "tasks:read", label: "Read" },
      { value: "tasks:write", label: "Write" },
    ],
  },
  {
    resource: "projects",
    label: "Projects",
    scopes: [
      { value: "projects:read", label: "Read" },
      { value: "projects:write", label: "Write" },
    ],
  },
  {
    resource: "payroll",
    label: "Payroll",
    scopes: [
      { value: "payroll:read", label: "Read" },
      { value: "payroll:write", label: "Write" },
    ],
  },
  {
    resource: "leaves",
    label: "Leaves",
    scopes: [
      { value: "leaves:read", label: "Read" },
      { value: "leaves:write", label: "Write" },
    ],
  },
  {
    resource: "attendance",
    label: "Attendance",
    scopes: [
      { value: "attendance:read", label: "Read" },
      { value: "attendance:write", label: "Write" },
    ],
  },
  {
    resource: "analytics",
    label: "Analytics",
    scopes: [{ value: "analytics:read", label: "Read" }],
  },
];

const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes.map((s) => s.value));

function scopeColor(scope: string): string {
  if (scope.endsWith(":write")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-blue-50 text-blue-700 border-blue-200";
}

function formatDate(value?: string): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
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
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export default function ApiKeysPage() {
  const { user, hasOrgRole, loading: authLoading } = useAuth();
  const router = useRouter();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createScopes, setCreateScopes] = useState<string[]>([]);
  const [createExpiresAt, setCreateExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);

  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedCreated, setCopiedCreated] = useState(false);

  const allowed = hasOrgRole("admin");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!allowed) {
      toast.error("You don't have permission to manage API keys");
      router.push("/settings/profile");
    }
  }, [authLoading, user, allowed, router]);

  const fetchKeys = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await authApi.listApiKeys();
      const data = Array.isArray(res) ? res : res?.data || res?.apiKeys || [];
      setKeys(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load API keys");
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (allowed) fetchKeys();
  }, [allowed, fetchKeys]);

  const toggleScope = (scope: string) => {
    setCreateScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const selectAllScopes = () => setCreateScopes([...ALL_SCOPES]);
  const clearScopes = () => setCreateScopes([]);

  const resetCreateForm = () => {
    setCreateName("");
    setCreateScopes([]);
    setCreateExpiresAt("");
  };

  const handleCreate = async () => {
    if (!createName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (createScopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }
    setCreating(true);
    try {
      const res: any = await authApi.createApiKey({
        name: createName.trim(),
        scopes: createScopes,
        expiresAt: createExpiresAt || undefined,
      });
      const key = res?.key || res?.apiKey || res?.data?.key || res?.plaintext;
      if (key) {
        setCreatedKey(key);
      } else {
        toast.success("API key created");
      }
      setShowCreate(false);
      resetCreateForm();
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create API key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (key: ApiKey) => {
    const reason = window.prompt(
      `Revoke API key "${key.name}"? This cannot be undone.\n\nOptional reason:`,
      ""
    );
    if (reason === null) return;
    try {
      await authApi.revokeApiKey(key._id, reason || undefined);
      toast.success("API key revoked");
      await fetchKeys();
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke key");
    }
  };

  const copyPrefix = async (prefix: string) => {
    try {
      await navigator.clipboard.writeText(prefix);
      toast.success("Prefix copied");
    } catch {
      toast.error("Unable to copy");
    }
  };

  const copyCreatedKey = async () => {
    if (!createdKey) return;
    try {
      await navigator.clipboard.writeText(createdKey);
      setCopiedCreated(true);
      setTimeout(() => setCopiedCreated(false), 2000);
    } catch {
      toast.error("Unable to copy");
    }
  };

  if (!allowed) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">API Keys</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Programmatic access to your Nexora data. Rotate keys regularly.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create New Key
        </button>
      </div>

      {/* Security Warning */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-amber-800">
            API keys provide full access to your organization's data within their scopes.
            Never share keys publicly, commit to source control, or embed in client-side code.
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-sm text-[#64748B]">Loading API keys...</div>
        ) : keys.length === 0 ? (
          <div className="p-10 text-center">
            <svg className="w-10 h-10 mx-auto text-[#CBD5E1] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <p className="text-sm text-[#64748B]">No API keys yet.</p>
            <p className="text-xs text-[#94A3B8] mt-1">
              Create your first key to start using the Nexora API.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F8FAFC] text-xs uppercase tracking-wider text-[#64748B]">
                  <th className="text-left font-semibold px-4 py-3">Name</th>
                  <th className="text-left font-semibold px-4 py-3">Prefix</th>
                  <th className="text-left font-semibold px-4 py-3">Scopes</th>
                  <th className="text-left font-semibold px-4 py-3">Created</th>
                  <th className="text-left font-semibold px-4 py-3">Last Used</th>
                  <th className="text-right font-semibold px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {keys.map((k) => (
                  <tr key={k._id} className="hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0F172A]">{k.name}</div>
                      {k.revokedAt && (
                        <div className="text-xs text-red-500 mt-0.5">Revoked</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs font-mono text-[#334155] bg-[#F1F5F9] px-2 py-1 rounded">
                        {k.prefix}••••••••
                      </code>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[240px]">
                        {(k.scopes || []).map((s) => (
                          <span
                            key={s}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${scopeColor(s)}`}
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                      {formatDate(k.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[#64748B] whitespace-nowrap">
                      {relativeTime(k.lastUsedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => copyPrefix(k.prefix)}
                          className="px-2.5 py-1 text-xs font-medium text-[#64748B] bg-[#F1F5F9] hover:bg-[#E2E8F0] rounded transition-colors"
                        >
                          Copy
                        </button>
                        {!k.revokedAt && (
                          <button
                            onClick={() => handleRevoke(k)}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
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
              <h3 className="text-lg font-semibold text-[#0F172A]">Create New API Key</h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
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
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Production Server, CI Pipeline"
                  className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-[#334155]">
                    Scopes <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllScopes}
                      className="text-xs text-[#2E86C1] hover:text-[#2874A6] font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-[#E2E8F0]">|</span>
                    <button
                      type="button"
                      onClick={clearScopes}
                      className="text-xs text-[#64748B] hover:text-[#334155] font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="border border-[#E2E8F0] rounded-lg divide-y divide-[#E2E8F0]">
                  {SCOPE_GROUPS.map((group) => (
                    <div key={group.resource} className="p-3">
                      <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {group.scopes.map((s) => {
                          const checked = createScopes.includes(s.value);
                          return (
                            <label
                              key={s.value}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                                checked
                                  ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]"
                                  : "border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1]"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScope(s.value)}
                                className="sr-only"
                              />
                              {s.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-[#94A3B8]">
                  {createScopes.length} scope{createScopes.length === 1 ? "" : "s"} selected
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#334155] mb-1.5">
                  Expires At <span className="text-[#94A3B8] font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={createExpiresAt}
                  onChange={(e) => setCreateExpiresAt(e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
                />
                <p className="mt-1 text-xs text-[#94A3B8]">
                  Leave blank for keys that don't expire.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                className="px-4 py-2 text-sm font-medium text-[#64748B] bg-white border border-[#E2E8F0] hover:bg-[#F1F5F9] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Key"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Key Created Success Modal */}
      {createdKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#0F172A]">API Key Created</h3>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm text-amber-800 font-medium">
                  Copy this key now. You will NOT see it again.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#64748B] mb-1.5">
                  Your API Key
                </label>
                <div className="flex items-stretch gap-2">
                  <code className="flex-1 min-w-0 text-xs bg-[#F1F5F9] px-3 py-2.5 rounded-lg font-mono text-[#0F172A] break-all select-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={copyCreatedKey}
                    className="shrink-0 px-4 text-xs font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors"
                  >
                    {copiedCreated ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              <div className="text-xs text-[#64748B]">
                Store this key in a password manager or secrets vault. Use it in the{" "}
                <code className="bg-[#F1F5F9] px-1 py-0.5 rounded font-mono">Authorization</code>{" "}
                header as{" "}
                <code className="bg-[#F1F5F9] px-1 py-0.5 rounded font-mono">
                  Bearer &lt;key&gt;
                </code>
                .
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={() => setCreatedKey(null)}
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
