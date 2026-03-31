"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { hrApi, Employee } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface OrgNode {
  employee: Employee;
  children: OrgNode[];
}

function buildTree(employees: Employee[]): OrgNode[] {
  const map = new Map<string, OrgNode>();
  employees.forEach((e) => {
    map.set(e._id, { employee: e, children: [] });
    if (e.userId) map.set(e.userId, map.get(e._id)!);
  });

  const roots: OrgNode[] = [];
  employees.forEach((e) => {
    const node = map.get(e._id);
    if (!node) return;
    if (!e.reportingManagerId) {
      roots.push(node);
    } else {
      const parent = map.get(e.reportingManagerId);
      if (parent && parent !== node) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  });
  return roots;
}

function getInitials(emp: Employee): string {
  return `${emp.firstName?.charAt(0) || ""}${emp.lastName?.charAt(0) || ""}`.toUpperCase() || "?";
}

function getAvatarColor(id: string): string {
  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-emerald-500", "bg-amber-500",
    "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
  ];
  const idx = id.charCodeAt(0) % colors.length;
  return colors[idx];
}

function OrgCard({
  node,
  depth,
  router,
  searchLower,
}: {
  node: OrgNode;
  depth: number;
  router: ReturnType<typeof useRouter>;
  searchLower: string;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const emp = node.employee;
  const hasChildren = node.children.length > 0;
  const displayName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
  const matchesSearch = !searchLower || displayName.includes(searchLower);

  // If searching and this node or descendant matches, force expand
  const hasMatchingDescendant = useCallback((n: OrgNode): boolean => {
    const name = `${n.employee.firstName} ${n.employee.lastName}`.toLowerCase();
    if (name.includes(searchLower)) return true;
    return n.children.some(hasMatchingDescendant);
  }, [searchLower]);

  const shouldShow = !searchLower || hasMatchingDescendant(node);
  if (!shouldShow) return null;

  return (
    <div className={`${depth > 0 ? "ml-8 border-l-2 border-[#E2E8F0] pl-6" : ""}`}>
      <div
        className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer mb-3 ${matchesSearch && searchLower ? "border-[#2E86C1] bg-[#EBF5FB]" : "border-[#E2E8F0] bg-white hover:border-[#CBD5E1] hover:shadow-sm"}`}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0 ${getAvatarColor(emp._id)}`}>
          {getInitials(emp)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#0F172A] truncate">{emp.firstName} {emp.lastName}</p>
          <p className="text-[11px] text-[#64748B] truncate">{(emp as any).designation?.title || emp.designationId || "—"}</p>
          <p className="text-[10px] text-[#94A3B8] truncate">{(emp as any).department?.name || emp.departmentId || ""}</p>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2 shrink-0">
          {emp.status && (
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${emp.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
              {emp.status}
            </span>
          )}
          {hasChildren && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#94A3B8]">{node.children.length}</span>
              <svg className={`w-4 h-4 text-[#94A3B8] transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="mb-3">
          {node.children.map((child) => (
            <OrgCard key={child.employee._id} node={child} depth={depth + 1} router={router} searchLower={searchLower} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function OrgChartPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [tree, setTree] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    hrApi.getEmployees({ status: "active" })
      .then((res) => {
        const emps = Array.isArray(res.data) ? res.data : [];
        setEmployees(emps);
        setTree(buildTree(emps));
      })
      .catch((err: any) => toast.error(err.message || "Failed to load employees"))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" /></div>;
  }

  const searchLower = search.toLowerCase();

  return (
    <div className="min-h-screen flex bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] flex flex-col min-h-screen">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-5 flex items-center justify-between sticky top-0 z-20">
          <div>
            <h1 className="text-[20px] font-bold text-[#0F172A]">Org Chart</h1>
            <p className="text-[13px] text-[#64748B] mt-0.5">{employees.length} active employees</p>
          </div>
          <div className="w-64">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name..."
              className="h-9 text-sm bg-[#F8FAFC] border-[#E2E8F0]"
            />
          </div>
        </div>

        <div className="flex-1 p-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#2E86C1] border-t-transparent" />
            </div>
          ) : tree.length === 0 ? (
            <div className="text-center py-20">
              <svg className="w-12 h-12 text-[#CBD5E1] mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-[14px] font-semibold text-[#64748B]">No employees found</p>
              <p className="text-[12px] text-[#94A3B8] mt-1">Add employees in the Directory to see the org chart</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-2">
              {tree.map((node) => (
                <OrgCard key={node.employee._id} node={node} depth={0} router={router} searchLower={searchLower} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
