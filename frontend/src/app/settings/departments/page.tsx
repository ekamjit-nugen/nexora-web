"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { hrApi, Department } from "@/lib/api";
import { toast } from "sonner";

const DEFAULT_DEPARTMENTS = [
  { name: "Engineering", code: "ENG", description: "Software development and technical operations" },
  { name: "Design", code: "DESIGN", description: "UI/UX design, branding, and creative assets" },
  { name: "Human Resources", code: "HR", description: "People operations, recruitment, and employee welfare" },
  { name: "Finance", code: "FIN", description: "Accounting, invoices, expenses, and payroll" },
  { name: "Marketing", code: "MKT", description: "Marketing campaigns, brand management, and outreach" },
  { name: "Sales", code: "SALES", description: "Sales, business development, and client relations" },
  { name: "Operations", code: "OPS", description: "General operations and logistics" },
  { name: "Leadership", code: "LEAD", description: "Executive leadership and strategy" },
];

function generateCode(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export default function DepartmentsPage() {
  const { user } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add/Edit form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formParentId, setFormParentId] = useState("");
  const [formCostCenter, setFormCostCenter] = useState("");

  // Delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDepartments = async () => {
    try {
      const res = await hrApi.getDepartments();
      setDepartments(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormName("");
    setFormCode("");
    setFormDescription("");
    setFormParentId("");
    setFormCostCenter("");
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (dept: Department) => {
    setEditingId(dept._id);
    setFormName(dept.name);
    setFormCode(dept.code);
    setFormDescription(dept.description || "");
    setFormParentId(dept.parentDepartmentId || "");
    setFormCostCenter(dept.costCenter || "");
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { toast.error("Department name is required"); return; }
    if (!formCode.trim()) { toast.error("Department code is required"); return; }
    setSaving(true);
    try {
      const data: Partial<Department> = {
        name: formName.trim(),
        code: formCode.trim().toUpperCase(),
        description: formDescription.trim() || undefined,
      };
      if (formParentId) (data as any).parentDepartmentId = formParentId;
      if (formCostCenter) (data as any).costCenter = formCostCenter;

      if (editingId) {
        await hrApi.updateDepartment(editingId, data);
        toast.success("Department updated");
      } else {
        await hrApi.createDepartment(data);
        toast.success("Department created");
      }
      resetForm();
      await fetchDepartments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save department");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await hrApi.deleteDepartment(id);
      toast.success("Department deleted");
      setDeletingId(null);
      await fetchDepartments();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete department");
    }
  };

  const handleSeedDefaults = async () => {
    setSaving(true);
    let created = 0;
    for (const dept of DEFAULT_DEPARTMENTS) {
      const exists = departments.some(d => d.code === dept.code || d.name === dept.name);
      if (!exists) {
        try {
          await hrApi.createDepartment(dept);
          created++;
        } catch { /* skip duplicates */ }
      }
    }
    if (created > 0) {
      toast.success(`${created} default department${created > 1 ? "s" : ""} created`);
      await fetchDepartments();
    } else {
      toast.info("All default departments already exist");
    }
    setSaving(false);
  };

  const inputClass = "w-full rounded-xl border border-[#E2E8F0] px-4 py-2.5 text-sm text-[#0F172A] placeholder-[#94A3B8] focus:ring-2 focus:ring-[#2E86C1]/20 focus:border-[#2E86C1] outline-none transition-all";
  const selectClass = inputClass + " bg-white appearance-none cursor-pointer";
  const labelClass = "block text-sm font-medium text-[#334155] mb-1.5";

  // Build parent options (exclude self if editing)
  const parentOptions = departments.filter(d => d._id !== editingId && d.isActive);

  // Group departments by parent
  const topLevel = departments.filter(d => !d.parentDepartmentId);
  const getChildren = (parentId: string) => departments.filter(d => d.parentDepartmentId === parentId);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <svg className="animate-spin h-8 w-8 text-[#2E86C1]" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#0F172A]">Departments & Teams</h2>
          <p className="text-[13px] text-[#64748B] mt-1">Create and manage your organization&apos;s department structure.</p>
        </div>
        <div className="flex gap-2">
          {departments.length === 0 && (
            <button onClick={handleSeedDefaults} disabled={saving}
              className="px-4 py-2.5 border border-[#E2E8F0] text-[#64748B] rounded-xl text-sm font-medium hover:bg-[#F8FAFC] transition-all disabled:opacity-50">
              Load Defaults
            </button>
          )}
          <button onClick={openAdd}
            className="bg-[#2E86C1] text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Department
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#2E86C1]/20 p-6 shadow-sm ring-1 ring-[#2E86C1]/10">
          <h3 className="text-sm font-semibold text-[#0F172A] mb-4">{editingId ? "Edit Department" : "New Department"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Department Name <span className="text-red-500">*</span></label>
              <input type="text" value={formName} onChange={(e) => { setFormName(e.target.value); if (!editingId) setFormCode(generateCode(e.target.value)); }}
                className={inputClass} placeholder="Engineering" />
            </div>
            <div>
              <label className={labelClass}>Code <span className="text-red-500">*</span></label>
              <input type="text" value={formCode} onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                className={inputClass} placeholder="ENG" maxLength={20} />
            </div>
            <div>
              <label className={labelClass}>Parent Department</label>
              <select value={formParentId} onChange={(e) => setFormParentId(e.target.value)} className={selectClass}>
                <option value="">None (Top-level)</option>
                {parentOptions.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Cost Center Code</label>
              <input type="text" value={formCostCenter} onChange={(e) => setFormCostCenter(e.target.value)}
                className={inputClass} placeholder="CC-001" />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Description</label>
              <input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)}
                className={inputClass} placeholder="Brief description of this department" maxLength={300} />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={resetForm} className="px-4 py-2 text-sm text-[#64748B] hover:text-[#334155]">Cancel</button>
            <button onClick={handleSave} disabled={saving || !formName.trim() || !formCode.trim()}
              className="bg-[#2E86C1] text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-[#2471A3] disabled:opacity-50 transition-all">
              {saving ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </div>
      )}

      {/* Department List */}
      {departments.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E2E8F0] p-12 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">No departments yet</h3>
            <p className="text-sm text-[#64748B] mb-6">Create departments to organize your team structure, or load the default set.</p>
            <button onClick={handleSeedDefaults} disabled={saving}
              className="bg-[#2E86C1] text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-[#2471A3] transition-all disabled:opacity-50">
              {saving ? "Creating..." : "Load Default Departments"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
          <div className="overflow-x-auto -mx-4 sm:mx-0 sm:rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Department</th>
                <th className="text-left px-5 py-3 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Code</th>
                <th className="text-left px-5 py-3 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Parent</th>
                <th className="text-left px-5 py-3 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Cost Center</th>
                <th className="text-right px-5 py-3 font-semibold text-[#64748B] text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {topLevel.map((dept) => {
                const children = getChildren(dept._id);
                return (
                  <DeptRow key={dept._id} dept={dept} level={0} children={children} departments={departments}
                    onEdit={openEdit} onDelete={(id) => setDeletingId(id)} getChildren={getChildren} />
                );
              })}
              {/* Orphaned children (parent deleted) */}
              {departments.filter(d => d.parentDepartmentId && !departments.some(p => p._id === d.parentDepartmentId)).map((dept) => (
                <DeptRow key={dept._id} dept={dept} level={0} children={[]} departments={departments}
                  onEdit={openEdit} onDelete={(id) => setDeletingId(id)} getChildren={getChildren} />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">Delete Department</h3>
            <p className="text-sm text-[#64748B] mb-5">Are you sure? This cannot be undone. Members in this department will need to be reassigned.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeletingId(null)} className="px-4 py-2 text-sm text-[#64748B]">Cancel</button>
              <button onClick={() => handleDelete(deletingId)}
                className="bg-red-500 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-red-600 transition-all">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Recursive department row component
function DeptRow({ dept, level, children, departments, onEdit, onDelete, getChildren }: {
  dept: Department; level: number; children: Department[]; departments: Department[];
  onEdit: (d: Department) => void; onDelete: (id: string) => void;
  getChildren: (id: string) => Department[];
}) {
  const parentName = dept.parentDepartmentId ? departments.find(d => d._id === dept.parentDepartmentId)?.name : "—";
  return (
    <>
      <tr className="hover:bg-[#FAFBFC] transition-colors group">
        <td className="px-5 py-3">
          <div className="flex items-center gap-2" style={{ paddingLeft: level * 24 }}>
            {level > 0 && <span className="text-[#CBD5E1]">└</span>}
            <div className="w-8 h-8 rounded-lg bg-[#2E86C1]/10 flex items-center justify-center text-xs font-bold text-[#2E86C1] flex-shrink-0">
              {dept.name.charAt(0)}
            </div>
            <div>
              <p className="font-medium text-[#0F172A]">{dept.name}</p>
              {dept.description && <p className="text-xs text-[#94A3B8] mt-0.5">{dept.description}</p>}
            </div>
          </div>
        </td>
        <td className="px-5 py-3 font-mono text-[#64748B] text-xs">{dept.code}</td>
        <td className="px-5 py-3 text-[#64748B]">{parentName}</td>
        <td className="px-5 py-3 text-[#64748B]">{dept.costCenter || "—"}</td>
        <td className="px-5 py-3 text-right">
          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(dept)} className="p-1.5 rounded-lg hover:bg-[#EBF5FB] text-[#94A3B8] hover:text-[#2E86C1] transition-colors" title="Edit">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button onClick={() => onDelete(dept._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-[#94A3B8] hover:text-red-500 transition-colors" title="Delete">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </td>
      </tr>
      {children.map((child) => (
        <DeptRow key={child._id} dept={child} level={level + 1} children={getChildren(child._id)} departments={departments}
          onEdit={onEdit} onDelete={onDelete} getChildren={getChildren} />
      ))}
    </>
  );
}
