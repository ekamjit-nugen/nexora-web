"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { complianceApi } from "@/lib/api";
import { toast } from "sonner";

type DlpAction = "block" | "warn" | "redact" | "flag";

interface DlpRule {
  _id: string;
  name: string;
  pattern: string;
  action: DlpAction;
  enabled: boolean;
  isBuiltin?: boolean;
  createdAt?: string;
}

interface RetentionPolicy {
  _id: string;
  retentionDays: number;
  scope: string;
  conversationId?: string;
  createdAt?: string;
}

interface LegalHold {
  _id: string;
  name?: string;
  scope: string;
  targetId?: string;
  status: string;
  createdBy?: string;
  createdAt?: string;
  releasedAt?: string;
}

const DLP_ACTION_COLORS: Record<DlpAction, { bg: string; text: string }> = {
  block: { bg: "bg-red-50", text: "text-red-700" },
  warn: { bg: "bg-amber-50", text: "text-amber-700" },
  redact: { bg: "bg-purple-50", text: "text-purple-700" },
  flag: { bg: "bg-blue-50", text: "text-blue-700" },
};

export default function CompliancePage() {
  const { user } = useAuth();
  const [section, setSection] = useState<"dlp" | "retention" | "legal" | "ediscovery">("dlp");
  const [loading, setLoading] = useState(true);

  // DLP
  const [dlpRules, setDlpRules] = useState<DlpRule[]>([]);
  const [builtinPatterns, setBuiltinPatterns] = useState<any[]>([]);
  const [showDlpForm, setShowDlpForm] = useState(false);
  const [dlpName, setDlpName] = useState("");
  const [dlpPattern, setDlpPattern] = useState("");
  const [dlpAction, setDlpAction] = useState<DlpAction>("flag");
  const [dlpEnabled, setDlpEnabled] = useState(true);
  const [dlpSaving, setDlpSaving] = useState(false);

  // Retention
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [showRetentionForm, setShowRetentionForm] = useState(false);
  const [retDays, setRetDays] = useState("90");
  const [retScope, setRetScope] = useState("org");
  const [retConvId, setRetConvId] = useState("");
  const [retSaving, setRetSaving] = useState(false);

  // Legal Holds
  const [legalHolds, setLegalHolds] = useState<LegalHold[]>([]);
  const [showHoldForm, setShowHoldForm] = useState(false);
  const [holdName, setHoldName] = useState("");
  const [holdScope, setHoldScope] = useState("org");
  const [holdTargetId, setHoldTargetId] = useState("");
  const [holdSaving, setHoldSaving] = useState(false);

  // eDiscovery
  const [edQuery, setEdQuery] = useState("");
  const [edFrom, setEdFrom] = useState("");
  const [edBefore, setEdBefore] = useState("");
  const [edAfter, setEdAfter] = useState("");
  const [edResults, setEdResults] = useState<any[]>([]);
  const [edSearching, setEdSearching] = useState(false);
  const [edExporting, setEdExporting] = useState(false);

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ["admin", "super_admin", "owner"].includes(r));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dlpRes, patternsRes, retRes, holdsRes] = await Promise.all([
        complianceApi.getDlpRules(),
        complianceApi.getBuiltinPatterns(),
        complianceApi.getRetentionPolicies(),
        complianceApi.getLegalHolds().catch(() => ({ data: [] })),
      ]);
      setDlpRules(dlpRes.data || []);
      setBuiltinPatterns(patternsRes.data || []);
      setRetentionPolicies(retRes.data || []);
      setLegalHolds((holdsRes.data as any) || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load compliance data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleCreateDlp = async () => {
    if (!dlpName.trim() || !dlpPattern.trim()) { toast.error("Name and pattern are required"); return; }
    setDlpSaving(true);
    try {
      await complianceApi.createDlpRule({ name: dlpName, pattern: dlpPattern, action: dlpAction, enabled: dlpEnabled });
      toast.success("DLP rule created");
      setShowDlpForm(false);
      setDlpName(""); setDlpPattern(""); setDlpAction("flag"); setDlpEnabled(true);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create rule");
    } finally {
      setDlpSaving(false);
    }
  };

  const handleDeleteDlp = async (id: string) => {
    try {
      await complianceApi.deleteDlpRule(id);
      toast.success("Rule deleted");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete rule");
    }
  };

  const handleCreateRetention = async () => {
    setRetSaving(true);
    try {
      await complianceApi.createRetentionPolicy({
        retentionDays: parseInt(retDays),
        scope: retScope,
        conversationId: retScope === "conversation" ? retConvId : undefined,
      });
      toast.success("Retention policy created");
      setShowRetentionForm(false);
      setRetDays("90"); setRetScope("org"); setRetConvId("");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create policy");
    } finally {
      setRetSaving(false);
    }
  };

  const handleDeleteRetention = async (id: string) => {
    try {
      await complianceApi.deleteRetentionPolicy(id);
      toast.success("Policy deleted");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete policy");
    }
  };

  const handleCreateHold = async () => {
    if (!holdName.trim()) { toast.error("Name is required"); return; }
    setHoldSaving(true);
    try {
      await complianceApi.createLegalHold({
        name: holdName,
        scope: holdScope,
        targetId: holdScope !== "org" ? holdTargetId : undefined,
      });
      toast.success("Legal hold created");
      setShowHoldForm(false);
      setHoldName(""); setHoldScope("org"); setHoldTargetId("");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create hold");
    } finally {
      setHoldSaving(false);
    }
  };

  const handleReleaseHold = async (id: string) => {
    try {
      await complianceApi.releaseLegalHold(id);
      toast.success("Legal hold released");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to release hold");
    }
  };

  const handleEdSearch = async () => {
    setEdSearching(true);
    try {
      const res = await complianceApi.searchEdiscovery({
        q: edQuery || undefined,
        from: edFrom || undefined,
        before: edBefore || undefined,
        after: edAfter || undefined,
      });
      setEdResults(res.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Search failed");
    } finally {
      setEdSearching(false);
    }
  };

  const handleEdExport = async () => {
    setEdExporting(true);
    try {
      const res = await complianceApi.exportEdiscovery({
        q: edQuery || undefined,
        from: edFrom || undefined,
        before: edBefore || undefined,
        after: edAfter || undefined,
        format: "json",
      });
      // Download as JSON
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ediscovery-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setEdExporting(false);
    }
  };

  if (!isAdmin) {
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

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F172A]">DLP & Compliance</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Manage data loss prevention rules, retention policies, legal holds, and eDiscovery.</p>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] rounded-xl p-1 w-fit">
        {([
          { key: "dlp", label: "DLP Rules" },
          { key: "retention", label: "Retention" },
          { key: "legal", label: "Legal Holds" },
          { key: "ediscovery", label: "eDiscovery" },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setSection(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              section === t.key ? "bg-white text-[#0F172A] shadow-sm" : "text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : section === "dlp" ? (
        <div className="space-y-4">
          {/* Built-in Patterns */}
          {builtinPatterns.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Built-in Patterns (Read-only)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {builtinPatterns.map((p: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                    <div>
                      <p className="text-sm font-medium text-[#0F172A]">{p.name}</p>
                      <p className="text-xs text-[#94A3B8] font-mono mt-0.5 truncate max-w-[200px]">{p.pattern}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${DLP_ACTION_COLORS[p.action as DlpAction]?.bg || "bg-gray-50"} ${DLP_ACTION_COLORS[p.action as DlpAction]?.text || "text-gray-600"}`}>
                      {p.action}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom Rules */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#0F172A]">Custom DLP Rules</h3>
              <button onClick={() => setShowDlpForm(!showDlpForm)}
                className="bg-[#2E86C1] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all">
                {showDlpForm ? "Cancel" : "Add Rule"}
              </button>
            </div>

            {showDlpForm && (
              <div className="mb-5 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelClass}>Rule Name</label>
                    <input type="text" value={dlpName} onChange={(e) => setDlpName(e.target.value)} className={inputClass} placeholder="e.g. API Key Detection" />
                  </div>
                  <div>
                    <label className={labelClass}>Pattern (Regex)</label>
                    <input type="text" value={dlpPattern} onChange={(e) => setDlpPattern(e.target.value)} className={inputClass + " font-mono"} placeholder="e.g. sk-[a-zA-Z0-9]{32}" />
                  </div>
                  <div>
                    <label className={labelClass}>Action</label>
                    <select value={dlpAction} onChange={(e) => setDlpAction(e.target.value as DlpAction)} className={selectClass}>
                      <option value="flag">Flag</option>
                      <option value="warn">Warn</option>
                      <option value="redact">Redact</option>
                      <option value="block">Block</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className={`relative w-11 h-6 rounded-full transition-colors ${dlpEnabled ? "bg-[#2E86C1]" : "bg-[#CBD5E1]"}`}
                        onClick={() => setDlpEnabled(!dlpEnabled)}>
                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${dlpEnabled ? "translate-x-5" : ""}`} />
                      </div>
                      <span className="text-sm text-[#334155]">Enabled</span>
                    </label>
                  </div>
                </div>
                <button onClick={handleCreateDlp} disabled={dlpSaving}
                  className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
                  {dlpSaving ? "Creating..." : "Create Rule"}
                </button>
              </div>
            )}

            {dlpRules.filter(r => !r.isBuiltin).length === 0 ? (
              <p className="text-sm text-[#94A3B8] text-center py-6">No custom DLP rules configured.</p>
            ) : (
              <div className="space-y-2">
                {dlpRules.filter(r => !r.isBuiltin).map((rule) => (
                  <div key={rule._id} className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#0F172A]">{rule.name}</p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${DLP_ACTION_COLORS[rule.action]?.bg} ${DLP_ACTION_COLORS[rule.action]?.text}`}>
                          {rule.action}
                        </span>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${rule.enabled ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"}`}>
                          {rule.enabled ? "Active" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] font-mono mt-0.5 truncate">{rule.pattern}</p>
                    </div>
                    <button onClick={() => handleDeleteDlp(rule._id)} className="text-red-500 hover:text-red-700 p-1.5 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : section === "retention" ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F172A]">Retention Policies</h3>
            <button onClick={() => setShowRetentionForm(!showRetentionForm)}
              className="bg-[#2E86C1] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all">
              {showRetentionForm ? "Cancel" : "Add Policy"}
            </button>
          </div>

          {showRetentionForm && (
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Retention Days</label>
                  <input type="number" value={retDays} onChange={(e) => setRetDays(e.target.value)} className={inputClass} min="1" placeholder="90" />
                </div>
                <div>
                  <label className={labelClass}>Scope</label>
                  <select value={retScope} onChange={(e) => setRetScope(e.target.value)} className={selectClass}>
                    <option value="org">Organization-wide</option>
                    <option value="conversation">Per Conversation</option>
                  </select>
                </div>
                {retScope === "conversation" && (
                  <div>
                    <label className={labelClass}>Conversation ID</label>
                    <input type="text" value={retConvId} onChange={(e) => setRetConvId(e.target.value)} className={inputClass} placeholder="Enter conversation ID" />
                  </div>
                )}
              </div>
              <button onClick={handleCreateRetention} disabled={retSaving}
                className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
                {retSaving ? "Creating..." : "Create Policy"}
              </button>
            </div>
          )}

          {retentionPolicies.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-6">No retention policies configured.</p>
          ) : (
            <div className="space-y-2">
              {retentionPolicies.map((p) => (
                <div key={p._id} className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <p className="text-sm font-medium text-[#0F172A]">{p.retentionDays} days retention</p>
                    <p className="text-xs text-[#64748B]">Scope: {p.scope}{p.conversationId ? ` (${p.conversationId})` : ""}</p>
                  </div>
                  <button onClick={() => handleDeleteRetention(p._id)} className="text-red-500 hover:text-red-700 p-1.5 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : section === "legal" ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0F172A]">Legal Holds</h3>
            <button onClick={() => setShowHoldForm(!showHoldForm)}
              className="bg-[#2E86C1] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all">
              {showHoldForm ? "Cancel" : "Create Hold"}
            </button>
          </div>

          {showHoldForm && (
            <div className="p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className={labelClass}>Hold Name</label>
                  <input type="text" value={holdName} onChange={(e) => setHoldName(e.target.value)} className={inputClass} placeholder="e.g. Q1 Legal Review" />
                </div>
                <div>
                  <label className={labelClass}>Scope</label>
                  <select value={holdScope} onChange={(e) => setHoldScope(e.target.value)} className={selectClass}>
                    <option value="org">Organization</option>
                    <option value="conversation">Conversation</option>
                    <option value="user">User</option>
                  </select>
                </div>
                {holdScope !== "org" && (
                  <div>
                    <label className={labelClass}>{holdScope === "user" ? "User ID" : "Conversation ID"}</label>
                    <input type="text" value={holdTargetId} onChange={(e) => setHoldTargetId(e.target.value)} className={inputClass} placeholder={`Enter ${holdScope} ID`} />
                  </div>
                )}
              </div>
              <button onClick={handleCreateHold} disabled={holdSaving}
                className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
                {holdSaving ? "Creating..." : "Create Hold"}
              </button>
            </div>
          )}

          {legalHolds.length === 0 ? (
            <p className="text-sm text-[#94A3B8] text-center py-6">No legal holds active.</p>
          ) : (
            <div className="space-y-2">
              {legalHolds.map((h) => (
                <div key={h._id} className="flex items-center justify-between p-3 rounded-xl border border-[#E2E8F0]">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#0F172A]">{h.name || "Unnamed Hold"}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        h.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                      }`}>
                        {h.status}
                      </span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Scope: {h.scope}{h.targetId ? ` (${h.targetId})` : ""}
                      {h.createdAt && ` | Created: ${new Date(h.createdAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {h.status === "active" && (
                    <button onClick={() => handleReleaseHold(h._id)}
                      className="text-xs font-medium text-amber-600 hover:text-amber-800 px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors">
                      Release
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* eDiscovery */
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">eDiscovery Search</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <label className={labelClass}>Search Text</label>
                <input type="text" value={edQuery} onChange={(e) => setEdQuery(e.target.value)} className={inputClass} placeholder="Search messages..." />
              </div>
              <div>
                <label className={labelClass}>Sender</label>
                <input type="text" value={edFrom} onChange={(e) => setEdFrom(e.target.value)} className={inputClass} placeholder="Sender name or ID" />
              </div>
              <div>
                <label className={labelClass}>After Date</label>
                <input type="date" value={edAfter} onChange={(e) => setEdAfter(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Before Date</label>
                <input type="date" value={edBefore} onChange={(e) => setEdBefore(e.target.value)} className={inputClass} />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleEdSearch} disabled={edSearching}
                className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
                {edSearching ? "Searching..." : "Search"}
              </button>
              {edResults.length > 0 && (
                <button onClick={handleEdExport} disabled={edExporting}
                  className="border border-[#E2E8F0] text-[#334155] rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#F8FAFC] transition-all disabled:opacity-50">
                  {edExporting ? "Exporting..." : "Export JSON"}
                </button>
              )}
            </div>
          </div>

          {edResults.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                <p className="text-xs font-medium text-[#64748B]">{edResults.length} result{edResults.length !== 1 ? "s" : ""} found</p>
              </div>
              <div className="divide-y divide-[#F1F5F9] max-h-[400px] overflow-y-auto">
                {edResults.map((r: any, i: number) => (
                  <div key={i} className="px-4 py-3 hover:bg-[#F8FAFC] transition-colors">
                    <p className="text-sm text-[#0F172A]">{r.content || r.text || JSON.stringify(r)}</p>
                    <p className="text-xs text-[#94A3B8] mt-1">
                      {r.senderId && `From: ${r.senderName || r.senderId}`}
                      {r.createdAt && ` | ${new Date(r.createdAt).toLocaleString()}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
