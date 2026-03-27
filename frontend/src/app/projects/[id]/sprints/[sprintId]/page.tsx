"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { sprintApi, taskApi, projectApi, boardApi, meetingApi, Sprint, Task, Project, Board, Meeting } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ── Constants ──

const priorityColors: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-blue-100 text-blue-700",
  low: "bg-gray-100 text-gray-600",
  trivial: "bg-[#F8FAFC] text-gray-500",
};

const typeIcons: Record<string, { icon: string; color: string }> = {
  epic: { icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-purple-500" },
  story: { icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", color: "text-green-500" },
  task: { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4", color: "text-blue-500" },
  bug: { icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z", color: "text-red-500" },
  sub_task: { icon: "M4 6h16M4 12h8m-8 6h16", color: "text-gray-500" },
  improvement: { icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "text-teal-500" },
  spike: { icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z", color: "text-yellow-500" },
};

const statusOrder: Array<{ key: Task["status"]; label: string; dotColor: string }> = [
  { key: "in_progress", label: "In Progress", dotColor: "bg-amber-500" },
  { key: "todo", label: "To Do", dotColor: "bg-[#94A3B8]" },
  { key: "in_review", label: "In Review", dotColor: "bg-violet-500" },
  { key: "blocked", label: "Blocked", dotColor: "bg-red-500" },
  { key: "backlog", label: "Backlog", dotColor: "bg-[#CBD5E1]" },
  { key: "done", label: "Done", dotColor: "bg-emerald-500" },
];

const sprintStatusConfig: Record<string, { label: string; color: string; dot: string }> = {
  planning: { label: "Planning", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  active: { label: "Active", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  completed: { label: "Completed", color: "bg-gray-100 text-gray-600 border-gray-200", dot: "bg-gray-400" },
};

// ── Burndown Chart ──

function BurndownChart({
  sprint,
  tasks,
}: {
  sprint: Sprint;
  tasks: Task[];
}) {
  if (!sprint.startDate || !sprint.endDate) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-[#94A3B8]">
        No date range set for this sprint
      </div>
    );
  }

  const startDate = new Date(sprint.startDate);
  const endDate = new Date(sprint.endDate);
  const now = new Date();
  const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000));
  const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);

  if (totalPoints === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] text-sm text-[#94A3B8]">
        No story points to chart
      </div>
    );
  }

  // Build ideal line points
  const chartW = 560;
  const chartH = 180;
  const padL = 40;
  const padR = 20;
  const padT = 10;
  const padB = 30;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const idealPoints: string[] = [];
  for (let d = 0; d <= totalDays; d++) {
    const x = padL + (d / totalDays) * plotW;
    const remaining = totalPoints - (totalPoints / totalDays) * d;
    const y = padT + ((totalPoints - remaining) / totalPoints) * plotH;
    // Invert: top = totalPoints, bottom = 0
    const yPos = padT + (1 - remaining / totalPoints) * plotH;
    idealPoints.push(`${x},${yPos}`);
  }

  // Build actual line: estimate remaining points per day based on task completion dates
  // For simplicity, show current remaining as endpoint
  const donePoints = tasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);
  const currentRemaining = totalPoints - donePoints;
  const elapsedDays = Math.min(totalDays, Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / 86400000)));

  const actualPoints: string[] = [];
  // Start at full points
  actualPoints.push(`${padL},${padT}`);
  // If sprint is active or completed, draw to current day
  if (sprint.status === "completed") {
    // Draw line to end at done points
    const xEnd = padL + plotW;
    const yEnd = padT + (1 - (totalPoints - donePoints) / totalPoints) * plotH;
    actualPoints.push(`${xEnd},${yEnd}`);
  } else {
    // Draw to current day
    const xNow = padL + (elapsedDays / totalDays) * plotW;
    const yNow = padT + (1 - currentRemaining / totalPoints) * plotH;
    actualPoints.push(`${xNow},${yNow}`);
  }

  // X-axis labels (show ~5 evenly spaced)
  const xLabels: Array<{ x: number; label: string }> = [];
  const labelCount = Math.min(5, totalDays + 1);
  for (let i = 0; i < labelCount; i++) {
    const dayIdx = Math.round((i / (labelCount - 1)) * totalDays);
    const date = new Date(startDate.getTime() + dayIdx * 86400000);
    xLabels.push({
      x: padL + (dayIdx / totalDays) * plotW,
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    });
  }

  // Y-axis labels
  const yLabels: Array<{ y: number; label: string }> = [];
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const val = Math.round((totalPoints / ySteps) * (ySteps - i));
    yLabels.push({
      y: padT + (i / ySteps) * plotH,
      label: String(val),
    });
  }

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-[200px]" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yLabels.map((yl, i) => (
        <g key={i}>
          <line x1={padL} y1={yl.y} x2={chartW - padR} y2={yl.y} stroke="#F1F5F9" strokeWidth={1} />
          <text x={padL - 6} y={yl.y + 3} textAnchor="end" className="text-[9px] fill-[#94A3B8]">{yl.label}</text>
        </g>
      ))}

      {/* X-axis labels */}
      {xLabels.map((xl, i) => (
        <text key={i} x={xl.x} y={chartH - 6} textAnchor="middle" className="text-[8px] fill-[#94A3B8]">{xl.label}</text>
      ))}

      {/* Ideal line (dashed) */}
      <polyline
        points={idealPoints.join(" ")}
        fill="none"
        stroke="#CBD5E1"
        strokeWidth={1.5}
        strokeDasharray="6 3"
      />

      {/* Actual line (solid) */}
      <polyline
        points={actualPoints.join(" ")}
        fill="none"
        stroke="#2E86C1"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current point indicator */}
      {sprint.status === "active" && actualPoints.length > 1 && (() => {
        const lastPt = actualPoints[actualPoints.length - 1].split(",");
        return (
          <circle cx={parseFloat(lastPt[0])} cy={parseFloat(lastPt[1])} r={4} fill="#2E86C1" stroke="white" strokeWidth={2} />
        );
      })()}

      {/* Legend */}
      <line x1={padL} y1={chartH - 18} x2={padL + 20} y2={chartH - 18} stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 2" />
      <text x={padL + 24} y={chartH - 15} className="text-[8px] fill-[#94A3B8]">Ideal</text>
      <line x1={padL + 60} y1={chartH - 18} x2={padL + 80} y2={chartH - 18} stroke="#2E86C1" strokeWidth={2} />
      <text x={padL + 84} y={chartH - 15} className="text-[8px] fill-[#2E86C1]">Actual</text>
    </svg>
  );
}

// ── Velocity Section ──

function VelocitySection({
  sprints,
  currentSprint,
  tasks,
}: {
  sprints: Sprint[];
  currentSprint: Sprint;
  tasks: Task[];
}) {
  const completedSprints = sprints
    .filter((s) => s.status === "completed")
    .sort((a, b) => new Date(b.updatedAt || b.endDate || 0).getTime() - new Date(a.updatedAt || a.endDate || 0).getTime())
    .slice(0, 5);

  const velocities = completedSprints.map((s) => s.velocity || 0);
  const avgVelocity = velocities.length > 0 ? Math.round(velocities.reduce((a, b) => a + b, 0) / velocities.length) : 0;
  const maxVel = Math.max(...velocities, 1);

  // Current sprint velocity (done points)
  const currentVelocity = tasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);

  // Trend
  const prevVelocity = velocities.length > 0 ? velocities[0] : 0;
  const trendPct = prevVelocity > 0 ? Math.round(((currentVelocity - prevVelocity) / prevVelocity) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Current vs Average */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-[#2E86C1]">{currentVelocity}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Current Sprint</p>
        </div>
        <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-[#0F172A]">{avgVelocity}</p>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Average Velocity</p>
        </div>
        <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <p className={`text-2xl font-bold ${trendPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {trendPct >= 0 ? "+" : ""}{trendPct}%
            </p>
            <svg className={`w-4 h-4 ${trendPct >= 0 ? "text-emerald-600" : "text-red-600 rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </div>
          <p className="text-[10px] text-[#94A3B8] mt-0.5">Trend</p>
        </div>
      </div>

      {/* Velocity chart */}
      {completedSprints.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-[#334155] mb-2">Last {completedSprints.length} Sprints</p>
          <div className="flex items-end gap-2 h-16">
            {[...velocities].reverse().map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-bold text-[#334155]">{v}</span>
                <div
                  className="w-full rounded-md bg-gradient-to-t from-[#2E86C1] to-[#5DADE2]"
                  style={{ height: `${Math.max(6, (v / maxVel) * 56)}px` }}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1">
            {completedSprints.slice(0, 5).reverse().map((s, i) => (
              <span key={i} className="flex-1 text-[8px] text-[#94A3B8] text-center truncate">{s.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Cumulative Flow Diagram (Kanban) ──

function CumulativeFlowDiagram({ tasks }: { tasks: Task[] }) {
  const statusGroups = [
    { key: "done", label: "Done", color: "#10B981" },
    { key: "in_review", label: "Review", color: "#8B5CF6" },
    { key: "in_progress", label: "In Progress", color: "#F59E0B" },
    { key: "todo", label: "To Do", color: "#94A3B8" },
    { key: "backlog", label: "Backlog", color: "#CBD5E1" },
  ];

  const counts = statusGroups.map((sg) => ({
    ...sg,
    count: tasks.filter((t) => t.status === sg.key).length,
  }));

  const total = Math.max(tasks.length, 1);

  return (
    <div className="space-y-2">
      {counts.map((c) => (
        <div key={c.key} className="flex items-center gap-2">
          <span className="text-[10px] text-[#64748B] w-20 text-right">{c.label}</span>
          <div className="flex-1 h-5 bg-[#F1F5F9] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(c.count / total) * 100}%`, backgroundColor: c.color }}
            />
          </div>
          <span className="text-[10px] font-semibold text-[#334155] w-8">{c.count}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──

export default function SprintDetailPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;
  const sprintId = params.sprintId as string;

  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allSprints, setAllSprints] = useState<Sprint[]>([]);
  const [backlogTasks, setBacklogTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalText, setGoalText] = useState("");
  const [showAddTasks, setShowAddTasks] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "retro" | "poker" | "meetings">("overview");

  // ── Retrospective State ──
  const [retroItems, setRetroItems] = useState<Array<{
    id: string;
    category: 'start' | 'stop' | 'continue';
    text: string;
    votes: number;
    votedBy: string[];
    author: string;
    createdAt: string;
  }>>([]);
  const [retroActionItems, setRetroActionItems] = useState<Array<{
    id: string;
    text: string;
    assignee: string;
    done: boolean;
  }>>([]);
  const [newRetroText, setNewRetroText] = useState<Record<string, string>>({ start: "", stop: "", continue: "" });
  const [newActionText, setNewActionText] = useState("");
  const [newActionAssignee, setNewActionAssignee] = useState("");

  // ── Planning Poker State ──
  const [pokerActive, setPokerActive] = useState(false);
  const [pokerTask, setPokerTask] = useState<Task | null>(null);
  const [pokerCards] = useState<number[]>([0, 1, 2, 3, 5, 8, 13, 21, -1]);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [pokerRevealed, setPokerRevealed] = useState(false);
  const [pokerVotes, setPokerVotes] = useState<Array<{userId: string; name: string; vote: number | null}>>([]);
  const [pokerHistory, setPokerHistory] = useState<Array<{taskId: string; taskTitle: string; taskKey?: string; points: number; date: string}>>([]);

  // ── Meetings State ──
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [showCreateMeeting, setShowCreateMeeting] = useState(false);
  const [meetingForm, setMeetingForm] = useState({
    title: "",
    type: "planning" as 'planning' | 'standup' | 'review' | 'retro' | 'grooming' | 'breakout',
    date: "",
    time: "",
    duration: 30,
    notes: "",
  });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [sprintRes, projRes] = await Promise.all([
        sprintApi.getById(sprintId),
        projectApi.getById(projectId),
      ]);

      const sprintData = sprintRes.data || null;
      setSprint(sprintData);
      setGoalText(sprintData?.goal || "");
      setProject(projRes.data || null);

      // Fetch tasks for this sprint
      try {
        const tasksRes = await taskApi.getAll({ sprintId });
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      } catch {
        setTasks([]);
      }

      // Fetch all sprints for velocity context
      if (sprintData?.boardId) {
        try {
          const allSprintsRes = await sprintApi.getByBoard(sprintData.boardId);
          setAllSprints(Array.isArray(allSprintsRes.data) ? allSprintsRes.data : []);
        } catch {
          setAllSprints([]);
        }
      }

      // Fetch backlog tasks (not in any sprint) for sprint planning
      try {
        const allTasksRes = await taskApi.getAll({ projectId });
        const all = Array.isArray(allTasksRes.data) ? allTasksRes.data : [];
        setBacklogTasks(all.filter((t) => !t.sprintId));
      } catch {
        setBacklogTasks([]);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load sprint");
    } finally {
      setLoading(false);
    }
  }, [sprintId, projectId]);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && sprintId) fetchAll();
  }, [user, sprintId, fetchAll]);

  // ── Load localStorage data ──
  useEffect(() => {
    if (!sprintId) return;
    try {
      const retroData = localStorage.getItem(`nexora_retro_${sprintId}`);
      if (retroData) {
        const parsed = JSON.parse(retroData);
        setRetroItems(parsed.items || []);
        setRetroActionItems(parsed.actionItems || []);
      }
    } catch {}
    try {
      const pokerData = localStorage.getItem(`nexora_poker_${sprintId}`);
      if (pokerData) {
        const parsed = JSON.parse(pokerData);
        setPokerHistory(parsed.history || []);
      }
    } catch {}
    try {
      const meetingsData = localStorage.getItem(`nexora_meetings_${sprintId}`);
      if (meetingsData) {
        setMeetings(JSON.parse(meetingsData) || []);
      }
    } catch {}
  }, [sprintId]);

  // ── Save retro to localStorage ──
  useEffect(() => {
    if (!sprintId) return;
    localStorage.setItem(`nexora_retro_${sprintId}`, JSON.stringify({ items: retroItems, actionItems: retroActionItems }));
  }, [retroItems, retroActionItems, sprintId]);

  // ── Save poker history to localStorage ──
  useEffect(() => {
    if (!sprintId) return;
    localStorage.setItem(`nexora_poker_${sprintId}`, JSON.stringify({ history: pokerHistory }));
  }, [pokerHistory, sprintId]);

  // ── Save meetings to localStorage ──
  useEffect(() => {
    if (!sprintId) return;
    localStorage.setItem(`nexora_meetings_${sprintId}`, JSON.stringify(meetings));
  }, [meetings, sprintId]);

  // ── Retro Handlers ──
  const addRetroItem = (category: 'start' | 'stop' | 'continue') => {
    const text = newRetroText[category]?.trim();
    if (!text) return;
    setRetroItems((prev) => [...prev, {
      id: Date.now().toString(),
      category,
      text,
      votes: 0,
      votedBy: [],
      author: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : (user?.email || "You"),
      createdAt: new Date().toISOString(),
    }]);
    setNewRetroText((prev) => ({ ...prev, [category]: "" }));
  };

  const voteRetroItem = (itemId: string) => {
    const myId = user?._id || user?.email || "me";
    setRetroItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      if (item.votedBy.includes(myId)) {
        return { ...item, votes: item.votes - 1, votedBy: item.votedBy.filter((v) => v !== myId) };
      }
      return { ...item, votes: item.votes + 1, votedBy: [...item.votedBy, myId] };
    }));
  };

  const deleteRetroItem = (itemId: string) => {
    setRetroItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const addActionItem = () => {
    if (!newActionText.trim()) return;
    setRetroActionItems((prev) => [...prev, {
      id: Date.now().toString(),
      text: newActionText.trim(),
      assignee: newActionAssignee.trim(),
      done: false,
    }]);
    setNewActionText("");
    setNewActionAssignee("");
  };

  const toggleActionItem = (id: string) => {
    setRetroActionItems((prev) => prev.map((a) => a.id === id ? { ...a, done: !a.done } : a));
  };

  // ── Poker Handlers ──
  const startPokerForTask = (task: Task) => {
    setPokerTask(task);
    setPokerActive(true);
    setSelectedCard(null);
    setPokerRevealed(false);
    setPokerVotes([{ userId: user?._id || "me", name: user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : "You", vote: null }]);
  };

  const submitPokerVote = () => {
    if (selectedCard === null) return;
    setPokerVotes((prev) => prev.map((v) =>
      v.userId === (user?._id || "me") ? { ...v, vote: selectedCard } : v
    ));
    setPokerRevealed(true);
  };

  const applyPokerEstimate = async (points: number) => {
    if (!pokerTask) return;
    try {
      await taskApi.update(pokerTask._id, { storyPoints: points });
      setPokerHistory((prev) => [...prev, {
        taskId: pokerTask._id,
        taskTitle: pokerTask.title,
        taskKey: pokerTask.taskKey,
        points,
        date: new Date().toISOString(),
      }]);
      toast.success(`Story points set to ${points} for ${pokerTask.taskKey || pokerTask.title}`);
      setPokerActive(false);
      setPokerTask(null);
      setSelectedCard(null);
      setPokerRevealed(false);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update story points");
    }
  };

  // ── Meeting Handlers ──
  const fetchSprintMeetings = useCallback(async () => {
    if (!sprintId) return;
    setMeetingsLoading(true);
    try {
      const res = await meetingApi.getBySprint(sprintId);
      setMeetings(Array.isArray(res.data) ? res.data : []);
    } catch {
      setMeetings([]);
    } finally {
      setMeetingsLoading(false);
    }
  }, [sprintId]);

  useEffect(() => {
    if (activeTab === "meetings") fetchSprintMeetings();
  }, [activeTab, fetchSprintMeetings]);

  const createMeeting = async () => {
    if (!meetingForm.title.trim() || !meetingForm.date || !meetingForm.time) {
      toast.error("Please fill in title, date, and time");
      return;
    }
    try {
      const scheduledAt = new Date(`${meetingForm.date}T${meetingForm.time}:00`);
      const res = await meetingApi.schedule({
        title: meetingForm.title.trim(),
        description: meetingForm.notes.trim() || undefined,
        scheduledAt,
        durationMinutes: meetingForm.duration,
        sprintId,
      });
      if (res.data) setMeetings((prev) => [...prev, res.data!]);
      setMeetingForm({ title: "", type: "planning", date: "", time: "", duration: 30, notes: "" });
      setShowCreateMeeting(false);
      toast.success("Meeting scheduled");
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule meeting");
    }
  };

  const quickSchedule = async (type: 'standup' | 'review' | 'breakout') => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // 5 min from now
    const configs: Record<string, { title: string; duration: number }> = {
      standup: { title: "Daily Standup", duration: 15 },
      review: { title: "Sprint Review", duration: 60 },
      breakout: { title: "Breakout Session", duration: 30 },
    };
    const cfg = configs[type];
    try {
      const res = await meetingApi.schedule({
        title: cfg.title,
        scheduledAt: now,
        durationMinutes: cfg.duration,
        sprintId,
      });
      const newMtg = res.data;
      if (newMtg) {
        setMeetings((prev) => [...prev, newMtg]);
        toast.success(`${cfg.title} scheduled`);
        if (type === "breakout") {
          // Start immediately and join
          await meetingApi.start(newMtg.meetingId);
          router.push(`/meeting/${newMtg.meetingId}`);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule meeting");
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    try {
      await meetingApi.cancel(meetingId);
      setMeetings((prev) => prev.filter((m) => m.meetingId !== meetingId));
      toast.success("Meeting cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel meeting");
    }
  };

  const startAndJoinMeeting = async (meeting: Meeting) => {
    try {
      if (meeting.status === "scheduled" && meeting.hostId === user?._id) {
        await meetingApi.start(meeting.meetingId);
      }
      router.push(`/meeting/${meeting.meetingId}`);
    } catch {
      router.push(`/meeting/${meeting.meetingId}`);
    }
  };

  const handleStartSprint = async () => {
    try {
      await sprintApi.start(sprintId);
      toast.success("Sprint started!");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to start sprint");
    }
  };

  const handleCompleteSprint = async () => {
    try {
      await sprintApi.complete(sprintId, { moveToBacklog: true });
      toast.success("Sprint completed! Unfinished items moved to backlog.");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to complete sprint");
    }
  };

  const handleSaveGoal = async () => {
    if (!sprint) return;
    try {
      await sprintApi.update(sprintId, { goal: goalText });
      setSprint({ ...sprint, goal: goalText });
      setEditingGoal(false);
      toast.success("Sprint goal updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update goal");
    }
  };

  const handleAddTask = async (taskId: string) => {
    try {
      await sprintApi.addTasks(sprintId, [taskId]);
      toast.success("Task added to sprint");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to add task");
    }
  };

  const handleRemoveTask = async (taskId: string) => {
    try {
      await sprintApi.removeTask(sprintId, taskId);
      toast.success("Task removed from sprint");
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove task");
    }
  };

  if (authLoading || !user || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary-hex,#2E86C1)] border-t-transparent" />
      </div>
    );
  }

  if (!sprint || !project) {
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <Sidebar user={user} onLogout={logout} />
        <main className="ml-[260px] p-8">
          <div className="text-center py-20">
            <h2 className="text-lg font-semibold text-gray-900">Sprint not found</h2>
            <Button className="mt-4" onClick={() => router.push(`/projects/${projectId}`)}>Back to Project</Button>
          </div>
        </main>
      </div>
    );
  }

  // Stats
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const completionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalPoints = tasks.reduce((s, t) => s + (t.storyPoints || 0), 0);
  const donePoints = tasks.filter((t) => t.status === "done").reduce((s, t) => s + (t.storyPoints || 0), 0);

  const getDaysRemaining = () => {
    if (sprint.status === "completed") return "Completed";
    if (!sprint.startDate || !sprint.endDate) return "No dates";
    const end = new Date(sprint.endDate);
    const now = new Date();
    const remaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
    return `${remaining} day${remaining !== 1 ? "s" : ""}`;
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "--";
  const sc = sprintStatusConfig[sprint.status] || sprintStatusConfig.planning;
  const methodology = project.methodology || "scrum";
  const isEditable = sprint.status === "planning" || sprint.status === "active";

  // Group tasks by status
  const groupedTasks = statusOrder.map((group) => ({
    ...group,
    tasks: tasks.filter((t) => t.status === group.key),
  })).filter((g) => g.tasks.length > 0);

  // Cycle time (for kanban metrics)
  const getCycleTimeMetrics = () => {
    const doneTasks = tasks.filter((t) => t.status === "done" && t.createdAt && t.updatedAt);
    if (doneTasks.length === 0) return { avg: 0, min: 0, max: 0 };
    const cycleTimes = doneTasks.map((t) => {
      const created = new Date(t.createdAt!).getTime();
      const updated = new Date(t.updatedAt!).getTime();
      return Math.max(1, Math.ceil((updated - created) / 86400000));
    });
    return {
      avg: Math.round(cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length),
      min: Math.min(...cycleTimes),
      max: Math.max(...cycleTimes),
    };
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] overflow-hidden">
      <Sidebar user={user} onLogout={logout} />
      <main className="flex-1 ml-[260px] p-6 overflow-y-auto overflow-x-hidden" style={{ maxHeight: "100vh" }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/projects/${projectId}`)} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] text-[#94A3B8] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-lg bg-[#2E86C1] flex items-center justify-center text-white font-bold text-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#0F172A]">{sprint.name}</h1>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${sc.color}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${sc.dot}`} />
                  {sc.label}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] capitalize">{methodology}</span>
              </div>
              <p className="text-[13px] text-[#64748B] mt-0.5">
                {project.projectName} &middot; {formatDate(sprint.startDate)} -- {formatDate(sprint.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {sprint.status === "planning" && (
              <Button size="sm" onClick={handleStartSprint} className="h-8 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] px-4">
                Start Sprint
              </Button>
            )}
            {sprint.status === "active" && (
              <Button size="sm" onClick={handleCompleteSprint} className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 px-4">
                Complete Sprint
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Total Tasks</p>
              </div>
              <p className="text-xl font-bold text-[#0F172A]">{totalTasks}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-emerald-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Completed</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-emerald-600">{completedTasks}</p>
                <div className="flex-1">
                  <div className="h-1.5 bg-[#F1F5F9] rounded-full"><div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} /></div>
                </div>
                <span className="text-[10px] font-bold text-emerald-600">{completionPct}%</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-violet-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Story Points</p>
              </div>
              <p className="text-xl font-bold text-[#2E86C1]">{donePoints}<span className="text-[13px] text-[#94A3B8] font-normal">/{totalPoints}</span></p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-amber-50 rounded-bl-[40px] -mr-1 -mt-1" />
            <CardContent className="p-3.5 relative">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 rounded-md bg-amber-100 flex items-center justify-center">
                  <svg className="w-3 h-3 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-medium text-[#94A3B8] uppercase">Remaining</p>
              </div>
              <p className={`text-xl font-bold ${sprint.status === "completed" ? "text-emerald-600" : "text-amber-600"}`}>{getDaysRemaining()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tab Bar */}
        <div className="flex gap-1 mb-6 bg-[#F1F5F9] rounded-lg p-1 w-fit">
          {[
            { key: "overview", label: "Overview" },
            { key: "retro", label: "Retrospective" },
            { key: "poker", label: "Planning Poker" },
            { key: "meetings", label: "Meetings" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#334155]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (<>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          {/* Left column: Charts */}
          <div className="lg:col-span-2 space-y-5">
            {/* Burndown Chart (Scrum/Scrumban) */}
            {["scrum", "scrumban", "safe", "xp"].includes(methodology) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    <h3 className="text-sm font-semibold text-[#0F172A]">Burndown Chart</h3>
                  </div>
                  <BurndownChart sprint={sprint} tasks={tasks} />
                </CardContent>
              </Card>
            )}

            {/* Cumulative Flow (Kanban) */}
            {["kanban"].includes(methodology) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <h3 className="text-sm font-semibold text-[#0F172A]">Cumulative Flow</h3>
                  </div>
                  <CumulativeFlowDiagram tasks={tasks} />
                </CardContent>
              </Card>
            )}

            {/* Kanban cycle time metrics */}
            {["kanban", "scrumban"].includes(methodology) && (() => {
              const ct = getCycleTimeMetrics();
              return (
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <h3 className="text-sm font-semibold text-[#0F172A]">Flow Metrics</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-[#2E86C1]">{ct.avg}</p>
                        <p className="text-[10px] text-[#94A3B8]">Avg Cycle Time (days)</p>
                      </div>
                      <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-600">{ct.min}</p>
                        <p className="text-[10px] text-[#94A3B8]">Min</p>
                      </div>
                      <div className="bg-[#F8FAFC] rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-amber-600">{ct.max}</p>
                        <p className="text-[10px] text-[#94A3B8]">Max</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[#64748B] mb-1">
                        <span>Throughput</span>
                        <span className="font-semibold text-[#0F172A]">{completedTasks} tasks completed</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>WIP</span>
                        <span className="font-semibold text-[#0F172A]">{tasks.filter((t) => t.status === "in_progress").length} tasks in progress</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Scrumban: Also show burndown */}
            {["scrumban"].includes(methodology) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                    <h3 className="text-sm font-semibold text-[#0F172A]">Burndown Chart</h3>
                  </div>
                  <BurndownChart sprint={sprint} tasks={tasks} />
                </CardContent>
              </Card>
            )}

            {/* Waterfall: Milestone timeline */}
            {["waterfall"].includes(methodology) && project.milestones && project.milestones.length > 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>
                    <h3 className="text-sm font-semibold text-[#0F172A]">Milestone Timeline</h3>
                  </div>
                  <div className="space-y-3">
                    {project.milestones.map((ms, i) => {
                      const isCompleted = ms.status === "completed";
                      const msTaskCount = tasks.filter((t) => t.labels?.includes(ms.title)).length;
                      const msDone = tasks.filter((t) => t.labels?.includes(ms.title) && t.status === "done").length;
                      const msPct = msTaskCount > 0 ? Math.round((msDone / msTaskCount) * 100) : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${isCompleted ? "bg-emerald-500" : "bg-[#CBD5E1]"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-medium text-[#0F172A] truncate">{ms.title}</span>
                              <span className="text-[10px] text-[#94A3B8]">{ms.targetDate ? new Date(ms.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "--"}</span>
                            </div>
                            <div className="h-2 bg-[#F1F5F9] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isCompleted ? "bg-emerald-500" : "bg-[#2E86C1]"}`} style={{ width: `${msPct}%` }} />
                            </div>
                          </div>
                          <span className="text-[10px] font-semibold text-[#64748B] shrink-0">{msPct}%</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Velocity + Sprint Info */}
          <div className="space-y-5">
            {/* Velocity */}
            {["scrum", "scrumban", "safe", "xp"].includes(methodology) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    <h3 className="text-sm font-semibold text-[#0F172A]">Velocity</h3>
                  </div>
                  <VelocitySection sprints={allSprints} currentSprint={sprint} tasks={tasks} />
                </CardContent>
              </Card>
            )}

            {/* Sprint Scope */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  <h3 className="text-sm font-semibold text-[#0F172A]">Sprint Scope</h3>
                </div>

                {/* Goal */}
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">Goal</p>
                  {editingGoal && isEditable ? (
                    <div className="space-y-2">
                      <textarea
                        value={goalText}
                        onChange={(e) => setGoalText(e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#2E86C1] resize-none"
                        rows={3}
                        placeholder="What should this sprint achieve?"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveGoal} className="h-6 text-[10px] bg-[#2E86C1] hover:bg-[#2471A3] px-3">Save</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingGoal(false); setGoalText(sprint.goal || ""); }} className="h-6 text-[10px] px-3">Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`bg-[#F8FAFC] rounded-lg px-3 py-2 text-[12px] text-[#334155] border border-[#F1F5F9] ${isEditable ? "cursor-pointer hover:border-[#CBD5E1]" : ""}`}
                      onClick={() => isEditable && setEditingGoal(true)}
                    >
                      {sprint.goal || (isEditable ? "Click to set sprint goal..." : "No goal set")}
                    </div>
                  )}
                </div>

                {/* Date range */}
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1">Date Range</p>
                  <p className="text-[12px] text-[#334155]">{formatDate(sprint.startDate)} -- {formatDate(sprint.endDate)}</p>
                </div>

                {/* Scope stats */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-[#0F172A]">{totalTasks}</p>
                    <p className="text-[9px] text-[#94A3B8]">Current Tasks</p>
                  </div>
                  <div className="bg-[#F8FAFC] rounded-lg p-2.5 text-center">
                    <p className="text-lg font-bold text-[#2E86C1]">{totalPoints}</p>
                    <p className="text-[9px] text-[#94A3B8]">Total Points</p>
                  </div>
                </div>

                {/* Task status breakdown */}
                {totalTasks > 0 && (
                  <div className="mt-3">
                    <div className="flex h-2 rounded-full overflow-hidden bg-[#F1F5F9]">
                      {statusOrder.map((s) => {
                        const count = tasks.filter((t) => t.status === s.key).length;
                        if (count === 0) return null;
                        return (
                          <div
                            key={s.key}
                            className={`${s.dotColor} transition-all`}
                            style={{ width: `${(count / totalTasks) * 100}%` }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {statusOrder.map((s) => {
                        const count = tasks.filter((t) => t.status === s.key).length;
                        if (count === 0) return null;
                        return (
                          <span key={s.key} className="text-[9px] text-[#64748B] flex items-center gap-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
                            {count} {s.label.toLowerCase()}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Task List grouped by status */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#0F172A]">Tasks</h2>
            {isEditable && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddTasks(!showAddTasks)}
                className="h-7 text-[11px] gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                {showAddTasks ? "Hide Backlog" : "Add Tasks"}
              </Button>
            )}
          </div>

          {/* Add Tasks from backlog */}
          {showAddTasks && isEditable && (
            <Card className="border-0 shadow-sm mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                  <h4 className="text-[12px] font-semibold text-[#334155]">Backlog ({backlogTasks.length} items)</h4>
                </div>
                {backlogTasks.length === 0 ? (
                  <p className="text-[11px] text-[#94A3B8] text-center py-4">No unassigned tasks in backlog</p>
                ) : (
                  <div className="space-y-1 max-h-[240px] overflow-y-auto">
                    {backlogTasks.map((t) => {
                      const ti = typeIcons[t.type] || typeIcons.task;
                      return (
                        <div key={t._id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-[#F8FAFC] group">
                          <svg className={`w-3.5 h-3.5 shrink-0 ${ti.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={ti.icon} /></svg>
                          {t.taskKey && <span className="text-[10px] font-mono text-[#94A3B8]">{t.taskKey}</span>}
                          <span className="text-[12px] text-[#334155] truncate flex-1">{t.title}</span>
                          {t.storyPoints != null && <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{t.storyPoints}</span>}
                          {t.priority && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[t.priority]}`}>{t.priority.toUpperCase()}</span>}
                          <button
                            onClick={() => handleAddTask(t._id)}
                            className="p-1 rounded-md bg-[#2E86C1] text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2471A3]"
                            title="Add to sprint"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Grouped task list */}
          {groupedTasks.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <svg className="w-12 h-12 mx-auto text-[#CBD5E1] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                <p className="text-sm text-[#94A3B8]">No tasks in this sprint</p>
                {isEditable && (
                  <Button size="sm" className="mt-3 bg-[#2E86C1] hover:bg-[#2471A3]" onClick={() => setShowAddTasks(true)}>
                    Add Tasks from Backlog
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {groupedTasks.map((group) => (
                <Card key={group.key} className="border-0 shadow-sm">
                  <CardContent className="p-0">
                    {/* Group header */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#F1F5F9] bg-[#FAFBFC] rounded-t-xl">
                      <div className={`w-2 h-2 rounded-full ${group.dotColor}`} />
                      <h4 className="text-[12px] font-semibold text-[#334155]">{group.label}</h4>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white text-[#64748B] border border-[#E2E8F0]">{group.tasks.length}</span>
                      <span className="text-[9px] text-[#94A3B8] ml-auto">{group.tasks.reduce((s, t) => s + (t.storyPoints || 0), 0)} pts</span>
                    </div>

                    {/* Tasks */}
                    <div className="divide-y divide-[#F1F5F9]">
                      {group.tasks.map((task) => {
                        const ti = typeIcons[task.type] || typeIcons.task;
                        return (
                          <div
                            key={task._id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] cursor-pointer group"
                            onClick={() => router.push(`/projects/${projectId}/items/${task._id}`)}
                          >
                            <svg className={`w-3.5 h-3.5 shrink-0 ${ti.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={ti.icon} /></svg>
                            {task.taskKey && <span className="text-[10px] font-mono font-medium text-[#94A3B8] shrink-0">{task.taskKey}</span>}
                            <span className="text-[12px] text-[#0F172A] truncate flex-1">{task.title}</span>
                            {task.parentTaskId && (
                              <span className="text-[9px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded shrink-0">Sub-task</span>
                            )}
                            {task.storyPoints != null && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 shrink-0">{task.storyPoints}</span>
                            )}
                            {task.priority && (
                              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${priorityColors[task.priority]}`}>{task.priority.toUpperCase()}</span>
                            )}
                            {isEditable && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRemoveTask(task._id); }}
                                className="p-1 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                title="Remove from sprint"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        </>)}

        {/* ═══ RETROSPECTIVE TAB ═══ */}
        {activeTab === "retro" && (
          <div className="space-y-6">
            {/* Retro Summary Stats */}
            {retroItems.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {(["start", "stop", "continue"] as const).map((cat) => {
                  const items = retroItems.filter((i) => i.category === cat);
                  const topItem = [...items].sort((a, b) => b.votes - a.votes)[0];
                  const colors = { start: "emerald", stop: "red", continue: "blue" } as const;
                  const c = colors[cat];
                  return (
                    <Card key={cat} className="border-0 shadow-sm">
                      <CardContent className="p-3.5">
                        <p className="text-[10px] font-medium text-[#94A3B8] uppercase mb-1">{cat} doing</p>
                        <p className="text-xl font-bold text-[#0F172A]">{items.length} <span className="text-[13px] text-[#94A3B8] font-normal">items</span></p>
                        {topItem && (
                          <p className="text-[10px] text-[#64748B] mt-1 truncate">Top: {topItem.text} ({topItem.votes} votes)</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Three Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {([
                { key: "start" as const, title: "Start Doing", subtitle: "What should we start doing?", color: "emerald", bgHead: "bg-emerald-50", borderHead: "border-emerald-200", textTitle: "text-emerald-700", textSub: "text-emerald-600/70" },
                { key: "stop" as const, title: "Stop Doing", subtitle: "What should we stop doing?", color: "red", bgHead: "bg-red-50", borderHead: "border-red-200", textTitle: "text-red-700", textSub: "text-red-600/70" },
                { key: "continue" as const, title: "Continue Doing", subtitle: "What should we continue?", color: "blue", bgHead: "bg-blue-50", borderHead: "border-blue-200", textTitle: "text-blue-700", textSub: "text-blue-600/70" },
              ]).map((col) => {
                const items = retroItems
                  .filter((i) => i.category === col.key)
                  .sort((a, b) => b.votes - a.votes);
                const isReadOnly = sprint.status === "completed";
                return (
                  <div key={col.key} className="flex-1 min-w-0">
                    <div className={`${col.bgHead} rounded-t-xl px-4 py-3 border ${col.borderHead} border-b-0`}>
                      <h3 className={`text-sm font-semibold ${col.textTitle}`}>{col.title}</h3>
                      <p className={`text-[10px] ${col.textSub}`}>{col.subtitle}</p>
                    </div>
                    <div className="bg-white rounded-b-xl border border-[#E2E8F0] border-t-0 p-3 space-y-2 min-h-[200px]">
                      {items.map((item) => (
                        <div key={item.id} className="bg-[#F8FAFC] rounded-lg px-3 py-2 group">
                          <p className="text-[12px] text-[#334155] mb-1.5">{item.text}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => !isReadOnly && voteRetroItem(item.id)}
                                disabled={isReadOnly}
                                className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                                  item.votedBy.includes(user?._id || user?.email || "me")
                                    ? "bg-[#2E86C1] text-white"
                                    : "bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2E86C1] hover:text-[#2E86C1]"
                                } ${isReadOnly ? "opacity-60 cursor-default" : "cursor-pointer"}`}
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                                {item.votes}
                              </button>
                              <span className="text-[9px] text-[#94A3B8]">{item.author}</span>
                            </div>
                            {!isReadOnly && (
                              <button
                                onClick={() => deleteRetroItem(item.id)}
                                className="p-1 rounded text-[#94A3B8] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {!isReadOnly && (
                        <div className="flex gap-2">
                          <input
                            value={newRetroText[col.key] || ""}
                            onChange={(e) => setNewRetroText((prev) => ({ ...prev, [col.key]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && addRetroItem(col.key)}
                            placeholder="Add item..."
                            className="flex-1 bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] text-[#334155] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                          />
                          <button
                            onClick={() => addRetroItem(col.key)}
                            className="p-1.5 rounded-lg bg-[#2E86C1] text-white hover:bg-[#2471A3] transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action Items */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                  <h3 className="text-sm font-semibold text-[#0F172A]">Action Items</h3>
                  <span className="text-[10px] text-[#94A3B8]">({retroActionItems.filter((a) => a.done).length}/{retroActionItems.length} done)</span>
                </div>
                <div className="space-y-2 mb-3">
                  {retroActionItems.map((action) => (
                    <div key={action.id} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[#F8FAFC] group">
                      <button
                        onClick={() => toggleActionItem(action.id)}
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          action.done ? "bg-emerald-500 border-emerald-500" : "border-[#CBD5E1] hover:border-[#2E86C1]"
                        }`}
                      >
                        {action.done && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        )}
                      </button>
                      <span className={`text-[12px] flex-1 ${action.done ? "line-through text-[#94A3B8]" : "text-[#334155]"}`}>{action.text}</span>
                      {action.assignee && (
                        <span className="text-[10px] text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">{action.assignee}</span>
                      )}
                      <button
                        onClick={() => setRetroActionItems((prev) => prev.filter((a) => a.id !== action.id))}
                        className="p-1 rounded text-[#94A3B8] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                {sprint.status !== "completed" && (
                  <div className="flex gap-2">
                    <input
                      value={newActionText}
                      onChange={(e) => setNewActionText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addActionItem()}
                      placeholder="Add action item..."
                      className="flex-1 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] text-[#334155] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                    />
                    <input
                      value={newActionAssignee}
                      onChange={(e) => setNewActionAssignee(e.target.value)}
                      placeholder="Assignee..."
                      className="w-32 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-1.5 text-[12px] text-[#334155] placeholder:text-[#CBD5E1] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                    />
                    <Button size="sm" onClick={addActionItem} className="h-8 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] px-3 gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Add
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ═══ PLANNING POKER TAB ═══ */}
        {activeTab === "poker" && (
          <div className="space-y-6">
            {!pokerActive ? (
              <>
                {/* Task Selector */}
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                      <h3 className="text-sm font-semibold text-[#0F172A]">Select Task to Estimate</h3>
                    </div>

                    {/* Start Grooming Session */}
                    <div className="mb-4 p-3 bg-[#EBF5FB] rounded-lg border border-[#BFDBFE]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[12px] font-semibold text-[#2E86C1]">Start Grooming Session</p>
                          <p className="text-[10px] text-[#64748B]">Open a call for collaborative estimation</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => router.push(`/calls?context=grooming&sprintId=${sprintId}`)}
                          className="h-7 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] gap-1.5"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          Join Call
                        </Button>
                      </div>
                    </div>

                    {/* Unestimated Tasks */}
                    {(() => {
                      const unestimated = tasks.filter((t) => !t.storyPoints && t.status !== "done");
                      if (unestimated.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <svg className="w-10 h-10 mx-auto text-emerald-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <p className="text-sm text-[#64748B]">All tasks have been estimated</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {unestimated.map((t) => {
                            const ti = typeIcons[t.type] || typeIcons.task;
                            return (
                              <div
                                key={t._id}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F8FAFC] cursor-pointer group border border-transparent hover:border-[#E2E8F0] transition-all"
                                onClick={() => startPokerForTask(t)}
                              >
                                <svg className={`w-3.5 h-3.5 shrink-0 ${ti.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={ti.icon} /></svg>
                                {t.taskKey && <span className="text-[10px] font-mono text-[#94A3B8]">{t.taskKey}</span>}
                                <span className="text-[12px] text-[#334155] truncate flex-1">{t.title}</span>
                                {t.priority && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[t.priority]}`}>{t.priority.toUpperCase()}</span>}
                                <span className="text-[10px] text-[#2E86C1] font-medium opacity-0 group-hover:opacity-100 transition-opacity">Estimate</span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* Estimation History */}
                {pokerHistory.length > 0 && (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <h3 className="text-sm font-semibold text-[#0F172A]">Estimation History</h3>
                      </div>
                      <div className="space-y-1">
                        {pokerHistory.map((h, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-[#F8FAFC]">
                            {h.taskKey && <span className="text-[10px] font-mono text-[#94A3B8]">{h.taskKey}</span>}
                            <span className="text-[12px] text-[#334155] truncate flex-1">{h.taskTitle}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">{h.points} pts</span>
                            <span className="text-[9px] text-[#94A3B8]">{new Date(h.date).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* Active Poker Game */
              <Card className="border-0 shadow-sm">
                <CardContent className="p-6">
                  {/* Task being estimated */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#2E86C1]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                        <h3 className="text-sm font-semibold text-[#0F172A]">Estimating</h3>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setPokerActive(false); setPokerTask(null); setSelectedCard(null); setPokerRevealed(false); }}
                        className="h-7 text-[11px]"
                      >
                        Cancel
                      </Button>
                    </div>
                    <div className="bg-[#F8FAFC] rounded-lg p-4 border border-[#E2E8F0]">
                      <div className="flex items-center gap-2 mb-1">
                        {pokerTask?.taskKey && <span className="text-[11px] font-mono text-[#94A3B8]">{pokerTask.taskKey}</span>}
                        <h4 className="text-[14px] font-semibold text-[#0F172A]">{pokerTask?.title}</h4>
                      </div>
                      {pokerTask?.description && (
                        <p className="text-[12px] text-[#64748B] mt-1">{pokerTask.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {pokerTask?.priority && <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${priorityColors[pokerTask.priority]}`}>{pokerTask.priority.toUpperCase()}</span>}
                        {pokerTask?.type && <span className="text-[10px] text-[#64748B] capitalize">{pokerTask.type.replace("_", " ")}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Card Deck */}
                  <div className="mb-6">
                    <p className="text-[11px] font-semibold text-[#334155] mb-3">Pick your estimate</p>
                    <div className="flex flex-wrap gap-3 justify-center">
                      {pokerCards.map((n) => (
                        <div
                          key={n}
                          onClick={() => !pokerRevealed && setSelectedCard(n)}
                          className={`w-14 h-20 rounded-xl border-2 flex items-center justify-center text-xl font-bold cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg ${
                            selectedCard === n
                              ? "border-[#2E86C1] bg-[#EBF5FB] text-[#2E86C1] scale-105 shadow-md"
                              : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#CBD5E1]"
                          } ${pokerRevealed ? "pointer-events-none" : ""}`}
                        >
                          {n === -1 ? "?" : n}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {!pokerRevealed ? (
                    <div className="flex justify-center">
                      <Button
                        onClick={submitPokerVote}
                        disabled={selectedCard === null}
                        className="h-9 text-[12px] bg-[#2E86C1] hover:bg-[#2471A3] px-6 gap-2 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Reveal
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Result */}
                      <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#E2E8F0]">
                        <p className="text-[11px] font-semibold text-[#334155] mb-3">Result</p>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#2E86C1]">{selectedCard === -1 ? "?" : selectedCard}</p>
                            <p className="text-[10px] text-[#94A3B8]">Your Vote</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-emerald-600">{selectedCard === -1 ? "?" : selectedCard}</p>
                            <p className="text-[10px] text-[#94A3B8]">Consensus</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#0F172A]">{selectedCard === -1 ? "?" : selectedCard}</p>
                            <p className="text-[10px] text-[#94A3B8]">Recommended</p>
                          </div>
                        </div>

                        {/* Vote Distribution Bar */}
                        {selectedCard !== null && selectedCard !== -1 && (
                          <div className="mb-4">
                            <p className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-2">Vote Distribution</p>
                            <div className="flex items-end gap-1 h-10 justify-center">
                              {pokerCards.filter((c) => c !== -1).map((c) => (
                                <div key={c} className="flex flex-col items-center gap-0.5">
                                  <div
                                    className={`w-6 rounded-t transition-all ${c === selectedCard ? "bg-[#2E86C1]" : "bg-[#E2E8F0]"}`}
                                    style={{ height: c === selectedCard ? "32px" : "4px" }}
                                  />
                                  <span className="text-[8px] text-[#94A3B8]">{c}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 justify-center">
                          {selectedCard !== null && selectedCard !== -1 && (
                            <Button
                              onClick={() => applyPokerEstimate(selectedCard)}
                              className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 px-4 gap-1.5"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Apply Estimate ({selectedCard} pts)
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelectedCard(null); setPokerRevealed(false); }}
                            className="h-8 text-[11px] px-4"
                          >
                            Re-vote
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ═══ MEETINGS TAB ═══ */}
        {activeTab === "meetings" && (
          <div className="space-y-6">
            {/* Sprint Planning Meeting CTA */}
            <Card className="border-0 shadow-sm bg-gradient-to-r from-[#EBF5FB] to-[#F0F4FF]">
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">Sprint Planning Meeting</h3>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Start a live meeting for this sprint. Anyone with the link can join — no account required.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => quickSchedule("breakout")}
                  className="h-9 text-[12px] bg-[#2E86C1] hover:bg-[#2471A3] gap-1.5 shrink-0 ml-4"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Start Meeting Now
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => quickSchedule("standup")} className="h-8 text-[11px] bg-emerald-600 hover:bg-emerald-700 gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Schedule Daily Standup
              </Button>
              <Button size="sm" onClick={() => quickSchedule("review")} className="h-8 text-[11px] bg-violet-600 hover:bg-violet-700 gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                Schedule Sprint Review
              </Button>
              <Button size="sm" onClick={() => quickSchedule("breakout")} className="h-8 text-[11px] bg-rose-600 hover:bg-rose-700 gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                Start Breakout Session
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreateMeeting(!showCreateMeeting)}
                className="h-8 text-[11px] gap-1.5"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Create Meeting
              </Button>
            </div>

            {/* Create Meeting Form */}
            {showCreateMeeting && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-[#0F172A] mb-4">New Meeting</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Title</label>
                      <input
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, title: e.target.value }))}
                        placeholder="Meeting title..."
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Type</label>
                      <select
                        value={meetingForm.type}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, type: e.target.value as typeof meetingForm.type }))}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      >
                        <option value="planning">Sprint Planning</option>
                        <option value="standup">Daily Standup</option>
                        <option value="review">Sprint Review</option>
                        <option value="retro">Sprint Retro</option>
                        <option value="grooming">Grooming</option>
                        <option value="breakout">Breakout</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Date</label>
                      <input
                        type="date"
                        value={meetingForm.date}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, date: e.target.value }))}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Time</label>
                      <input
                        type="time"
                        value={meetingForm.time}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, time: e.target.value }))}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Duration (min)</label>
                      <input
                        type="number"
                        min={5}
                        max={480}
                        value={meetingForm.duration}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, duration: parseInt(e.target.value) || 30 }))}
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-[#94A3B8] uppercase mb-1 block">Notes</label>
                      <input
                        value={meetingForm.notes}
                        onChange={(e) => setMeetingForm((f) => ({ ...f, notes: e.target.value }))}
                        placeholder="Optional notes..."
                        className="w-full bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[12px] text-[#334155] focus:outline-none focus:ring-1 focus:ring-[#2E86C1]"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={createMeeting} className="h-8 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] px-4">Create</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowCreateMeeting(false)} className="h-8 text-[11px] px-4">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Meeting List */}
            {meetingsLoading ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-8 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 text-[#2E86C1]" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </CardContent>
              </Card>
            ) : meetings.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-12 text-center">
                  <svg className="w-12 h-12 mx-auto text-[#CBD5E1] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm text-[#94A3B8]">No meetings scheduled for this sprint</p>
                  <p className="text-[11px] text-[#CBD5E1] mt-1">Use the quick actions above to schedule one</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {[...meetings]
                  .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
                  .map((meeting) => {
                    const statusColors: Record<string, string> = {
                      scheduled: "bg-blue-50 text-blue-600",
                      active: "bg-emerald-50 text-emerald-600",
                      ended: "bg-gray-100 text-gray-500",
                      cancelled: "bg-red-50 text-red-500",
                    };
                    const isHost = meeting.hostId === user?._id;
                    const canJoin = meeting.status === "scheduled" || meeting.status === "active";
                    return (
                      <Card key={meeting._id} className="border-0 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-[#0F172A] truncate">{meeting.title}</h4>
                              <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${statusColors[meeting.status] || "bg-gray-100 text-gray-500"}`}>
                                {meeting.status}
                              </span>
                              {meeting.isRecording && (
                                <span className="flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                  REC
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {canJoin && (
                                <Button
                                  size="sm"
                                  onClick={() => startAndJoinMeeting(meeting)}
                                  className="h-7 text-[11px] bg-[#2E86C1] hover:bg-[#2471A3] gap-1.5"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                  {meeting.status === "active" ? "Join" : isHost ? "Start" : "Join"}
                                </Button>
                              )}
                              {isHost && meeting.status !== "ended" && meeting.status !== "cancelled" && (
                                <button
                                  onClick={() => deleteMeeting(meeting.meetingId)}
                                  className="p-1.5 rounded-md text-[#94A3B8] hover:text-red-500 hover:bg-red-50 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-[#64748B] flex-wrap">
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              {new Date(meeting.scheduledAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} at {new Date(meeting.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {meeting.durationMinutes} min
                            </span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              Hosted by {meeting.hostName}
                            </span>
                            {meeting.participantIds.length > 0 && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                                {meeting.participantIds.length} invited
                              </span>
                            )}
                            {meeting.transcript.length > 0 && (
                              <span className="flex items-center gap-1 text-violet-600">
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                                {meeting.transcript.length} transcript entries
                              </span>
                            )}
                          </div>
                          {meeting.description && (
                            <p className="text-[11px] text-[#94A3B8] mt-2 bg-[#F8FAFC] rounded px-2 py-1">{meeting.description}</p>
                          )}
                          {/* Share link */}
                          {canJoin && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[10px] text-[#94A3B8]">Share:</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(`${window.location.origin}/meeting/${meeting.meetingId}`);
                                  toast.success("Link copied!");
                                }}
                                className="text-[10px] text-[#2E86C1] hover:underline font-mono truncate max-w-[200px]"
                              >
                                /meeting/{meeting.meetingId.slice(0, 8)}...
                              </button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
