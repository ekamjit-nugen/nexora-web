"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { hrApi, Department, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { ConfirmModal } from "@/components/confirm-modal";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { RouteGuard } from "@/components/route-guard";

// ── Department Form Modal ──

interface DepartmentFormData {
  name: string;
  code: string;
  description: string;
  headId: string;
  parentDepartmentId: string;
  costCenter: string;
}

const emptyForm: DepartmentFormData = {
  name: "",
  code: "",
  description: "",
  headId: "",
  parentDepartmentId: "",
  costCenter: "",
};

function DepartmentFormModal({
  open,
  onClose,
  onSaved,
  department,
  departments,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  department: Department | null;
  departments: Department[];
  employees: Employee[];
}) {
  const isEdit = !!department;
  const [form, setForm] = useState<DepartmentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (department) {
      setForm({
        name: department.name || "",
        code: department.code || "",
        description: department.description || "",
        headId: department.headId || "",
        parentDepartmentId: department.parentDepartmentId || "",
        costCenter: department.costCenter || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [department, open]);

  if (!open) return null;

  const handleChange = (field: keyof DepartmentFormData, value: string) => {
    if (field === "code") {
      setForm((prev) => ({ ...prev, [field]: value.toUpperCase() }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
      };

      if (form.description.trim()) payload.description = form.description.trim();
      if (form.headId) payload.headId = form.headId;
      if (form.parentDepartmentId) payload.parentDepartmentId = form.parentDepartmentId;
      if (form.costCenter.trim()) payload.costCenter = form.costCenter.trim();

      if (isEdit) {
        await hrApi.updateDepartment(department._id, payload as Partial<Department>);
        toast.success("Department updated successfully");
      } else {
        await hrApi.createDepartment(payload as Partial<Department>);
        toast.success("Department created successfully");
      }

      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save department";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // Filter out current department from parent options to prevent self-reference
  const parentOptions = departments.filter((d) => !department || d._id !== department._id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#F1F5F9]">
          <div>
            <h2 className="text-xl font-bold text-[#0F172A]">
              {isEdit ? "Edit Department" : "Add Department"}
            </h2>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              {isEdit ? "Update department information" : "Create a new department in your organization"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#F1F5F9] transition-colors text-[#94A3B8]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name & Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Engineering"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
                required
              />
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">
                Code <span className="text-red-500">*</span>
              </Label>
              <Input
                value={form.code}
                onChange={(e) => handleChange("code", e.target.value)}
                placeholder="ENG"
                className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg uppercase"
                required
              />
              <p className="text-[11px] text-[#94A3B8] mt-1">Unique short code, auto-uppercased</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Department description..."
              className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
            />
          </div>

          {/* Head & Parent Department */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Department Head</Label>
              <select
                value={form.headId}
                onChange={(e) => handleChange("headId", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">Select head</option>
                {employees.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Parent Department</Label>
              <select
                value={form.parentDepartmentId}
                onChange={(e) => handleChange("parentDepartmentId", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] text-sm text-[#334155]"
              >
                <option value="">None (top-level)</option>
                {parentOptions.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cost Center */}
          <div>
            <Label className="text-[12px] font-medium text-[#475569] mb-1.5 block">Cost Center</Label>
            <Input
              value={form.costCenter}
              onChange={(e) => handleChange("costCenter", e.target.value)}
              placeholder="CC-1001"
              className="h-10 text-sm bg-[#F8FAFC] border-[#E2E8F0] rounded-lg"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-white text-[#475569] border border-[#E2E8F0] hover:bg-[#F8FAFC]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white disabled:opacity-50"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Add Department"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Departments Page ──

export default function DepartmentsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [confirmState, setConfirmState] = useState<{open: boolean; title: string; message: string; variant?: "danger" | "warning" | "info"; confirmLabel?: string; action: () => void}>({open: false, title: "", message: "", action: () => {}});

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [deptRes, empRes] = await Promise.all([
        hrApi.getDepartments(),
        hrApi.getEmployees(),
      ]);
      setDepartments(deptRes.data || []);
      setEmployees(empRes.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load data";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchData();
  }, [user, fetchData]);

  const openAddModal = () => {
    setEditingDepartment(null);
    setModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDepartment(dept);
    setModalOpen(true);
  };

  const handleDelete = (dept: Department) => {
    const empCount = employees.filter((e) => e.departmentId === dept._id).length;
    if (empCount > 0) {
      toast.error(`Cannot delete department with ${empCount} active employee${empCount > 1 ? "s" : ""}. Reassign them first.`);
      return;
    }
    setConfirmState({
      open: true,
      title: "Delete Department",
      message: `Are you sure you want to delete the "${dept.name}" department?`,
      variant: "danger",
      confirmLabel: "Delete",
      action: async () => {
        setConfirmState(s => ({...s, open: false}));
        try {
          await hrApi.deleteDepartment(dept._id);
          toast.success("Department deleted successfully");
          fetchData();
        } catch (err) {
          const message = err instanceof Error ? err.message : "Failed to delete department";
          toast.error(message);
        }
      },
    });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const canManage = user.roles?.some((r) => ["admin", "super_admin", "hr"].includes(r));

  if (!canManage) {
    return (
      <div className="min-h-screen flex bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="flex-1 ml-[260px] p-8">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="border-0 shadow-sm max-w-md w-full">
              <CardContent className="flex flex-col items-center justify-center py-16 px-8">
                <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-lg font-bold text-[#0F172A] mb-2">Access Denied</h2>
                <p className="text-[13px] text-[#64748B] text-center mb-6">
                  You don&apos;t have permission to view this page. Contact your administrator.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center h-10 px-5 rounded-xl text-sm font-medium bg-[#2E86C1] hover:bg-[#2471A3] text-white transition-colors"
                >
                  Go to Dashboard
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  // Helpers
  const getEmployeeCount = (deptId: string) => employees.filter((e) => e.departmentId === deptId).length;
  const getHeadName = (headId?: string) => {
    if (!headId) return null;
    const emp = employees.find((e) => e._id === headId);
    return emp ? `${emp.firstName} ${emp.lastName}` : null;
  };
  const getParentName = (parentId?: string) => {
    if (!parentId) return null;
    const dept = departments.find((d) => d._id === parentId);
    return dept ? dept.name : null;
  };

  const totalEmployees = employees.length;

  return (
    <RouteGuard minOrgRole="admin">
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />

      <main className="flex-1 ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#0F172A]">Departments</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">
              Manage your organization&apos;s department structure
            </p>
          </div>
          <Button
            onClick={openAddModal}
            className="h-10 bg-[#2E86C1] hover:bg-[#2471A3] text-white font-medium px-4 rounded-xl text-[13px]"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Department
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total Departments", value: departments.length, icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4", color: "text-blue-600 bg-blue-50" },
            { label: "Total Employees", value: totalEmployees, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", color: "text-emerald-600 bg-emerald-50" },
            { label: "With Head", value: departments.filter((d) => d.headId).length, icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z", color: "text-violet-600 bg-violet-50" },
            { label: "Top-level", value: departments.filter((d) => !d.parentDepartmentId).length, icon: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z", color: "text-amber-600 bg-amber-50" },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#64748B]">{stat.label}</p>
                  <p className="text-lg font-bold text-[#0F172A] mt-0.5">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                  </svg>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Department Cards */}
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : departments.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-full bg-[#F1F5F9] flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#334155]">No departments found</p>
              <p className="text-[13px] text-[#94A3B8] mt-1">Create your first department to get started</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => {
              const empCount = getEmployeeCount(dept._id);
              const headName = getHeadName(dept.headId);
              const parentName = getParentName(dept.parentDepartmentId);

              return (
                <Card key={dept._id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-[13px]">
                          {dept.code.substring(0, 2)}
                        </div>
                        <div>
                          <p className="text-[13px] font-semibold text-[#0F172A]">{dept.name}</p>
                          <p className="text-[10px] text-[#94A3B8] font-mono">{dept.code}</p>
                        </div>
                      </div>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                        {dept.code}
                      </span>
                    </div>

                    {dept.description && (
                      <p className="text-[12px] text-[#64748B] mb-3 line-clamp-2">
                        {dept.description}
                      </p>
                    )}
                    {!dept.description && (
                      <p className="text-[12px] text-[#94A3B8] mb-3 italic">No description</p>
                    )}

                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-1 text-[12px]">
                        <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="text-[#94A3B8]">Head:</span>
                        <span className="text-[#334155] font-medium">{headName || "\u2014"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[12px]">
                        <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[#334155] font-medium">{empCount}</span>
                        <span className="text-[#94A3B8]">employee{empCount !== 1 ? "s" : ""}</span>
                      </div>
                      {parentName && (
                        <div className="flex items-center gap-1 text-[12px]">
                          <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="text-[#94A3B8]">Parent:</span>
                          <span className="text-[#334155] font-medium">{parentName}</span>
                        </div>
                      )}
                      {dept.costCenter && (
                        <div className="flex items-center gap-1 text-[12px]">
                          <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                          </svg>
                          <span className="text-[#94A3B8]">Cost Center:</span>
                          <span className="text-[#334155] font-medium">{dept.costCenter}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2.5 border-t border-[#F1F5F9]">
                      <button
                        onClick={() => openEditModal(dept)}
                        className="flex-1 text-center py-1.5 text-[12px] font-medium text-[#2E86C1] hover:bg-[#EBF5FF] rounded-lg transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(dept)}
                        className="flex-1 text-center py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Department Form Modal */}
      <DepartmentFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingDepartment(null);
        }}
        onSaved={fetchData}
        department={editingDepartment}
        departments={departments}
        employees={employees}
      />

      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        variant={confirmState.variant}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(s => ({...s, open: false}))}
      />
    </div>
    </RouteGuard>
  );
}
