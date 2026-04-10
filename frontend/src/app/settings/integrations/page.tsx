"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { authApi } from "@/lib/api";
import { toast } from "sonner";

interface Integration {
  id: string;
  slug?: string;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  icon?: string;
  status?: "connected" | "available" | "coming_soon";
  connected?: boolean;
  comingSoon?: boolean;
}

type StatusFilter = "all" | "connected" | "available" | "coming_soon";

const CATEGORY_ORDER = [
  "Communication",
  "Productivity",
  "Development",
  "Project Management",
  "Automation",
  "Payments",
];

const CATEGORY_ICONS: Record<string, string> = {
  Communication:
    "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  Productivity:
    "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  Development:
    "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
  "Project Management":
    "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  Automation:
    "M13 10V3L4 14h7v7l9-11h-7z",
  Payments:
    "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
};

const FALLBACK_EMOJI: Record<string, string> = {
  slack: "💬",
  discord: "💬",
  teams: "💬",
  zoom: "📹",
  "google-meet": "📹",
  notion: "📝",
  "google-drive": "📁",
  dropbox: "📁",
  onedrive: "📁",
  github: "🐙",
  gitlab: "🦊",
  bitbucket: "🪣",
  jira: "📋",
  asana: "📋",
  trello: "📋",
  linear: "📐",
  zapier: "⚡",
  make: "🔧",
  n8n: "🔁",
  stripe: "💳",
  paypal: "💰",
  razorpay: "💳",
};

function normalizeStatus(i: Integration): "connected" | "available" | "coming_soon" {
  if (i.status) return i.status;
  if (i.connected) return "connected";
  if (i.comingSoon) return "coming_soon";
  return "available";
}

function logoFor(i: Integration): string {
  if (i.icon) return i.icon;
  const slug = (i.slug || i.id || i.name || "").toLowerCase();
  return FALLBACK_EMOJI[slug] || "🧩";
}

function categoryIcon(cat: string): string {
  return CATEGORY_ICONS[cat] || CATEGORY_ICONS.Productivity;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [connectModal, setConnectModal] = useState<Integration | null>(null);

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await authApi.listAvailableIntegrations();
      const data = Array.isArray(res) ? res : res?.data || res?.integrations || [];
      setIntegrations(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load integrations");
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const normalized = useMemo(
    () =>
      integrations.map((i) => ({
        ...i,
        _status: normalizeStatus(i),
        _category: i.category || "Productivity",
      })),
    [integrations]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const i of normalized) {
      counts[i._category] = (counts[i._category] || 0) + 1;
    }
    return counts;
  }, [normalized]);

  const categories = useMemo(() => {
    const present = Object.keys(categoryCounts);
    const ordered = CATEGORY_ORDER.filter((c) => present.includes(c));
    const extras = present.filter((c) => !CATEGORY_ORDER.includes(c)).sort();
    return [...ordered, ...extras];
  }, [categoryCounts]);

  const filtered = useMemo(() => {
    return normalized.filter((i) => {
      if (statusFilter !== "all" && i._status !== statusFilter) return false;
      if (categoryFilter && i._category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${i.name} ${i.description || ""} ${i._category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [normalized, statusFilter, categoryFilter, search]);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "connected", label: "Connected" },
    { key: "available", label: "Available" },
    { key: "coming_soon", label: "Coming Soon" },
  ];

  const handleAction = (integration: Integration & { _status: string }) => {
    if (integration._status === "coming_soon") return;
    setConnectModal(integration);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[#0F172A]">Integrations</h2>
          <p className="mt-1 text-sm text-[#64748B]">
            Connect Nexora to the tools your team already uses.
          </p>
        </div>
        <div className="relative w-full md:w-80">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E2E8F0] bg-white text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1]"
          />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 border-b border-[#E2E8F0] overflow-x-auto">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap border-b-2 -mb-px ${
              statusFilter === t.key
                ? "border-[#2E86C1] text-[#2E86C1]"
                : "border-transparent text-[#64748B] hover:text-[#334155]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Category sidebar */}
        <aside className="md:w-56 shrink-0">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3">
            <p className="px-2 mb-2 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Categories
            </p>
            <div className="space-y-0.5">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  categoryFilter === null
                    ? "bg-[#EBF5FF] text-[#2E86C1]"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155]"
                }`}
              >
                <span>All categories</span>
                <span className="text-xs text-[#94A3B8]">{normalized.length}</span>
              </button>
              {categories.map((cat) => {
                const active = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(active ? null : cat)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-[#EBF5FF] text-[#2E86C1]"
                        : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#334155]"
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <svg
                        className="w-4 h-4 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d={categoryIcon(cat)}
                        />
                      </svg>
                      <span className="truncate">{cat}</span>
                    </span>
                    <span className="text-xs text-[#94A3B8] shrink-0">
                      {categoryCounts[cat] || 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-10 text-center text-sm text-[#64748B]">
              Loading integrations...
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-white p-12 text-center">
              <svg
                className="w-10 h-10 mx-auto text-[#CBD5E1] mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <p className="text-sm text-[#64748B]">No integrations match your filters.</p>
              <button
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setCategoryFilter(null);
                }}
                className="mt-3 text-xs text-[#2E86C1] hover:text-[#2874A6] font-medium"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((i) => {
                const status = i._status;
                const isConnected = status === "connected";
                const isComingSoon = status === "coming_soon";
                return (
                  <div
                    key={i.id}
                    className="rounded-xl border border-[#E2E8F0] bg-white p-4 flex flex-col hover:border-[#CBD5E1] hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                          {i.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={i.logoUrl}
                              alt={i.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <span>{logoFor(i)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-[#0F172A] text-sm truncate">
                            {i.name}
                          </h3>
                          <p className="text-xs text-[#94A3B8] truncate">{i._category}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 ${
                          isConnected
                            ? "bg-green-50 text-green-700 border-green-200"
                            : isComingSoon
                              ? "bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {isConnected ? "Connected" : isComingSoon ? "Coming Soon" : "Available"}
                      </span>
                    </div>

                    <p className="text-xs text-[#64748B] leading-relaxed line-clamp-2 mb-4 flex-1">
                      {i.description || "No description provided."}
                    </p>

                    <button
                      onClick={() => handleAction(i)}
                      disabled={isComingSoon}
                      className={`w-full h-9 rounded-lg text-xs font-medium transition-colors ${
                        isConnected
                          ? "bg-[#F1F5F9] text-[#334155] hover:bg-[#E2E8F0]"
                          : isComingSoon
                            ? "bg-[#F8FAFC] text-[#94A3B8] cursor-not-allowed"
                            : "bg-[#2E86C1] text-white hover:bg-[#2874A6]"
                      }`}
                    >
                      {isConnected
                        ? "Configure"
                        : isComingSoon
                          ? "Coming Soon"
                          : "Connect"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      {connectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-2xl">
                {connectModal.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={connectModal.logoUrl}
                    alt={connectModal.name}
                    className="w-full h-full object-contain rounded-lg"
                  />
                ) : (
                  <span>{logoFor(connectModal)}</span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-[#0F172A] truncate">
                  {connectModal.name}
                </h3>
                <p className="text-xs text-[#94A3B8] truncate">
                  {connectModal.category || "Integration"}
                </p>
              </div>
            </div>

            <div className="p-6">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-blue-600 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Connection flow coming soon
                    </p>
                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                      We're wiring up OAuth for this integration. In the meantime,
                      it's listed here as a placeholder — check back soon to start
                      using {connectModal.name} with Nexora.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
              <button
                onClick={() => setConnectModal(null)}
                className="px-4 py-2 text-sm font-medium text-white bg-[#2E86C1] hover:bg-[#2874A6] rounded-lg transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
