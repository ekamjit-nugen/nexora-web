"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { assetApi, Asset, AssetCategory } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  available: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  assigned: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  maintenance: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  retired: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  lost: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  disposed: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]" },
};

const CONDITION_COLORS: Record<string, string> = {
  new: "text-[#10B981]", good: "text-[#3B82F6]", fair: "text-[#F59E0B]", poor: "text-[#EF4444]", damaged: "text-[#991B1B]",
};

type StatusTab = "all" | "available" | "assigned" | "maintenance" | "retired";

export default function AssetsPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

  // Create asset modal
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", categoryId: "", serialNumber: "", model: "", manufacturer: "", purchasePrice: 0, condition: "new", location: "" });

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  const fetchAssets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { page: String(pagination.page), limit: "20" };
      if (statusTab !== "all") params.status = statusTab;
      if (categoryFilter) params.categoryId = categoryFilter;
      if (search) params.search = search;

      const [assetRes, catRes] = await Promise.all([
        assetApi.getAssets(params),
        assetApi.getCategories(),
      ]);

      setAssets((assetRes as any).data || []);
      setPagination(prev => ({ ...prev, total: (assetRes as any).pagination?.total || 0, pages: (assetRes as any).pagination?.pages || 0 }));
      setCategories(Array.isArray(catRes.data) ? catRes.data : []);
    } catch (err) {
      toast.error("Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, [search, statusTab, categoryFilter, pagination.page]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    fetchAssets();
  }, [authLoading, user, fetchAssets]);

  if (authLoading || !user) return null;

  const catMap = new Map(categories.map(c => [c._id, c.name]));

  const handleCreate = async () => {
    if (!form.name || !form.categoryId) { toast.error("Name and category are required"); return; }
    try {
      await assetApi.createAsset(form);
      toast.success("Asset created");
      setShowCreate(false);
      setForm({ name: "", categoryId: "", serialNumber: "", model: "", manufacturer: "", purchasePrice: 0, condition: "new", location: "" });
      fetchAssets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create asset");
    }
  };

  const tabs: { key: StatusTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "available", label: "Available" },
    { key: "assigned", label: "Assigned" },
    { key: "maintenance", label: "Maintenance" },
    { key: "retired", label: "Retired" },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">IT Assets</h1>
            <p className="text-sm text-[#64748B] mt-1">Track and manage company hardware and software</p>
          </div>
          {isAdmin && (
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
              {showCreate ? "Cancel" : "Add Asset"}
            </Button>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">New Asset</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="MacBook Pro 14&quot;" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Category *</label>
                <select value={form.categoryId} onChange={e => setForm({ ...form, categoryId: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value="">Select...</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Serial Number</label>
                <Input value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Model</label>
                <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Manufacturer</label>
                <Input value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })} className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Purchase Price (paise)</label>
                <Input type="number" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: Number(e.target.value) })} className="text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Create Asset</Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex gap-1 bg-white rounded-lg p-1 border border-[#E2E8F0]">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => { setStatusTab(tab.key); setPagination(p => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${statusTab === tab.key ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
                {tab.label}
              </button>
            ))}
          </div>
          <Input placeholder="Search assets..." value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-56 text-sm" />
          <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
          </select>
        </div>

        {/* Asset Table */}
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0]">
          {loading ? (
            <div className="p-12 text-center text-[#94A3B8]">Loading assets...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Asset Tag</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Name</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Category</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Condition</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Serial #</th>
                      <th className="text-left px-4 py-3 font-medium text-[#64748B]">Warranty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map(asset => {
                      const sc = STATUS_COLORS[asset.status] || { bg: "bg-[#F3F4F6]", text: "text-[#374151]" };
                      const warrantyExpired = asset.warrantyEndDate && new Date(asset.warrantyEndDate) < new Date();
                      return (
                        <tr key={asset._id} onClick={() => router.push(`/assets/${asset._id}`)}
                          className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-[#64748B]">{asset.assetTag}</td>
                          <td className="px-4 py-3 font-medium text-[#0F172A]">{asset.name}</td>
                          <td className="px-4 py-3 text-[#64748B]">{catMap.get(asset.categoryId) || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                              {asset.status.toUpperCase()}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-xs font-medium ${CONDITION_COLORS[asset.condition] || ""}`}>
                            {asset.condition}
                          </td>
                          <td className="px-4 py-3 text-[#64748B] text-xs">{asset.serialNumber || "-"}</td>
                          <td className="px-4 py-3">
                            {asset.warrantyEndDate ? (
                              <span className={`text-xs font-medium ${warrantyExpired ? "text-[#EF4444]" : "text-[#10B981]"}`}>
                                {warrantyExpired ? "Expired" : new Date(asset.warrantyEndDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                              </span>
                            ) : <span className="text-xs text-[#94A3B8]">-</span>}
                          </td>
                        </tr>
                      );
                    })}
                    {assets.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-12 text-center text-[#94A3B8]">No assets found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
                  <span className="text-xs text-[#64748B]">Page {pagination.page} of {pagination.pages} ({pagination.total} assets)</span>
                  <div className="flex gap-1">
                    <button onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                      disabled={pagination.page <= 1} className="px-3 py-1 text-xs rounded border border-[#E2E8F0] disabled:opacity-40">Prev</button>
                    <button onClick={() => setPagination(p => ({ ...p, page: Math.min(p.pages, p.page + 1) }))}
                      disabled={pagination.page >= pagination.pages} className="px-3 py-1 text-xs rounded border border-[#E2E8F0] disabled:opacity-40">Next</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
