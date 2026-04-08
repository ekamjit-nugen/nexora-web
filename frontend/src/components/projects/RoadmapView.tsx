"use client";

import { useState, useMemo, useRef, useCallback } from "react";

// ── Types ──

export interface RoadmapMilestone {
  _id: string;
  name: string;
  targetDate: string;
  completedDate?: string;
  status: "pending" | "in_progress" | "completed" | "missed";
  description?: string;
  phase?: string;
  deliverables?: string[];
  projectId?: string;
  projectName?: string;
}

export interface RoadmapRelease {
  _id: string;
  name: string;
  status: "planned" | "in_progress" | "released" | "archived";
  startDate?: string;
  releaseDate?: string;
  releasedDate?: string;
  description?: string;
  projectId?: string;
  projectName?: string;
}

export interface RoadmapEpic {
  _id: string;
  title: string;
  status: string;
  createdAt?: string;
  dueDate?: string;
  projectId: string;
  projectName?: string;
  childTotal?: number;
  childDone?: number;
}

export interface RoadmapProject {
  _id: string;
  projectName: string;
  milestones: RoadmapMilestone[];
  releases: RoadmapRelease[];
  epics: RoadmapEpic[];
}

export type ZoomLevel = "month" | "quarter" | "year";

interface RoadmapViewProps {
  projects: RoadmapProject[];
  mode?: "single" | "portfolio";
  onEpicClick?: (epicId: string, projectId: string) => void;
}

// ── Date helpers (no external deps) ──

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86400000);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1);
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3 + 2;
  return new Date(d.getFullYear(), q + 1, 0);
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

function endOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 11, 31);
}

function getQuarterLabel(d: Date): string {
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}

function getMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Color constants ──

const MILESTONE_COLORS: Record<string, string> = {
  completed: "#10B981",
  in_progress: "#3B82F6",
  pending: "#F59E0B",
  missed: "#EF4444",
};

const RELEASE_COLORS: Record<string, string> = {
  planned: "#94A3B8",
  in_progress: "#3B82F6",
  released: "#10B981",
  archived: "#64748B",
};

function epicProgressColor(pct: number): string {
  if (pct >= 80) return "#10B981";
  if (pct >= 40) return "#3B82F6";
  return "#94A3B8";
}

// ── Constants ──

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 32;
const GROUP_GAP = 16;
const LABEL_WIDTH = 220;
const MIN_BAR_WIDTH = 24;

// ── Component ──

export default function RoadmapView({ projects, mode = "single", onEpicClick }: RoadmapViewProps) {
  const [zoom, setZoom] = useState<ZoomLevel>("quarter");
  const [popover, setPopover] = useState<{ x: number; y: number; content: React.ReactNode } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Compute the visible time range ──
  const { rangeStart, rangeEnd, totalDays, columns } = useMemo(() => {
    const now = new Date();
    let rs: Date, re: Date;

    if (zoom === "month") {
      // Current month -1 to +5
      rs = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      re = endOfMonth(new Date(now.getFullYear(), now.getMonth() + 5, 1));
    } else if (zoom === "year") {
      rs = startOfYear(new Date(now.getFullYear() - 1, 0, 1));
      re = endOfYear(new Date(now.getFullYear() + 1, 0, 1));
    } else {
      // quarter: current quarter -1 to +3
      const qStart = startOfQuarter(now);
      rs = startOfQuarter(new Date(qStart.getFullYear(), qStart.getMonth() - 3, 1));
      re = endOfQuarter(new Date(qStart.getFullYear(), qStart.getMonth() + 9, 1));
    }

    const td = diffDays(re, rs) + 1;

    // Build column headers
    const cols: Array<{ label: string; startDay: number; widthFraction: number }> = [];
    if (zoom === "month") {
      let cursor = new Date(rs);
      while (cursor <= re) {
        const mStart = startOfMonth(cursor);
        const mEnd = endOfMonth(cursor);
        const colStartDay = Math.max(0, diffDays(mStart, rs));
        const colEndDay = Math.min(td, diffDays(mEnd, rs) + 1);
        cols.push({
          label: getMonthLabel(mStart),
          startDay: colStartDay,
          widthFraction: (colEndDay - colStartDay) / td,
        });
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      }
    } else if (zoom === "year") {
      let cursor = new Date(rs);
      while (cursor <= re) {
        const yStart = startOfYear(cursor);
        const yEnd = endOfYear(cursor);
        const colStartDay = Math.max(0, diffDays(yStart, rs));
        const colEndDay = Math.min(td, diffDays(yEnd, rs) + 1);
        cols.push({
          label: `${cursor.getFullYear()}`,
          startDay: colStartDay,
          widthFraction: (colEndDay - colStartDay) / td,
        });
        cursor = new Date(cursor.getFullYear() + 1, 0, 1);
      }
    } else {
      // quarter
      let cursor = new Date(rs);
      while (cursor <= re) {
        const qStart = startOfQuarter(cursor);
        const qEnd = endOfQuarter(cursor);
        const colStartDay = Math.max(0, diffDays(qStart, rs));
        const colEndDay = Math.min(td, diffDays(qEnd, rs) + 1);
        cols.push({
          label: getQuarterLabel(qStart),
          startDay: colStartDay,
          widthFraction: (colEndDay - colStartDay) / td,
        });
        cursor = new Date(qStart.getFullYear(), qStart.getMonth() + 3, 1);
      }
    }

    return { rangeStart: rs, rangeEnd: re, totalDays: td, columns: cols };
  }, [zoom]);

  // ── Today marker position ──
  const todayFraction = useMemo(() => {
    const now = startOfDay(new Date());
    const d = diffDays(now, rangeStart);
    if (d < 0 || d > totalDays) return null;
    return d / totalDays;
  }, [rangeStart, totalDays]);

  // ── Build swimlane rows ──
  const { rows, totalHeight } = useMemo(() => {
    const allRows: Array<{
      type: "header" | "milestone" | "release" | "epic";
      label: string;
      sublabel?: string;
      height: number;
      data?: RoadmapMilestone | RoadmapRelease | RoadmapEpic;
      projectId?: string;
      projectName?: string;
    }> = [];

    const addProjectRows = (p: RoadmapProject) => {
      if (mode === "portfolio") {
        allRows.push({ type: "header", label: p.projectName, height: HEADER_HEIGHT + 4 });
      }

      // Milestones
      if (p.milestones.length > 0) {
        allRows.push({ type: "header", label: "Milestones", height: HEADER_HEIGHT });
        for (const m of p.milestones) {
          allRows.push({
            type: "milestone",
            label: m.name,
            height: ROW_HEIGHT,
            data: m,
            projectId: m.projectId || p._id,
            projectName: m.projectName || p.projectName,
          });
        }
      }

      // Releases
      if (p.releases.length > 0) {
        allRows.push({ type: "header", label: "Releases", height: HEADER_HEIGHT });
        for (const r of p.releases) {
          allRows.push({
            type: "release",
            label: r.name,
            height: ROW_HEIGHT,
            data: r,
            projectId: r.projectId || p._id,
            projectName: r.projectName || p.projectName,
          });
        }
      }

      // Epics
      if (p.epics.length > 0) {
        allRows.push({ type: "header", label: "Epics", height: HEADER_HEIGHT });
        for (const e of p.epics) {
          allRows.push({
            type: "epic",
            label: e.title,
            height: ROW_HEIGHT,
            data: e,
            projectId: e.projectId || p._id,
            projectName: e.projectName || p.projectName,
          });
        }
      }

      // Gap between projects in portfolio mode
      if (mode === "portfolio") {
        allRows.push({ type: "header", label: "", height: GROUP_GAP });
      }
    };

    for (const p of projects) {
      addProjectRows(p);
    }

    // In single mode, add a final gap
    if (mode === "single" && allRows.length > 0) {
      allRows.push({ type: "header", label: "", height: GROUP_GAP });
    }

    let h = 0;
    for (const row of allRows) {
      h += row.height;
    }

    return { rows: allRows, totalHeight: h };
  }, [projects, mode]);

  // ── Position helper ──
  const getXFraction = useCallback(
    (dateStr: string) => {
      const d = startOfDay(new Date(dateStr));
      return diffDays(d, rangeStart) / totalDays;
    },
    [rangeStart, totalDays]
  );

  const getWidthFraction = useCallback(
    (startStr: string, endStr: string) => {
      const s = startOfDay(new Date(startStr));
      const e = startOfDay(new Date(endStr));
      return Math.max(diffDays(e, s), 1) / totalDays;
    },
    [totalDays]
  );

  // ── Popover handlers ──
  const showPopover = useCallback(
    (e: React.MouseEvent, content: React.ReactNode) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setPopover({ x, y, content });
    },
    []
  );

  const hidePopover = useCallback(() => setPopover(null), []);

  // ── Render ──

  return (
    <div ref={containerRef} className="relative" onClick={hidePopover}>
      {/* Legend + Zoom controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        {/* Status legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-[11px] font-semibold text-[#475569] uppercase tracking-wide">Legend</span>
          <div className="flex items-center gap-3">
            {(["completed", "in_progress", "pending", "missed"] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: MILESTONE_COLORS[s] }} />
                <span className="text-[11px] text-[#64748B] capitalize">{s.replace("_", " ")}</span>
              </div>
            ))}
          </div>
          <div className="w-px h-4 bg-[#E2E8F0]" />
          <div className="flex items-center gap-3">
            {(["planned", "in_progress", "released"] as const).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className="w-6 h-2 rounded-sm" style={{ backgroundColor: RELEASE_COLORS[s] }} />
                <span className="text-[11px] text-[#64748B] capitalize">{s.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zoom selector */}
        <div className="flex gap-0.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] p-1">
          {(["month", "quarter", "year"] as const).map((z) => (
            <button
              key={z}
              onClick={() => setZoom(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                zoom === z
                  ? "bg-white text-[#2E86C1] shadow-sm border border-[#E2E8F0]"
                  : "text-[#64748B] hover:text-[#334155] hover:bg-white/60"
              }`}
            >
              {z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Main roadmap area */}
      <div className="border border-[#E2E8F0] rounded-xl bg-white overflow-hidden">
        {/* Scrollable wrapper */}
        <div ref={scrollRef} className="overflow-x-auto" style={{ minWidth: 0 }}>
          <div style={{ minWidth: Math.max(900, columns.length * 200) }}>
            {/* Column headers */}
            <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] sticky top-0 z-10">
              {/* Label column */}
              <div
                className="shrink-0 border-r border-[#E2E8F0] flex items-center px-4 text-[11px] font-semibold text-[#475569] uppercase tracking-wide"
                style={{ width: LABEL_WIDTH, height: HEADER_HEIGHT + 8 }}
              >
                {mode === "portfolio" ? "Projects / Items" : "Items"}
              </div>
              {/* Time columns */}
              <div className="flex-1 flex relative" style={{ height: HEADER_HEIGHT + 8 }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-center text-[11px] font-semibold text-[#475569] border-r border-[#E2E8F0] last:border-r-0 ${
                      i % 2 === 0 ? "bg-[#F8FAFC]" : "bg-[#F1F5F9]"
                    }`}
                    style={{ width: `${col.widthFraction * 100}%` }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Background columns for alternating shading */}
              <div className="absolute inset-0 flex" style={{ left: LABEL_WIDTH }}>
                {columns.map((col, i) => (
                  <div
                    key={i}
                    className={`border-r border-[#F1F5F9] last:border-r-0 ${
                      i % 2 === 0 ? "" : "bg-[#FAFBFC]"
                    }`}
                    style={{ width: `${col.widthFraction * 100}%`, height: totalHeight }}
                  />
                ))}
              </div>

              {/* Today marker */}
              {todayFraction !== null && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none"
                  style={{
                    left: `calc(${LABEL_WIDTH}px + (100% - ${LABEL_WIDTH}px) * ${todayFraction})`,
                    width: 0,
                  }}
                >
                  <div
                    className="absolute top-0 w-0.5 bg-red-500 opacity-60"
                    style={{
                      height: totalHeight,
                      left: 0,
                      transform: "translateX(-50%)",
                    }}
                  />
                  <div
                    className="absolute -top-1 w-3 h-3 bg-red-500 rounded-full"
                    style={{ left: 0, transform: "translateX(-50%)" }}
                  />
                </div>
              )}

              {/* Data rows */}
              {(() => {
                let yOffset = 0;
                return rows.map((row, idx) => {
                  const y = yOffset;
                  yOffset += row.height;

                  if (row.type === "header") {
                    if (!row.label) return <div key={idx} style={{ height: row.height }} />;
                    const isProjectHeader = mode === "portfolio" && row.height > HEADER_HEIGHT;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center border-b ${
                          isProjectHeader
                            ? "bg-[#EBF5FB] border-[#BFDBFE]"
                            : "bg-[#F8FAFC] border-[#F1F5F9]"
                        }`}
                        style={{ height: row.height }}
                      >
                        <div
                          className="shrink-0 px-4 flex items-center"
                          style={{ width: LABEL_WIDTH }}
                        >
                          <span
                            className={`text-[11px] font-semibold uppercase tracking-wide ${
                              isProjectHeader ? "text-[#2E86C1] text-xs" : "text-[#94A3B8]"
                            }`}
                          >
                            {row.label}
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Data row
                  return (
                    <div
                      key={idx}
                      className="flex items-center border-b border-[#F1F5F9] hover:bg-[#F8FAFC]/60 transition-colors"
                      style={{ height: row.height }}
                    >
                      {/* Label */}
                      <div
                        className="shrink-0 px-4 flex items-center gap-2 sticky left-0 bg-white z-10 border-r border-[#F1F5F9]"
                        style={{ width: LABEL_WIDTH, height: row.height }}
                      >
                        {row.type === "milestone" && (
                          <div
                            className="w-2.5 h-2.5 rotate-45 shrink-0"
                            style={{
                              backgroundColor:
                                MILESTONE_COLORS[(row.data as RoadmapMilestone).status] || "#94A3B8",
                            }}
                          />
                        )}
                        {row.type === "release" && (
                          <div
                            className="w-3 h-1.5 rounded-sm shrink-0"
                            style={{
                              backgroundColor:
                                RELEASE_COLORS[(row.data as RoadmapRelease).status] || "#94A3B8",
                            }}
                          />
                        )}
                        {row.type === "epic" && (
                          <svg
                            className="w-3.5 h-3.5 shrink-0 text-purple-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={1.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                        )}
                        <span className="text-[12px] text-[#334155] truncate" title={row.label}>
                          {row.label}
                        </span>
                        {mode === "portfolio" && row.projectName && (
                          <span className="text-[10px] text-[#94A3B8] truncate ml-auto">
                            {row.projectName}
                          </span>
                        )}
                      </div>

                      {/* Timeline area */}
                      <div className="flex-1 relative" style={{ height: row.height }}>
                        {row.type === "milestone" && row.data && (
                          <MilestoneMarker
                            milestone={row.data as RoadmapMilestone}
                            getXFraction={getXFraction}
                            onHover={showPopover}
                            onLeave={hidePopover}
                          />
                        )}
                        {row.type === "release" && row.data && (
                          <ReleaseBar
                            release={row.data as RoadmapRelease}
                            getXFraction={getXFraction}
                            getWidthFraction={getWidthFraction}
                            onHover={showPopover}
                            onLeave={hidePopover}
                          />
                        )}
                        {row.type === "epic" && row.data && (
                          <EpicBar
                            epic={row.data as RoadmapEpic}
                            getXFraction={getXFraction}
                            getWidthFraction={getWidthFraction}
                            onClick={onEpicClick}
                            onHover={showPopover}
                            onLeave={hidePopover}
                          />
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <div
          className="absolute z-50 bg-white border border-[#E2E8F0] rounded-xl shadow-lg p-3 max-w-xs pointer-events-none"
          style={{
            left: Math.min(popover.x + 12, (containerRef.current?.clientWidth || 600) - 280),
            top: popover.y - 8,
          }}
        >
          {popover.content}
        </div>
      )}

      {/* Empty state */}
      {projects.length === 0 ||
      projects.every((p) => p.milestones.length === 0 && p.releases.length === 0 && p.epics.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#F1F5F9] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-[#334155] mb-1">No roadmap data</h3>
          <p className="text-[13px] text-[#94A3B8]">
            Add milestones, releases, or epics to see your roadmap here.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ── Sub-components ──

function MilestoneMarker({
  milestone,
  getXFraction,
  onHover,
  onLeave,
}: {
  milestone: RoadmapMilestone;
  getXFraction: (d: string) => number;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const x = getXFraction(milestone.targetDate);
  const color = MILESTONE_COLORS[milestone.status] || "#94A3B8";

  if (x < -0.05 || x > 1.05) return null;

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-125"
      style={{ left: `${x * 100}%`, transform: "translate(-50%, -50%)" }}
      onMouseEnter={(e) =>
        onHover(
          e,
          <div>
            <div className="font-semibold text-[13px] text-[#0F172A] mb-1">{milestone.name}</div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-[#64748B] capitalize">
                {milestone.status.replace("_", " ")}
              </span>
            </div>
            <div className="text-[11px] text-[#64748B]">
              Target: {formatDate(new Date(milestone.targetDate))}
            </div>
            {milestone.completedDate && (
              <div className="text-[11px] text-[#10B981]">
                Completed: {formatDate(new Date(milestone.completedDate))}
              </div>
            )}
            {milestone.phase && (
              <div className="text-[11px] text-[#64748B] mt-1">Phase: {milestone.phase}</div>
            )}
            {milestone.deliverables && milestone.deliverables.length > 0 && (
              <div className="mt-1">
                <div className="text-[10px] font-semibold text-[#475569] uppercase">Deliverables</div>
                {milestone.deliverables.map((d, i) => (
                  <div key={i} className="text-[11px] text-[#64748B]">
                    - {d}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }
      onMouseLeave={onLeave}
    >
      <div
        className="w-4 h-4 rotate-45 border-2 border-white shadow-sm"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function ReleaseBar({
  release,
  getXFraction,
  getWidthFraction,
  onHover,
  onLeave,
}: {
  release: RoadmapRelease;
  getXFraction: (d: string) => number;
  getWidthFraction: (s: string, e: string) => number;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const color = RELEASE_COLORS[release.status] || "#94A3B8";
  const startStr = release.startDate || release.releaseDate;
  const endStr = release.releaseDate || release.releasedDate || release.startDate;

  if (!startStr) return null;

  // If only a single date (no range), show a small marker
  if (startStr === endStr || !endStr) {
    const x = getXFraction(startStr);
    if (x < -0.05 || x > 1.05) return null;
    return (
      <div
        className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
        style={{ left: `${x * 100}%`, transform: "translate(-50%, -50%)" }}
        onMouseEnter={(e) =>
          onHover(
            e,
            <div>
              <div className="font-semibold text-[13px] text-[#0F172A] mb-1">{release.name}</div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-[#64748B] capitalize">
                  {release.status.replace("_", " ")}
                </span>
              </div>
              <div className="text-[11px] text-[#64748B] mt-1">
                Date: {formatDate(new Date(startStr))}
              </div>
            </div>
          )
        }
        onMouseLeave={onLeave}
      >
        <div className="w-5 h-3 rounded-sm" style={{ backgroundColor: color }} />
      </div>
    );
  }

  const xFrac = getXFraction(startStr);
  const wFrac = getWidthFraction(startStr, endStr);

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-md transition-shadow hover:shadow-md flex items-center justify-center overflow-hidden"
      style={{
        left: `${Math.max(xFrac, 0) * 100}%`,
        width: `${Math.max(wFrac, 0.01) * 100}%`,
        minWidth: MIN_BAR_WIDTH,
        height: 20,
        backgroundColor: color,
      }}
      onMouseEnter={(e) =>
        onHover(
          e,
          <div>
            <div className="font-semibold text-[13px] text-[#0F172A] mb-1">{release.name}</div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-3 h-1.5 rounded-sm" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-[#64748B] capitalize">
                {release.status.replace("_", " ")}
              </span>
            </div>
            {release.startDate && (
              <div className="text-[11px] text-[#64748B]">
                Start: {formatDate(new Date(release.startDate))}
              </div>
            )}
            {release.releaseDate && (
              <div className="text-[11px] text-[#64748B]">
                Target: {formatDate(new Date(release.releaseDate))}
              </div>
            )}
            {release.releasedDate && (
              <div className="text-[11px] text-[#10B981]">
                Released: {formatDate(new Date(release.releasedDate))}
              </div>
            )}
            {release.description && (
              <div className="text-[11px] text-[#64748B] mt-1 line-clamp-2">{release.description}</div>
            )}
          </div>
        )
      }
      onMouseLeave={onLeave}
    >
      <span className="text-[10px] font-medium text-white truncate px-1.5">{release.name}</span>
    </div>
  );
}

function EpicBar({
  epic,
  getXFraction,
  getWidthFraction,
  onClick,
  onHover,
  onLeave,
}: {
  epic: RoadmapEpic;
  getXFraction: (d: string) => number;
  getWidthFraction: (s: string, e: string) => number;
  onClick?: (epicId: string, projectId: string) => void;
  onHover: (e: React.MouseEvent, content: React.ReactNode) => void;
  onLeave: () => void;
}) {
  const startStr = epic.createdAt;
  const endStr = epic.dueDate || (startStr ? new Date(new Date(startStr).getTime() + 30 * 86400000).toISOString() : null);

  if (!startStr || !endStr) return null;

  const xFrac = getXFraction(startStr);
  const wFrac = getWidthFraction(startStr, endStr);
  const progress = epic.childTotal && epic.childTotal > 0 ? Math.round((epic.childDone || 0) / epic.childTotal * 100) : 0;
  const progressColor = epicProgressColor(progress);
  const isDone = epic.status === "done";

  return (
    <div
      className="absolute top-1/2 -translate-y-1/2 cursor-pointer rounded-md transition-shadow hover:shadow-md overflow-hidden"
      style={{
        left: `${Math.max(xFrac, 0) * 100}%`,
        width: `${Math.max(wFrac, 0.01) * 100}%`,
        minWidth: MIN_BAR_WIDTH,
        height: 22,
        backgroundColor: "#E2E8F0",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(epic._id, epic.projectId);
      }}
      onMouseEnter={(e) =>
        onHover(
          e,
          <div>
            <div className="font-semibold text-[13px] text-[#0F172A] mb-1">{epic.title}</div>
            <div className="flex items-center gap-1.5 mb-1">
              <svg className="w-3 h-3 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[11px] text-[#64748B] capitalize">
                {epic.status.replace("_", " ")}
              </span>
            </div>
            {epic.childTotal != null && epic.childTotal > 0 && (
              <div className="text-[11px] text-[#64748B]">
                Progress: {epic.childDone || 0}/{epic.childTotal} stories ({progress}%)
              </div>
            )}
            {epic.dueDate && (
              <div className="text-[11px] text-[#64748B]">
                Due: {formatDate(new Date(epic.dueDate))}
              </div>
            )}
          </div>
        )
      }
      onMouseLeave={onLeave}
    >
      {/* Progress fill */}
      <div
        className="h-full rounded-md transition-all"
        style={{
          width: `${isDone ? 100 : progress}%`,
          backgroundColor: isDone ? "#10B981" : progressColor,
          minWidth: progress > 0 ? 4 : 0,
        }}
      />
      {/* Label overlay */}
      <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-medium text-[#334155] truncate">
        {epic.title}
        {progress > 0 && (
          <span className="ml-auto text-[9px] text-[#64748B] shrink-0">{progress}%</span>
        )}
      </span>
    </div>
  );
}
