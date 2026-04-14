"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { assetApi, Asset, AssetAssignment } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AssetDetailPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const params = useParams();
  const assetId = params.id as string;

  const [asset, setAsset] = useState<Asset | null>(null);
  const [history, setHistory] = useState<AssetAssignment[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"details" | "history" | "maintenance">("details");

  // Assign modal
  const [showAssign, setShowAssign] = useState(false);
  const [assigneeId, setAssigneeId] = useState("");

  const isAdmin = hasOrgRole("admin") || hasOrgRole("hr");

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      try {
        setLoading(true);
        const [assetRes, historyRes, maintRes] = await Promise.all([
          assetApi.getAsset(assetId),
          assetApi.getAssetHistory(assetId),
          assetApi.getAssetMaintenance(assetId),
        ]);
        setAsset(assetRes.data as any);
        setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
        setMaintenance(Array.isArray(maintRes.data) ? maintRes.data : []);
      } catch { toast.error("Failed to load asset"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user, assetId]);

  if (authLoading || !user) return null;
  if (loading) return <div className="min-h-screen bg-[#F8FAFC]"><Sidebar user={user} onLogout={logout} /><main className="ml-[260px] p-8"><div className="text-center py-20 text-[#94A3B8]">Loading...</div></main></div>;
  if (!asset) return <div className="min-h-screen bg-[#F8FAFC]"><Sidebar user={user} onLogout={logout} /><main className="ml-[260px] p-8"><div className="text-center py-20 text-[#94A3B8]">Asset not found</div></main></div>;

  const handleAssign = async () => {
    if (!assigneeId) { toast.error("Enter an employee ID"); return; }
    try {
      await assetApi.assignAsset({ assetId: asset._id, assigneeId });
      toast.success("Asset assigned");
      setShowAssign(false); setAssigneeId("");
      const res = await assetApi.getAsset(assetId);
      setAsset(res.data as any);
      const hRes = await assetApi.getAssetHistory(assetId);
      setHistory(Array.isArray(hRes.data) ? hRes.data : []);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleUnassign = async () => {
    try {
      await assetApi.unassignAsset({ assetId: asset._id });
      toast.success("Asset unassigned");
      const res = await assetApi.getAsset(assetId);
      setAsset(res.data as any);
      const hRes = await assetApi.getAssetHistory(assetId);
      setHistory(Array.isArray(hRes.data) ? hRes.data : []);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const statusColors: Record<string, string> = { available: "bg-[#D1FAE5] text-[#065F46]", assigned: "bg-[#DBEAFE] text-[#1E40AF]", maintenance: "bg-[#FEF3C7] text-[#92400E]", retired: "bg-[#F3F4F6] text-[#374151]" };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button onClick={() => router.push("/assets")} className="text-xs text-[#64748B] hover:text-[#2E86C1] mb-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back to Assets
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#0F172A]">{asset.name}</h1>
              <span className="font-mono text-sm text-[#64748B]">{asset.assetTag}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColors[asset.status] || "bg-[#F3F4F6] text-[#374151]"}`}>{asset.status.toUpperCase()}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              {asset.status === "available" && <Button onClick={() => setShowAssign(!showAssign)} className="bg-[#2E86C1] text-white text-sm">Assign</Button>}
              {asset.status === "assigned" && <Button onClick={handleUnassign} className="bg-[#F59E0B] text-white text-sm">Unassign</Button>}
            </div>
          )}
        </div>

        {/* Assign modal */}
        {showAssign && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-4 mb-6 flex items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-[#64748B] mb-1 block">Employee / User ID</label>
              <Input value={assigneeId} onChange={e => setAssigneeId(e.target.value)} placeholder="Enter employee userId" className="text-sm" />
            </div>
            <Button onClick={handleAssign} className="bg-[#10B981] text-white text-sm">Confirm Assign</Button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg p-1 border border-[#E2E8F0] w-fit">
          {(["details", "history", "maintenance"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? "bg-[#2E86C1] text-white" : "text-[#64748B] hover:bg-[#F1F5F9]"}`}>
              {tab} {tab === "history" ? `(${history.length})` : tab === "maintenance" ? `(${maintenance.length})` : ""}
            </button>
          ))}
        </div>

        {activeTab === "details" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">General Information</h3>
              <div className="space-y-3 text-sm">
                {[["Serial Number", asset.serialNumber], ["Model", asset.model], ["Manufacturer", asset.manufacturer], ["Condition", asset.condition], ["Location", asset.location], ["Vendor", asset.vendor]].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between"><span className="text-[#64748B]">{label}</span><span className="font-medium text-[#0F172A]">{val || "-"}</span></div>
                ))}
                {asset.tags?.length > 0 && (
                  <div className="flex justify-between items-start"><span className="text-[#64748B]">Tags</span><div className="flex flex-wrap gap-1">{asset.tags.map(t => <span key={t} className="px-2 py-0.5 bg-[#F1F5F9] text-[#334155] rounded text-[11px]">{t}</span>)}</div></div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
              <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Financial & Warranty</h3>
              <div className="space-y-3 text-sm">
                {[
                  ["Purchase Date", asset.purchaseDate ? new Date(asset.purchaseDate).toLocaleDateString("en-IN") : "-"],
                  ["Purchase Price", asset.purchasePrice ? `₹${(asset.purchasePrice / 100).toLocaleString()}` : "-"],
                  ["Book Value", asset.currentBookValue ? `₹${(asset.currentBookValue / 100).toLocaleString()}` : "-"],
                  ["Useful Life", `${asset.usefulLifeYears} years`],
                  ["Warranty Until", asset.warrantyEndDate ? new Date(asset.warrantyEndDate).toLocaleDateString("en-IN") : "-"],
                  ["Warranty Provider", asset.warrantyProvider || "-"],
                  ["Assigned To", asset.currentAssigneeId || "Unassigned"],
                  ["Assigned At", asset.assignedAt ? new Date(asset.assignedAt).toLocaleDateString("en-IN") : "-"],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex justify-between"><span className="text-[#64748B]">{label}</span><span className="font-medium text-[#0F172A]">{val}</span></div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Assignment History</h3>
            {history.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-8 text-center">No assignment history</p>
            ) : (
              <div className="space-y-3">
                {history.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 ${h.action === "assigned" ? "bg-[#10B981]" : h.action === "transferred" ? "bg-[#3B82F6]" : "bg-[#F59E0B]"}`}>
                      {h.action === "assigned" ? "A" : h.action === "transferred" ? "T" : "U"}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0F172A] capitalize">{h.action}</p>
                      <p className="text-xs text-[#64748B]">
                        {h.action === "transferred" ? `From ${h.previousAssigneeId} to ${h.assigneeId}` : `Employee: ${h.assigneeId}`}
                        {h.notes && ` — ${h.notes}`}
                      </p>
                    </div>
                    <span className="text-[10px] text-[#94A3B8] shrink-0">{new Date(h.assignedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Maintenance Logs</h3>
            {maintenance.length === 0 ? (
              <p className="text-sm text-[#94A3B8] py-8 text-center">No maintenance records</p>
            ) : (
              <div className="space-y-3">
                {maintenance.map((m, i) => (
                  <div key={i} className="py-2 border-b border-[#F1F5F9] last:border-0">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium text-[#0F172A] capitalize">{m.type?.replace(/_/g, " ")}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${m.status === "completed" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#FEF3C7] text-[#92400E]"}`}>{m.status}</span>
                    </div>
                    <p className="text-xs text-[#64748B] mt-1">{m.description}</p>
                    {m.cost > 0 && <p className="text-xs text-[#64748B]">Cost: ₹{(m.cost / 100).toLocaleString()}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
