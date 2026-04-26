"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { assetApi, AssetCategory } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AssetCategoriesPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", depreciationMethod: "straight_line", defaultUsefulLifeYears: 3 });

  const isAdmin = hasOrgRole("admin");

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await assetApi.getCategories();
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch { toast.error("Failed to load categories"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!isAdmin) { router.push("/dashboard"); return; }
    fetchCategories();
  }, [authLoading, user]);

  if (authLoading || !user) return null;

  const handleCreate = async () => {
    if (!form.name) { toast.error("Name is required"); return; }
    try {
      await assetApi.createCategory(form);
      toast.success("Category created");
      setShowCreate(false);
      setForm({ name: "", description: "", depreciationMethod: "straight_line", defaultUsefulLifeYears: 3 });
      fetchCategories();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await assetApi.deleteCategory(id);
      toast.success("Category deleted");
      fetchCategories();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Asset Categories</h1>
            <p className="text-sm text-[#64748B] mt-1">Manage asset types and their properties</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-[#2E86C1] text-white text-sm">
            {showCreate ? "Cancel" : "Add Category"}
          </Button>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Name *</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Laptop" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Description</label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Category description" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Depreciation Method</label>
                <select value={form.depreciationMethod} onChange={e => setForm({ ...form, depreciationMethod: e.target.value })} className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg text-sm bg-white">
                  <option value="straight_line">Straight Line</option>
                  <option value="declining_balance">Declining Balance</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748B] mb-1 block">Useful Life (years)</label>
                <Input type="number" value={form.defaultUsefulLifeYears} onChange={e => setForm({ ...form, defaultUsefulLifeYears: Number(e.target.value) })} className="text-sm" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={handleCreate} className="bg-[#2E86C1] text-white text-sm">Create Category</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-[#94A3B8]">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <Card key={cat._id} className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-semibold text-[#0F172A]">{cat.name}</h3>
                      {cat.description && <p className="text-xs text-[#64748B] mt-1">{cat.description}</p>}
                    </div>
                    <button onClick={() => handleDelete(cat._id, cat.name)} className="text-[#94A3B8] hover:text-[#EF4444] text-xs">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                  <div className="mt-3 flex gap-3 text-xs text-[#64748B]">
                    <span>Depreciation: {cat.depreciationMethod?.replace(/_/g, " ")}</span>
                    <span>Life: {cat.defaultUsefulLifeYears}y</span>
                  </div>
                  {cat.customFields?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {cat.customFields.map((f, i) => (
                        <span key={i} className="px-2 py-0.5 bg-[#F1F5F9] text-[#334155] rounded text-[10px]">{f.fieldName} ({f.fieldType})</span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {categories.length === 0 && (
              <div className="col-span-full text-center py-12 text-[#94A3B8] text-sm">No categories yet. Create one to get started.</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
