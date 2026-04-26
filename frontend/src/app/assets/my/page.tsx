"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { assetApi, Asset } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function MyAssetsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !user) return;
    const userId = (user as any)._id || (user as any).userId;
    if (!userId) return;

    (async () => {
      try {
        setLoading(true);
        const res = await assetApi.getEmployeeAssets(userId);
        setAssets(Array.isArray(res.data) ? res.data : []);
      } catch { toast.error("Failed to load your assets"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] mb-2">My Assets</h1>
        <p className="text-sm text-[#64748B] mb-8">Assets currently assigned to you</p>

        {loading ? (
          <div className="text-center py-20 text-[#94A3B8]">Loading...</div>
        ) : assets.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-12 text-center text-[#94A3B8]">No assets assigned to you</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map(asset => (
              <Card key={asset._id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push(`/assets/${asset._id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-10 h-10 rounded-lg bg-[#2E86C1] text-white flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <span className="px-2 py-0.5 bg-[#DBEAFE] text-[#1E40AF] rounded text-[10px] font-bold">{asset.assetTag}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">{asset.name}</h3>
                  <div className="mt-2 space-y-1 text-xs text-[#64748B]">
                    {asset.serialNumber && <p>S/N: {asset.serialNumber}</p>}
                    {asset.model && <p>Model: {asset.model}</p>}
                    <p>Condition: <span className="font-medium text-[#334155]">{asset.condition}</span></p>
                    {asset.assignedAt && <p>Assigned: {new Date(asset.assignedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
