"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

// ── Types ──

export interface GanttItem {
  id: string;
  title: string;
  taskKey?: string;
  type: "epic" | "story" | "task" | "sub_task" | "bug" | "improvement" | "spike" | "milestone";
  startDate: Date;
  endDate: Date;
  status: string;
  progress: number;
  assignee?: string;
  assigneeName?: string;
  priority?: string;
  dependencies?: string[];
  children?: GanttItem[];
  level: number;
  parentId?: string;
}

export type ZoomLevel = "day" | "week" | "month";

interface GanttChartProps {
  items: GanttItem[];
  projectId: string;
  projectStartDate?: Date;
  projectEndDate?: Date;
  milestones?: Array<{ id: string; name: string; targetDate: Date; status: string }>;
}

// ── Helpers ──

const MS_PER_DAY = 86400000;

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MS_PER_DAY);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Status colors ──

const statusBarColors: Record<string, string> = {
  in_progress: "#3B82F6",
  in_review: "#8B5CF6",
  done: "#10B981",
  blocked: "#EF4444",
  cancelled: "#9CA3AF",
  backlog: "#CBD5E1",
  todo: "#94A3B8",
};

const statusBgColors: Record<string, string> = {
  in_progress: "#DBEAFE",
  in_review: "#EDE9FE",
  done: "#D1FAE5",
  blocked: "#FEE2E2",
  cancelled: "#F3F4F6",
  backlog: "#F1F5F9",
  todo: "#F1F5F9",
};

// ── Constants ──

const ROW_HEIGHT = 36;
const ROW_GAP = 8;
const TOTAL_ROW = ROW_HEIGHT + ROW_GAP;
const LABEL_WIDTH = 280;
const HEADER_HEIGHT = 54;
const BAR_HEIGHT = 24;
const BAR_Y_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;

// ── Flatten tree for rendering ──

function flattenItems(items: GanttItem[], collapsed: Set<string>): GanttItem[] {
  const result: GanttItem[] = [];
  for (const item of items) {
    result.push(item);
    if (item.children && item.children.length > 0 && !collapsed.has(item.id)) {
      result.push(...flattenItems(item.children, collapsed));
    }
  }
  return result;
}

// ── Component ──

export default function GanttChart({ items, projectId, projectStartDate, projectEndDate, milestones = [] }: GanttChartProps) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ item: GanttItem; x: number; y: number } | null>(null);

  // Day widths per zoom
  const dayWidth = zoom === "day" ? 40 : zoom === "week" ? 20 : 5;

  // Flatten visible rows
  const visibleItems = useMemo(() => flattenItems(items, collapsed), [items, collapsed]);

  // Timeline range
  const { timelineStart, timelineEnd, totalDays } = useMemo(() => {
    let earliest = projectStartDate ? startOfDay(projectStartDate) : startOfDay(new Date());
    let latest = projectEndDate ? startOfDay(projectEndDate) : startOfDay(new Date());

    for (const item of visibleItems) {
      const s = startOfDay(item.startDate);
      const e = startOfDay(item.endDate);
      if (s < earliest) earliest = s;
      if (e > latest) latest = e;
    }
    for (const m of milestones) {
      const md = startOfDay(m.targetDate);
      if (md < earliest) earliest = md;
      if (md > latest) latest = md;
    }

    // Add buffer
    const start = addDays(earliest, -7);
    const end = addDays(latest, 14);
    return {
      timelineStart: start,
      timelineEnd: end,
      totalDays: diffDays(start, end),
    };
  }, [visibleItems, milestones, projectStartDate, projectEndDate]);

  const totalWidth = totalDays * dayWidth;
  const totalHeight = visibleItems.length * TOTAL_ROW;

  // Today offset
  const todayOffset = diffDays(timelineStart, startOfDay(new Date()));

  // Toggle collapse
  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Sync horizontal scroll between header and body
  const handleScroll = useCallback(() => {
    if (scrollRef.current && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
    }
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && todayOffset > 0) {
      const containerWidth = scrollRef.current.clientWidth;
      scrollRef.current.scrollLeft = Math.max(0, todayOffset * dayWidth - containerWidth / 3);
    }
  }, [todayOffset, dayWidth]);

  // ── Build date headers ──
  const dateHeaders = useMemo(() => {
    if (zoom === "day") {
      // Show every day
      const days: { label: string; x: number; width: number; isWeekend: boolean; isToday: boolean }[] = [];
      for (let i = 0; i < totalDays; i++) {
        const d = addDays(timelineStart, i);
        const dow = d.getDay();
        days.push({
          label: d.getDate().toString(),
          x: i * dayWidth,
          width: dayWidth,
          isWeekend: dow === 0 || dow === 6,
          isToday: i === todayOffset,
        });
      }
      // Month groups
      const monthGroups: { label: string; x: number; width: number }[] = [];
      let curMonth = -1;
      let curYear = -1;
      let groupStart = 0;
      for (let i = 0; i <= totalDays; i++) {
        const d = addDays(timelineStart, i);
        if (d.getMonth() !== curMonth || d.getFullYear() !== curYear || i === totalDays) {
          if (curMonth >= 0) {
            const gd = new Date(curYear, curMonth, 1);
            monthGroups.push({
              label: gd.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
              x: groupStart * dayWidth,
              width: (i - groupStart) * dayWidth,
            });
          }
          curMonth = d.getMonth();
          curYear = d.getFullYear();
          groupStart = i;
        }
      }
      return { topRow: monthGroups, bottomRow: days };
    }

    if (zoom === "week") {
      // Show weeks
      const weeks: { label: string; x: number; width: number; isToday: boolean }[] = [];
      let i = 0;
      while (i < totalDays) {
        const d = addDays(timelineStart, i);
        const dow = d.getDay();
        const daysToSunday = dow === 0 ? 7 : 7 - dow;
        const weekEnd = Math.min(i + daysToSunday, totalDays);
        const weekDays = weekEnd - i;
        weeks.push({
          label: formatShortDate(d),
          x: i * dayWidth,
          width: weekDays * dayWidth,
          isToday: todayOffset >= i && todayOffset < weekEnd,
        });
        i = weekEnd;
      }
      // Month groups
      const monthGroups: { label: string; x: number; width: number }[] = [];
      let curMonth = -1;
      let curYear = -1;
      let groupStart = 0;
      for (let j = 0; j <= totalDays; j++) {
        const d = addDays(timelineStart, j);
        if (d.getMonth() !== curMonth || d.getFullYear() !== curYear || j === totalDays) {
          if (curMonth >= 0) {
            const gd = new Date(curYear, curMonth, 1);
            monthGroups.push({
              label: gd.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
              x: groupStart * dayWidth,
              width: (j - groupStart) * dayWidth,
            });
          }
          curMonth = d.getMonth();
          curYear = d.getFullYear();
          groupStart = j;
        }
      }
      return { topRow: monthGroups, bottomRow: weeks };
    }

    // Month zoom
    const monthCells: { label: string; x: number; width: number; isToday: boolean }[] = [];
    const yearGroups: { label: string; x: number; width: number }[] = [];
    let curYear = -1;
    let yearStart = 0;
    let i = 0;
    while (i < totalDays) {
      const d = addDays(timelineStart, i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const firstOfMonth = new Date(year, month, 1);
      const firstOfNext = new Date(year, month + 1, 1);
      const monthStartDay = Math.max(0, diffDays(timelineStart, firstOfMonth));
      const monthEndDay = Math.min(totalDays, diffDays(timelineStart, firstOfNext));
      const days = monthEndDay - monthStartDay;

      monthCells.push({
        label: firstOfMonth.toLocaleDateString("en-US", { month: "short" }),
        x: monthStartDay * dayWidth,
        width: days * dayWidth,
        isToday: todayOffset >= monthStartDay && todayOffset < monthEndDay,
      });

      if (year !== curYear) {
        if (curYear >= 0) {
          yearGroups.push({ label: curYear.toString(), x: yearStart * dayWidth, width: (monthStartDay - yearStart) * dayWidth });
        }
        curYear = year;
        yearStart = monthStartDay;
      }

      i = monthEndDay;
    }
    if (curYear >= 0) {
      yearGroups.push({ label: curYear.toString(), x: yearStart * dayWidth, width: (totalDays - yearStart) * dayWidth });
    }

    return { topRow: yearGroups, bottomRow: monthCells };
  }, [zoom, totalDays, dayWidth, timelineStart, todayOffset]);

  // ── Dependency arrows ──
  const dependencyPaths = useMemo(() => {
    const itemIndexMap = new Map<string, number>();
    visibleItems.forEach((item, idx) => itemIndexMap.set(item.id, idx));

    const paths: { d: string; isBlocking: boolean; key: string }[] = [];

    for (const item of visibleItems) {
      if (!item.dependencies) continue;
      const targetIdx = itemIndexMap.get(item.id);
      if (targetIdx === undefined) continue;

      for (const depId of item.dependencies) {
        const sourceIdx = itemIndexMap.get(depId);
        if (sourceIdx === undefined) continue;

        const sourceItem = visibleItems[sourceIdx];
        const sourceEndX = diffDays(timelineStart, startOfDay(sourceItem.endDate)) * dayWidth;
        const sourceY = sourceIdx * TOTAL_ROW + ROW_HEIGHT / 2;

        const targetStartX = diffDays(timelineStart, startOfDay(item.startDate)) * dayWidth;
        const targetY = targetIdx * TOTAL_ROW + ROW_HEIGHT / 2;

        const midX = sourceEndX + (targetStartX - sourceEndX) / 2;
        const isBlocking = sourceItem.status !== "done" && item.status === "blocked";

        // Cubic bezier path
        const d = `M ${sourceEndX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetStartX} ${targetY}`;

        paths.push({ d, isBlocking, key: `${depId}-${item.id}` });
      }
    }

    return paths;
  }, [visibleItems, timelineStart, dayWidth]);

  // ── Weekend columns ──
  const weekendColumns = useMemo(() => {
    if (zoom === "month") return [];
    const cols: { x: number; width: number }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = addDays(timelineStart, i);
      if (d.getDay() === 0 || d.getDay() === 6) {
        cols.push({ x: i * dayWidth, width: dayWidth });
      }
    }
    return cols;
  }, [totalDays, timelineStart, dayWidth, zoom]);

  // ── Type icons (compact text labels) ──
  const typeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      epic: "E", story: "S", task: "T", bug: "B", sub_task: "ST", improvement: "I", spike: "SP", milestone: "M",
    };
    return labels[type] || "T";
  };

  const typeColor = (type: string): string => {
    const colors: Record<string, string> = {
      epic: "#8B5CF6", story: "#10B981", task: "#3B82F6", bug: "#EF4444",
      sub_task: "#6B7280", improvement: "#14B8A6", spike: "#F59E0B", milestone: "#EC4899",
    };
    return colors[type] || "#6B7280";
  };

  const hasChildren = (item: GanttItem) => item.children && item.children.length > 0;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden flex flex-col" style={{ height: "calc(100vh - 260px)", minHeight: 400 }}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E2E8F0] bg-[#F8FAFC] shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold text-[#0F172A]">Gantt Chart</h3>
          <span className="text-[11px] text-[#94A3B8]">{visibleItems.length} items</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex gap-0.5 bg-white rounded-lg border border-[#E2E8F0] p-0.5">
            {(["day", "week", "month"] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                  zoom === z
                    ? "bg-[#2E86C1] text-white shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9]"
                }`}
              >
                {z.charAt(0).toUpperCase() + z.slice(1)}
              </button>
            ))}
          </div>
          {/* Today button */}
          <button
            onClick={() => {
              if (scrollRef.current) {
                const containerWidth = scrollRef.current.clientWidth;
                scrollRef.current.scrollLeft = Math.max(0, todayOffset * dayWidth - containerWidth / 3);
              }
            }}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#EBF5FB] text-[#2E86C1] border border-[#BFDBFE] hover:bg-[#BFDBFE] transition-colors"
          >
            Today
          </button>
          {/* Expand/Collapse all */}
          <button
            onClick={() => {
              const allWithChildren = items.filter((i) => i.children && i.children.length > 0).map((i) => i.id);
              if (collapsed.size > 0) {
                setCollapsed(new Set());
              } else {
                setCollapsed(new Set(allWithChildren));
              }
            }}
            className="px-2.5 py-1 text-[11px] font-medium rounded-lg text-[#64748B] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors"
          >
            {collapsed.size > 0 ? "Expand All" : "Collapse All"}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Task list */}
        <div className="shrink-0 border-r border-[#E2E8F0] flex flex-col" style={{ width: LABEL_WIDTH }}>
          {/* Header */}
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 flex items-center" style={{ height: HEADER_HEIGHT }}>
            <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Task</span>
          </div>
          {/* Task list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={(e) => {
            // Sync vertical scroll with the right panel
            const target = e.currentTarget;
            if (scrollRef.current) {
              scrollRef.current.scrollTop = target.scrollTop;
            }
          }}>
            <div style={{ height: totalHeight }}>
              {visibleItems.map((item, idx) => {
                const isHovered = hoveredRow === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-1.5 px-2 border-b border-[#F8FAFC] cursor-pointer transition-colors ${
                      isHovered ? "bg-[#F1F5F9]" : "hover:bg-[#FAFBFC]"
                    }`}
                    style={{ height: TOTAL_ROW, paddingLeft: 8 + item.level * 16 }}
                    onMouseEnter={() => setHoveredRow(item.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    onClick={() => {
                      if (item.type !== "milestone") {
                        router.push(`/projects/${projectId}/items/${item.id}`);
                      }
                    }}
                  >
                    {/* Collapse toggle */}
                    {hasChildren(item) ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCollapse(item.id); }}
                        className="w-4 h-4 flex items-center justify-center text-[#94A3B8] hover:text-[#334155] shrink-0"
                      >
                        <svg
                          className={`w-3 h-3 transition-transform ${collapsed.has(item.id) ? "" : "rotate-90"}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ) : (
                      <div className="w-4 shrink-0" />
                    )}

                    {/* Type badge */}
                    <span
                      className="text-[9px] font-bold rounded px-1 py-0.5 shrink-0"
                      style={{ color: typeColor(item.type), backgroundColor: typeColor(item.type) + "18" }}
                    >
                      {typeLabel(item.type)}
                    </span>

                    {/* Title */}
                    <span className="text-[12px] text-[#334155] truncate flex-1 font-medium">
                      {item.taskKey ? <span className="text-[#94A3B8] mr-1">{item.taskKey}</span> : null}
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right panel: Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline header */}
          <div
            ref={headerScrollRef}
            className="border-b border-[#E2E8F0] bg-[#F8FAFC] overflow-hidden shrink-0"
            style={{ height: HEADER_HEIGHT }}
          >
            <div style={{ width: totalWidth, position: "relative", height: HEADER_HEIGHT }}>
              {/* Top row */}
              <div className="flex" style={{ height: 26 }}>
                {dateHeaders.topRow.map((h, i) => (
                  <div
                    key={i}
                    className="shrink-0 flex items-center justify-center text-[10px] font-semibold text-[#64748B] border-r border-[#E2E8F0] overflow-hidden"
                    style={{ width: h.width, position: "absolute", left: h.x }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>
              {/* Bottom row */}
              <div className="flex" style={{ height: 28, position: "absolute", top: 26 }}>
                {dateHeaders.bottomRow.map((h, i) => (
                  <div
                    key={i}
                    className={`shrink-0 flex items-center justify-center text-[9px] font-medium border-r border-[#F1F5F9] overflow-hidden ${
                      ("isToday" in h && h.isToday) ? "text-[#2E86C1] font-bold" :
                      ("isWeekend" in h && h.isWeekend) ? "text-[#CBD5E1]" :
                      "text-[#94A3B8]"
                    }`}
                    style={{ width: h.width, position: "absolute", left: h.x }}
                  >
                    {h.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chart area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-auto"
            onScroll={handleScroll}
          >
            <svg
              width={totalWidth}
              height={Math.max(totalHeight, 200)}
              className="select-none"
            >
              {/* Weekend shading */}
              {weekendColumns.map((col, i) => (
                <rect
                  key={`we-${i}`}
                  x={col.x}
                  y={0}
                  width={col.width}
                  height={totalHeight}
                  fill="#F8FAFC"
                />
              ))}

              {/* Row backgrounds */}
              {visibleItems.map((item, idx) => (
                <rect
                  key={`row-${item.id}`}
                  x={0}
                  y={idx * TOTAL_ROW}
                  width={totalWidth}
                  height={TOTAL_ROW}
                  fill={hoveredRow === item.id ? "#F1F5F9" : "transparent"}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredRow(item.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                />
              ))}

              {/* Row separators */}
              {visibleItems.map((_, idx) => (
                <line
                  key={`sep-${idx}`}
                  x1={0}
                  y1={(idx + 1) * TOTAL_ROW}
                  x2={totalWidth}
                  y2={(idx + 1) * TOTAL_ROW}
                  stroke="#F8FAFC"
                  strokeWidth={1}
                />
              ))}

              {/* Today line */}
              {todayOffset >= 0 && todayOffset < totalDays && (
                <>
                  <line
                    x1={todayOffset * dayWidth + dayWidth / 2}
                    y1={0}
                    x2={todayOffset * dayWidth + dayWidth / 2}
                    y2={totalHeight}
                    stroke="#EF4444"
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    opacity={0.7}
                  />
                  <circle
                    cx={todayOffset * dayWidth + dayWidth / 2}
                    cy={0}
                    r={4}
                    fill="#EF4444"
                  />
                </>
              )}

              {/* Dependency arrows */}
              {dependencyPaths.map(({ d, isBlocking, key }) => (
                <g key={key}>
                  <path
                    d={d}
                    fill="none"
                    stroke={isBlocking ? "#EF4444" : "#94A3B8"}
                    strokeWidth={1.5}
                    opacity={0.6}
                    markerEnd={`url(#arrow-${isBlocking ? "red" : "gray"})`}
                  />
                </g>
              ))}

              {/* Arrow markers */}
              <defs>
                <marker id="arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
                </marker>
                <marker id="arrow-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
                </marker>
              </defs>

              {/* Milestone diamonds */}
              {milestones.map((m) => {
                const mDay = diffDays(timelineStart, startOfDay(m.targetDate));
                if (mDay < 0 || mDay >= totalDays) return null;
                const mx = mDay * dayWidth + dayWidth / 2;
                // Place milestones after all task rows
                const my = totalHeight + 10;
                return null; // Rendered inline below with task bars
              })}

              {/* Task bars */}
              {visibleItems.map((item, idx) => {
                const startDay = diffDays(timelineStart, startOfDay(item.startDate));
                const endDay = diffDays(timelineStart, startOfDay(item.endDate));
                const barX = startDay * dayWidth;
                const barW = Math.max(dayWidth, (endDay - startDay) * dayWidth);
                const barY = idx * TOTAL_ROW + BAR_Y_OFFSET;
                const barColor = statusBarColors[item.status] || "#94A3B8";
                const bgColor = statusBgColors[item.status] || "#F1F5F9";

                if (item.type === "milestone") {
                  // Diamond shape
                  const cx = barX + dayWidth / 2;
                  const cy = barY + BAR_HEIGHT / 2;
                  const size = 8;
                  return (
                    <g
                      key={item.id}
                      className="cursor-pointer"
                      onMouseEnter={(e) => {
                        setHoveredRow(item.id);
                        setTooltip({ item, x: e.clientX, y: e.clientY });
                      }}
                      onMouseLeave={() => { setHoveredRow(null); setTooltip(null); }}
                    >
                      <polygon
                        points={`${cx},${cy - size} ${cx + size},${cy} ${cx},${cy + size} ${cx - size},${cy}`}
                        fill={item.status === "completed" ? "#10B981" : item.status === "missed" ? "#EF4444" : "#EC4899"}
                        stroke="white"
                        strokeWidth={1.5}
                      />
                      {/* Label */}
                      <text
                        x={cx + size + 6}
                        y={cy + 4}
                        className="text-[10px] font-medium"
                        fill="#64748B"
                      >
                        {item.title}
                      </text>
                    </g>
                  );
                }

                // Epic/parent bars are taller and semi-transparent
                const isParent = hasChildren(item);
                const effectiveBarH = isParent ? BAR_HEIGHT - 4 : BAR_HEIGHT;
                const effectiveBarY = isParent ? barY + 2 : barY;

                return (
                  <g
                    key={item.id}
                    className="cursor-pointer"
                    onMouseEnter={(e) => {
                      setHoveredRow(item.id);
                      setTooltip({ item, x: e.clientX, y: e.clientY });
                    }}
                    onMouseLeave={() => { setHoveredRow(null); setTooltip(null); }}
                    onClick={() => router.push(`/projects/${projectId}/items/${item.id}`)}
                  >
                    {/* Background bar */}
                    <rect
                      x={barX}
                      y={effectiveBarY}
                      width={barW}
                      height={effectiveBarH}
                      rx={isParent ? 2 : 4}
                      fill={bgColor}
                      stroke={hoveredRow === item.id ? barColor : "transparent"}
                      strokeWidth={1.5}
                    />

                    {/* Progress fill */}
                    {item.progress > 0 && (
                      <rect
                        x={barX}
                        y={effectiveBarY}
                        width={Math.max(0, barW * (item.progress / 100))}
                        height={effectiveBarH}
                        rx={isParent ? 2 : 4}
                        fill={barColor}
                        opacity={0.85}
                      />
                    )}

                    {/* Epic bracket decorations */}
                    {isParent && (
                      <>
                        <rect x={barX} y={effectiveBarY} width={3} height={effectiveBarH} rx={1} fill={barColor} />
                        <rect x={barX + barW - 3} y={effectiveBarY} width={3} height={effectiveBarH} rx={1} fill={barColor} />
                      </>
                    )}

                    {/* Bar label (visible if bar is wide enough) */}
                    {barW > 60 && (
                      <text
                        x={barX + 8}
                        y={effectiveBarY + effectiveBarH / 2 + 4}
                        className="text-[10px] font-medium pointer-events-none"
                        fill={item.progress > 30 ? "white" : "#334155"}
                        clipPath={`inset(0 0 0 0)`}
                      >
                        {item.title.length > Math.floor(barW / 7) ? item.title.slice(0, Math.floor(barW / 7)) + "..." : item.title}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Milestone markers on timeline */}
              {milestones.map((m) => {
                const mDay = diffDays(timelineStart, startOfDay(m.targetDate));
                if (mDay < 0 || mDay >= totalDays) return null;
                const mx = mDay * dayWidth + dayWidth / 2;
                return (
                  <g key={`ms-${m.id}`}>
                    <line
                      x1={mx}
                      y1={0}
                      x2={mx}
                      y2={totalHeight}
                      stroke={m.status === "completed" ? "#10B981" : "#EC4899"}
                      strokeWidth={1}
                      strokeDasharray="4 4"
                      opacity={0.5}
                    />
                    <polygon
                      points={`${mx},${6} ${mx + 6},${12} ${mx},${18} ${mx - 6},${12}`}
                      fill={m.status === "completed" ? "#10B981" : m.status === "missed" ? "#EF4444" : "#EC4899"}
                      stroke="white"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[9999] pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
        >
          <div className="bg-[#0F172A] text-white rounded-lg shadow-xl px-3 py-2.5 max-w-xs">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-[9px] font-bold rounded px-1 py-0.5"
                style={{ color: "white", backgroundColor: typeColor(tooltip.item.type) }}
              >
                {typeLabel(tooltip.item.type)}
              </span>
              <span className="text-[11px] font-semibold truncate">{tooltip.item.title}</span>
            </div>
            <div className="space-y-0.5 text-[10px] text-[#CBD5E1]">
              <div className="flex justify-between gap-4">
                <span>Start:</span>
                <span className="text-white">{formatDate(tooltip.item.startDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>End:</span>
                <span className="text-white">{formatDate(tooltip.item.endDate)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Status:</span>
                <span className="text-white capitalize">{tooltip.item.status.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Progress:</span>
                <span className="text-white">{tooltip.item.progress}%</span>
              </div>
              {tooltip.item.assigneeName && (
                <div className="flex justify-between gap-4">
                  <span>Assignee:</span>
                  <span className="text-white">{tooltip.item.assigneeName}</span>
                </div>
              )}
              {tooltip.item.priority && (
                <div className="flex justify-between gap-4">
                  <span>Priority:</span>
                  <span className="text-white capitalize">{tooltip.item.priority}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
