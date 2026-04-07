"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { webhookApi } from "@/lib/api";
import { toast } from "sonner";

interface Webhook {
  _id: string;
  name: string;
  type: "incoming" | "outgoing";
  targetUrl?: string;
  conversationId: string;
  events?: string[];
  secret?: string;
  active: boolean;
  lastTriggered?: string;
  failureCount?: number;
  createdAt?: string;
}

const AVAILABLE_EVENTS = [
  "message.created",
  "message.updated",
  "message.deleted",
  "reaction.added",
  "reaction.removed",
  "member.joined",
  "member.left",
  "conversation.updated",
];

export default function WebhooksPage() {
  const { user } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<"incoming" | "outgoing">("outgoing");
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formConvId, setFormConvId] = useState("");
  const [formEvents, setFormEvents] = useState<string[]>(["message.created"]);
  const [saving, setSaving] = useState(false);

  // Secret visibility
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());

  const userRoles = user?.roles || [];
  const isAdmin = userRoles.some((r) => ["admin", "super_admin", "owner"].includes(r));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webhookApi.getWebhooks();
      setWebhooks(res.data || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleCreate = async () => {
    if (!formName.trim()) { toast.error("Webhook name is required"); return; }
    if (!formConvId.trim()) { toast.error("Conversation ID is required"); return; }
    if (formType === "outgoing" && !formUrl.trim()) { toast.error("Target URL is required"); return; }

    setSaving(true);
    try {
      if (formType === "outgoing") {
        await webhookApi.createOutgoing({
          name: formName,
          conversationId: formConvId,
          targetUrl: formUrl,
          events: formEvents,
        });
      } else {
        await webhookApi.createIncoming({
          name: formName,
          conversationId: formConvId,
        });
      }
      toast.success("Webhook created");
      setShowForm(false);
      setFormName(""); setFormUrl(""); setFormConvId(""); setFormEvents(["message.created"]);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create webhook");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await webhookApi.deleteWebhook(id);
      toast.success("Webhook deleted");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete webhook");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await webhookApi.toggleWebhook(id);
      toast.success("Webhook status updated");
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to toggle webhook");
    }
  };

  const toggleEvent = (event: string) => {
    setFormEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event]
    );
  };

  const toggleSecretVisibility = (id: string) => {
    setVisibleSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success("Secret copied to clipboard");
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
        <h2 className="text-xl font-bold text-[#0F172A]">Webhook Management</h2>
        <p className="text-[13px] text-[#64748B] mt-1">Configure incoming and outgoing webhooks for chat integrations.</p>
      </div>

      {/* Create Button */}
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)}
          className="bg-[#2E86C1] text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all">
          {showForm ? "Cancel" : "Create Webhook"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-[#0F172A]">New Webhook</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Type</label>
              <select value={formType} onChange={(e) => setFormType(e.target.value as "incoming" | "outgoing")} className={selectClass}>
                <option value="outgoing">Outgoing (send events to URL)</option>
                <option value="incoming">Incoming (receive messages from external)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Name</label>
              <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className={inputClass} placeholder="e.g. GitHub Notifications" />
            </div>
            <div>
              <label className={labelClass}>Conversation ID</label>
              <input type="text" value={formConvId} onChange={(e) => setFormConvId(e.target.value)} className={inputClass} placeholder="Target conversation" />
            </div>
            {formType === "outgoing" && (
              <div>
                <label className={labelClass}>Target URL</label>
                <input type="url" value={formUrl} onChange={(e) => setFormUrl(e.target.value)} className={inputClass} placeholder="https://example.com/webhook" />
              </div>
            )}
          </div>

          {formType === "outgoing" && (
            <div>
              <label className={labelClass}>Events</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {AVAILABLE_EVENTS.map((event) => (
                  <label key={event} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                    formEvents.includes(event) ? "border-[#2E86C1] bg-[#EBF5FF] text-[#2E86C1]" : "border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC]"
                  }`}>
                    <input
                      type="checkbox"
                      checked={formEvents.includes(event)}
                      onChange={() => toggleEvent(event)}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      formEvents.includes(event) ? "bg-[#2E86C1] border-[#2E86C1]" : "border-[#CBD5E1]"
                    }`}>
                      {formEvents.includes(event) && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-xs">{event}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleCreate} disabled={saving}
              className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
              {saving ? "Creating..." : "Create Webhook"}
            </button>
          </div>
        </div>
      )}

      {/* Webhooks List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 text-[#94A3B8]">
            <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <p className="text-sm font-medium">No webhooks configured</p>
            <p className="text-xs mt-1">Create a webhook to get started</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((wh) => (
            <div key={wh._id} className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-[#0F172A]">{wh.name}</h4>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      wh.type === "incoming" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {wh.type}
                    </span>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      wh.active ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-500"
                    }`}>
                      {wh.active ? "Active" : "Inactive"}
                    </span>
                    {wh.failureCount != null && wh.failureCount > 0 && (
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                        {wh.failureCount} failure{wh.failureCount !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {wh.targetUrl && (
                    <p className="text-xs text-[#64748B] font-mono truncate mb-1">{wh.targetUrl}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-[#94A3B8] mt-1">
                    {wh.conversationId && <span>Channel: {wh.conversationId}</span>}
                    {wh.lastTriggered && <span>Last triggered: {new Date(wh.lastTriggered).toLocaleString()}</span>}
                    {wh.createdAt && <span>Created: {new Date(wh.createdAt).toLocaleDateString()}</span>}
                  </div>

                  {wh.events && wh.events.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {wh.events.map((ev) => (
                        <span key={ev} className="inline-flex px-2 py-0.5 rounded bg-[#F1F5F9] text-[10px] text-[#64748B] font-mono">
                          {ev}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Secret */}
                  {wh.secret && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-[#64748B]">Secret:</span>
                      <code className="text-xs font-mono text-[#334155] bg-[#F1F5F9] px-2 py-0.5 rounded">
                        {visibleSecrets.has(wh._id) ? wh.secret : "************************************"}
                      </code>
                      <button onClick={() => toggleSecretVisibility(wh._id)} className="text-xs text-[#2E86C1] hover:text-[#2471A3]">
                        {visibleSecrets.has(wh._id) ? "Hide" : "Show"}
                      </button>
                      <button onClick={() => copySecret(wh.secret!)} className="text-xs text-[#2E86C1] hover:text-[#2471A3]">
                        Copy
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <button onClick={() => handleToggle(wh._id)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                      wh.active
                        ? "text-amber-600 border-amber-200 hover:bg-amber-50"
                        : "text-green-600 border-green-200 hover:bg-green-50"
                    }`}>
                    {wh.active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleDelete(wh._id)}
                    className="text-xs font-medium text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
