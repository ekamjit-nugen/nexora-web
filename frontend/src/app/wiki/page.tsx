"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { wikiSpaceApi, WikiSpace } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function WikiSpacesPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", icon: "📚", color: "#3B82F6", visibility: "public" });

  const isManager = hasOrgRole("manager");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    (async () => {
      try { setLoading(true); const res = await wikiSpaceApi.getAll(); setSpaces(Array.isArray(res.data) ? res.data : []); }
      catch { toast.error("Failed to load spaces"); }
      finally { setLoading(false); }
    })();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const handleCreate = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    try {
      const res = await wikiSpaceApi.create(form);
      toast.success("Space created");
      setShowCreate(false);
      setForm({ name: "", description: "", icon: "📚", color: "#3B82F6", visibility: "public" });
      setSpaces(prev => [...prev, res.data as any]);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Knowledge Base</h1>
            <p className="text-sm text-[#64748B] mt-1">{spaces.length} space{spaces.length !== 1 ? "s" : ""} — your company wiki</p>
          </div>
          {isManager && (
            <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
              {showCreate ? "Cancel" : "New Space"}
            </Button>
          )}
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <h3 className="text-sm font-semibold text-[#0F172A] mb-4">Create Space</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this space is about" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Icon</label>
                <Input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} className="text-sm w-20" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Create Space</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 animate-pulse">
                <div className="h-10 w-10 bg-[#E2E8F0] rounded-lg mb-3" />
                <div className="h-4 bg-[#E2E8F0] rounded w-32 mb-2" />
                <div className="h-3 bg-[#E2E8F0] rounded w-48" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map(space => (
              <div
                key={space._id}
                onClick={() => router.push(`/wiki/${space._id}`)}
                className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 hover:shadow-md hover:border-[#2E86C1] transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl" style={{ backgroundColor: space.color + '15' }}>
                    {space.icon}
                  </div>
                  {space.visibility === "restricted" && (
                    <span className="px-2 py-0.5 bg-[#FEF3C7] text-[#92400E] rounded text-[9px] font-bold">RESTRICTED</span>
                  )}
                </div>
                <h3 className="text-base font-semibold text-[#0F172A] group-hover:text-[#2E86C1] transition-colors">{space.name}</h3>
                {space.description && <p className="text-xs text-[#64748B] mt-1 line-clamp-2">{space.description}</p>}
                <p className="text-[10px] text-[#94A3B8] mt-3">
                  Updated {new Date(space.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                </p>
              </div>
            ))}
            {spaces.length === 0 && (
              <div className="col-span-full text-center py-16 text-[#94A3B8]">
                No spaces yet. {isManager ? "Create your first space to get started." : "Ask a manager to create a space."}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
