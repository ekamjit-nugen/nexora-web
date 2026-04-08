"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { billingApi, projectApi, BillingRate, Project } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

const rateTypeLabels: Record<string, string> = {
  project_default: "Project Default",
  role_based: "Role-Based",
  user_specific: "User-Specific",
};

const rateTypeColors: Record<string, string> = {
  project_default: "bg-blue-50 text-blue-700 border-blue-200",
  role_based: "bg-purple-50 text-purple-700 border-purple-200",
  user_specific: "bg-teal-50 text-teal-700 border-teal-200",
};

export default function BillingRatesPage() {
  const { user } = useAuth();
  const [rates, setRates] = useState<BillingRate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formProjectId, setFormProjectId] = useState("");
  const [formType, setFormType] = useState<string>("project_default");
  const [formRole, setFormRole] = useState("");
  const [formUserId, setFormUserId] = useState("");
  const [formUserName, setFormUserName] = useState("");
  const [formRate, setFormRate] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [formEffectiveTo, setFormEffectiveTo] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState("");
  const [editCurrency, setEditCurrency] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [ratesRes, projectsRes] = await Promise.all([
        billingApi.getRates(selectedProjectId || undefined),
        projectApi.getAll(),
      ]);
      setRates(Array.isArray(ratesRes.data) ? ratesRes.data : []);
      setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : []);
    } catch (err: any) {
      toast.error(err.message || "Failed to load billing rates");
    } finally {
      setLoading(false);
    }
  }, [user, selectedProjectId]);

  useEffect(() => {
    if (user) fetchData();
  }, [fetchData, user]);

  const handleCreate = async () => {
    if (!formProjectId) { toast.error("Select a project"); return; }
    if (!formRate || parseFloat(formRate) < 0) { toast.error("Enter a valid hourly rate"); return; }
    if (formType === "role_based" && !formRole) { toast.error("Enter a role"); return; }
    if (formType === "user_specific" && !formUserId) { toast.error("Enter a user ID"); return; }

    setCreating(true);
    try {
      await billingApi.createRate({
        projectId: formProjectId,
        type: formType,
        role: formType === "role_based" ? formRole : undefined,
        userId: formType === "user_specific" ? formUserId : undefined,
        userName: formType === "user_specific" ? formUserName : undefined,
        hourlyRate: parseFloat(formRate),
        currency: formCurrency,
        effectiveFrom: formEffectiveFrom,
        effectiveTo: formEffectiveTo || undefined,
      });
      toast.success("Billing rate created");
      setShowCreate(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create billing rate");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await billingApi.updateRate(id, {
        hourlyRate: parseFloat(editRate),
        currency: editCurrency,
      });
      toast.success("Billing rate updated");
      setEditingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await billingApi.deleteRate(id);
      toast.success("Billing rate deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const resetForm = () => {
    setFormProjectId("");
    setFormType("project_default");
    setFormRole("");
    setFormUserId("");
    setFormUserName("");
    setFormRate("");
    setFormCurrency("USD");
    setFormEffectiveFrom(new Date().toISOString().split("T")[0]);
    setFormEffectiveTo("");
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
  };

  const getProjectName = (projectId: string) => {
    const p = projects.find(p => p._id === projectId);
    return p ? p.projectName : projectId;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-[#0F172A]">Billing Rates</h2>
          <p className="text-[13px] text-[#64748B] mt-0.5">Configure hourly rates for timesheet-to-invoice generation</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9 gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Add Rate
        </Button>
      </div>

      {/* Filter by project */}
      <div className="flex items-center gap-3">
        <label className="text-[12px] font-semibold text-[#64748B]">Filter by project:</label>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="h-9 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p._id} value={p._id}>{p.projectName}</option>
          ))}
        </select>
      </div>

      {/* Create form */}
      {showCreate && (
        <Card className="border-[#E2E8F0] bg-white">
          <CardContent className="p-5 space-y-4">
            <h3 className="text-[14px] font-semibold text-[#0F172A]">New Billing Rate</h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Project *</label>
                <select
                  value={formProjectId}
                  onChange={(e) => setFormProjectId(e.target.value)}
                  className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p._id} value={p._id}>{p.projectName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Rate Type *</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                >
                  <option value="project_default">Project Default</option>
                  <option value="role_based">Role-Based</option>
                  <option value="user_specific">User-Specific</option>
                </select>
              </div>
            </div>

            {formType === "role_based" && (
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Role *</label>
                <Input
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  placeholder="e.g. Senior Developer, Designer, QA..."
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
            )}

            {formType === "user_specific" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">User ID *</label>
                  <Input
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    placeholder="User ID"
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">User Name</label>
                  <Input
                    value={formUserName}
                    onChange={(e) => setFormUserName(e.target.value)}
                    placeholder="Display name"
                    className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Hourly Rate *</label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formRate}
                  onChange={(e) => setFormRate(e.target.value)}
                  placeholder="0.00"
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Currency</label>
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full h-10 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3 text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#2E86C1]"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                  <option value="INR">INR</option>
                  <option value="CAD">CAD</option>
                  <option value="AUD">AUD</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#475569] mb-1.5 block">Effective From *</label>
                <Input
                  type="date"
                  value={formEffectiveFrom}
                  onChange={(e) => setFormEffectiveFrom(e.target.value)}
                  className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }} className="h-9 border-[#E2E8F0]">Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-[#2E86C1] hover:bg-[#2471A3] h-9">
                {creating ? "Creating..." : "Create Rate"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rates list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
        </div>
      ) : rates.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
          </svg>
          <p className="text-[14px] font-semibold text-[#64748B]">No billing rates configured</p>
          <p className="text-[12px] text-[#94A3B8] mt-1">Add billing rates to enable timesheet-to-invoice generation</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rates.map(rate => (
            <Card key={rate._id} className="border-[#E2E8F0] bg-white">
              <CardContent className="p-4">
                {editingId === rate._id ? (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                      <div className="text-[13px] font-medium text-[#0F172A]">{getProjectName(rate.projectId)}</div>
                      <Input
                        type="number"
                        value={editRate}
                        onChange={(e) => setEditRate(e.target.value)}
                        className="h-9 text-sm"
                        placeholder="Rate"
                      />
                      <select
                        value={editCurrency}
                        onChange={(e) => setEditCurrency(e.target.value)}
                        className="h-9 text-sm bg-[#F8FAFC] border border-[#E2E8F0] rounded-md px-3"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                        <option value="CAD">CAD</option>
                        <option value="AUD">AUD</option>
                      </select>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={() => handleUpdate(rate._id)} className="h-8 bg-emerald-600 hover:bg-emerald-700">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="h-8">Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rateTypeColors[rate.type] || ""}`}>
                        {rateTypeLabels[rate.type] || rate.type}
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-[#0F172A]">{getProjectName(rate.projectId)}</p>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">
                          {rate.type === "role_based" && rate.role ? `Role: ${rate.role}` : ""}
                          {rate.type === "user_specific" ? `User: ${rate.userName || rate.userId}` : ""}
                          {rate.type === "project_default" ? "Applies to all team members" : ""}
                          {" · "}
                          From {new Date(rate.effectiveFrom).toLocaleDateString()}
                          {rate.effectiveTo ? ` to ${new Date(rate.effectiveTo).toLocaleDateString()}` : " (ongoing)"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[16px] font-bold text-[#0F172A]">{formatCurrency(rate.hourlyRate, rate.currency)}</p>
                        <p className="text-[10px] text-[#94A3B8]">per hour</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setEditingId(rate._id); setEditRate(String(rate.hourlyRate)); setEditCurrency(rate.currency); }}
                          className="p-1.5 rounded-md hover:bg-[#F1F5F9] text-[#94A3B8] hover:text-[#475569]"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(rate._id)}
                          className="p-1.5 rounded-md hover:bg-red-50 text-[#94A3B8] hover:text-red-500"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info card */}
      <Card className="border-[#E2E8F0] bg-[#F8FAFC]">
        <CardContent className="p-4">
          <p className="text-[12px] font-semibold text-[#475569] mb-2">How billing rates work</p>
          <ul className="text-[11px] text-[#64748B] space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-[#94A3B8] mt-1.5 flex-shrink-0" />
              <span><strong>User-Specific</strong> rates have the highest priority and override all other rates.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-[#94A3B8] mt-1.5 flex-shrink-0" />
              <span><strong>Role-Based</strong> rates apply to team members with a specific role when no user-specific rate exists.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-[#94A3B8] mt-1.5 flex-shrink-0" />
              <span><strong>Project Default</strong> is the fallback rate for any team member without a specific or role-based rate.</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
