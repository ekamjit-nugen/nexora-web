"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { payrollApi, hrApi } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface GoalNode {
  _id: string;
  title: string;
  description?: string;
  type: string;
  category: string;
  status: string;
  priority: string;
  progress: number;
  rolledUpProgress?: number;
  parentGoalId?: string;
  employeeId?: string;
  keyResults?: Array<{ title: string; progress: number; targetValue?: number; currentValue?: number }>;
  weightage?: number;
  startDate?: string;
  targetDate?: string;
  children: GoalNode[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-[#DBEAFE]", text: "text-[#1E40AF]" },
  achieved: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  missed: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  draft: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  cancelled: { bg: "bg-[#F3F4F6]", text: "text-[#6B7280]" },
  deferred: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
};

const TYPE_COLORS: Record<string, string> = {
  company: "#EF4444",
  team: "#F59E0B",
  individual: "#3B82F6",
  okr: "#8B5CF6",
};

const TYPE_LABELS: Record<string, string> = {
  company: "Company", team: "Team", individual: "Individual", okr: "OKR",
};

function ProgressBar({ progress, rolledUp, color }: { progress: number; rolledUp?: number; color: string }) {
  const displayProgress = rolledUp ?? progress;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-[#F1F5F9] rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${displayProgress}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] font-bold text-[#334155] w-8 text-right">{displayProgress}%</span>
    </div>
  );
}

function TreeNode({ node, depth, employeeMap, expanded, toggleExpand }: {
  node: GoalNode; depth: number; employeeMap: Map<string, string>;
  expanded: Set<string>; toggleExpand: (id: string) => void;
}) {
  const hasChildren = node.children?.length > 0;
  const isExpanded = expanded.has(node._id);
  const typeColor = TYPE_COLORS[node.type] || "#94A3B8";
  const sc = STATUS_COLORS[node.status] || STATUS_COLORS.active;
  const ownerName = node.employeeId ? (employeeMap.get(node.employeeId) || "Unknown") : "Organization";
  const displayProgress = node.rolledUpProgress ?? node.progress ?? 0;

  const depthColors = ["border-l-[#EF4444]", "border-l-[#F59E0B]", "border-l-[#3B82F6]", "border-l-[#8B5CF6]", "border-l-[#10B981]"];
  const borderClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div>
      <div
        className={`bg-white rounded-lg border border-[#E2E8F0] border-l-4 ${borderClass} p-4 mb-2 hover:shadow-md transition-shadow`}
        style={{ marginLeft: `${depth * 32}px` }}
      >
        <div className="flex items-start gap-3">
          {/* Expand/Collapse */}
          <button
            onClick={() => hasChildren && toggleExpand(node._id)}
            className={`mt-1 shrink-0 w-5 h-5 rounded flex items-center justify-center ${hasChildren ? "bg-[#F1F5F9] hover:bg-[#E2E8F0] cursor-pointer" : "opacity-0"}`}
          >
            {hasChildren && (
              <svg className={`w-3 h-3 text-[#64748B] transition-transform ${isExpanded ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {/* Type indicator */}
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white text-[9px] font-bold" style={{ backgroundColor: typeColor }}>
            {TYPE_LABELS[node.type]?.charAt(0) || "G"}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-[#0F172A] truncate">{node.title}</h3>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${sc.bg} ${sc.text}`}>{node.status.toUpperCase()}</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{ backgroundColor: typeColor + "15", color: typeColor }}>{TYPE_LABELS[node.type] || node.type}</span>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-[#64748B] mb-2">
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0" /></svg>
                {ownerName}
              </span>
              {node.keyResults && node.keyResults.length > 0 && (
                <span>{node.keyResults.length} key result{node.keyResults.length > 1 ? "s" : ""}</span>
              )}
              {hasChildren && <span className="font-medium text-[#2E86C1]">{node.children.length} sub-goal{node.children.length > 1 ? "s" : ""}</span>}
              {node.rolledUpProgress !== undefined && node.rolledUpProgress !== node.progress && (
                <span className="text-[10px] text-[#94A3B8]">Own: {node.progress}% · Rolled up: {node.rolledUpProgress}%</span>
              )}
            </div>

            <ProgressBar progress={node.progress || 0} rolledUp={node.rolledUpProgress} color={typeColor} />

            {/* Key Results (compact) */}
            {isExpanded && node.keyResults && node.keyResults.length > 0 && (
              <div className="mt-3 pt-2 border-t border-[#F1F5F9] space-y-1.5">
                {node.keyResults.map((kr, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#94A3B8] shrink-0 w-4">KR{i + 1}</span>
                    <span className="text-[11px] text-[#334155] flex-1 truncate">{kr.title}</span>
                    <div className="w-16 bg-[#F1F5F9] rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-[#3B82F6]" style={{ width: `${kr.progress || 0}%` }} />
                    </div>
                    <span className="text-[9px] text-[#64748B] w-6 text-right">{kr.progress || 0}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && node.children.map(child => (
        <TreeNode key={child._id} node={child} depth={depth + 1} employeeMap={employeeMap} expanded={expanded} toggleExpand={toggleExpand} />
      ))}
    </div>
  );
}

export default function OKRAlignmentPage() {
  const { user, loading: authLoading, logout, hasOrgRole } = useAuth();
  const router = useRouter();

  const [tree, setTree] = useState<GoalNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [employeeMap, setEmployeeMap] = useState<Map<string, string>>(new Map());
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Stats
  const [stats, setStats] = useState({ total: 0, company: 0, team: 0, individual: 0, avgProgress: 0, achieved: 0 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [treeRes, empRes] = await Promise.all([
        payrollApi.getOrgGoalTree(),
        hrApi.getEmployees({ limit: "100" }).catch(() => ({ data: [] })),
      ]);

      const goals: GoalNode[] = Array.isArray((treeRes as any).data) ? (treeRes as any).data : [];
      setTree(goals);

      // Build employee map
      const empData = (empRes as any).data;
      const emps = Array.isArray(empData) ? empData : empData?.data || [];
      const map = new Map<string, string>();
      for (const e of emps) {
        map.set(e.userId || e._id, `${e.firstName} ${e.lastName}`);
        map.set(e._id, `${e.firstName} ${e.lastName}`);
      }
      setEmployeeMap(map);

      // Calculate stats
      const flatGoals: GoalNode[] = [];
      const flatten = (nodes: GoalNode[]) => {
        for (const n of nodes) {
          flatGoals.push(n);
          if (n.children) flatten(n.children);
        }
      };
      flatten(goals);

      setStats({
        total: flatGoals.length,
        company: flatGoals.filter(g => g.type === "company").length,
        team: flatGoals.filter(g => g.type === "team").length,
        individual: flatGoals.filter(g => g.type === "individual" || g.type === "okr").length,
        avgProgress: flatGoals.length > 0 ? Math.round(flatGoals.reduce((s, g) => s + (g.progress || 0), 0) / flatGoals.length) : 0,
        achieved: flatGoals.filter(g => g.status === "achieved").length,
      });

      // Auto-expand first 2 levels
      const autoExpand = new Set<string>();
      for (const root of goals) {
        autoExpand.add(root._id);
        for (const child of root.children || []) autoExpand.add(child._id);
      }
      setExpanded(autoExpand);
    } catch { toast.error("Failed to load OKR tree"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (!hasOrgRole("manager")) { router.push("/dashboard"); return; }
    fetchData();
  }, [authLoading, user, fetchData]);

  if (authLoading || !user) return null;

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    const collect = (nodes: GoalNode[]) => {
      for (const n of nodes) { all.add(n._id); if (n.children) collect(n.children); }
    };
    collect(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  // Filter tree
  const filterTree = (nodes: GoalNode[]): GoalNode[] => {
    return nodes.map(node => {
      const filteredChildren = filterTree(node.children || []);
      const matchesType = typeFilter === "all" || node.type === typeFilter;
      const matchesStatus = statusFilter === "all" || node.status === statusFilter;
      const matchesSearch = !search || node.title.toLowerCase().includes(search.toLowerCase());
      const childrenMatch = filteredChildren.length > 0;

      if ((matchesType && matchesStatus && matchesSearch) || childrenMatch) {
        return { ...node, children: filteredChildren };
      }
      return null;
    }).filter(Boolean) as GoalNode[];
  };

  const filteredTree = (typeFilter !== "all" || statusFilter !== "all" || search) ? filterTree(tree) : tree;

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar user={user} onLogout={logout} />
      <main className="md:ml-[260px] p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">OKR Alignment</h1>
            <p className="text-sm text-[#64748B] mt-1">See how every goal connects to company strategy</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={expandAll} className="bg-[#F1F5F9] text-[#334155] text-xs h-8">Expand All</Button>
            <Button onClick={collapseAll} className="bg-[#F1F5F9] text-[#334155] text-xs h-8">Collapse All</Button>
            <Button onClick={() => router.push("/payroll/goals")} className="bg-[#2E86C1] text-white text-xs h-8">Manage Goals</Button>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Total Goals</p>
                <p className="text-xl font-bold text-[#0F172A]">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Company</p>
                <p className="text-xl font-bold text-[#EF4444]">{stats.company}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Team</p>
                <p className="text-xl font-bold text-[#F59E0B]">{stats.team}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Individual</p>
                <p className="text-xl font-bold text-[#3B82F6]">{stats.individual}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Avg Progress</p>
                <p className="text-xl font-bold text-[#0F172A]">{stats.avgProgress}%</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-[#64748B]">Achieved</p>
                <p className="text-xl font-bold text-[#10B981]">{stats.achieved}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Legend + Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-3 text-[10px]">
            {Object.entries(TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="text-[#64748B] capitalize">{type}</span>
              </div>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Input placeholder="Search goals..." value={search} onChange={e => setSearch(e.target.value)} className="w-48 text-xs h-8" />
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-2 py-1 border border-[#E2E8F0] rounded-lg text-xs bg-white">
              <option value="all">All Types</option>
              <option value="company">Company</option>
              <option value="team">Team</option>
              <option value="individual">Individual</option>
              <option value="okr">OKR</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-2 py-1 border border-[#E2E8F0] rounded-lg text-xs bg-white">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="achieved">Achieved</option>
              <option value="missed">Missed</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        {/* Tree */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-[#E2E8F0] p-4 animate-pulse" style={{ marginLeft: `${(i % 3) * 32}px` }}>
                <div className="h-4 bg-[#E2E8F0] rounded w-48 mb-2" />
                <div className="h-2 bg-[#E2E8F0] rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredTree.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[#F1F5F9] flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>
            </div>
            <p className="text-sm font-medium text-[#334155]">No goals found</p>
            <p className="text-xs text-[#94A3B8] mt-1">Create company goals first, then link team and individual goals as sub-goals</p>
            <Button onClick={() => router.push("/payroll/goals")} className="bg-[#2E86C1] text-white text-xs mt-4">Create Goals</Button>
          </div>
        ) : (
          <div>
            {filteredTree.map(node => (
              <TreeNode key={node._id} node={node} depth={0} employeeMap={employeeMap} expanded={expanded} toggleExpand={toggleExpand} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
