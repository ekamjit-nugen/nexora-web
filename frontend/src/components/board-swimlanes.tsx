"use client";

import { useState } from "react";
import { Task, Employee } from "@/lib/api";

interface BoardSwimlaneProps {
  tasks: Task[];
  board: any;
  columns: any[];
  employees: Employee[];
  groupBy: "assignee" | "priority" | "type" | "none";
  onDragStart?: (e: React.DragEvent, task: Task) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, column: any) => void;
  TaskCard: React.ComponentType<any>;
}

export function BoardSwimlanes({
  tasks,
  board,
  columns,
  employees,
  groupBy,
  onDragStart,
  onDragOver,
  onDrop,
  TaskCard,
}: BoardSwimlaneProps) {
  const [expandedSwimlanes, setExpandedSwimlanes] = useState<Set<string>>(new Set(["all"]));

  const toggleSwimlanExpand = (key: string) => {
    const next = new Set(expandedSwimlanes);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedSwimlanes(next);
  };

  const getSwimlanes = (): Array<{ key: string; label: string; tasks: Task[] }> => {
    if (groupBy === "none") {
      return [{ key: "all", label: "All Tasks", tasks }];
    }

    const swimlaneMap: Record<string, Task[]> = {};

    if (groupBy === "assignee") {
      // Group by assignee
      employees.forEach((emp) => {
        const uid = emp.userId || emp._id;
        const name = `${emp.firstName} ${emp.lastName}`;
        swimlaneMap[uid] = tasks.filter((t) => t.assigneeId === uid);
      });
      // Add unassigned
      const unassigned = tasks.filter((t) => !t.assigneeId);
      if (unassigned.length > 0) {
        swimlaneMap["unassigned"] = unassigned;
      }
    } else if (groupBy === "priority") {
      const priorities = ["critical", "high", "medium", "low", "trivial"];
      priorities.forEach((p) => {
        swimlaneMap[p] = tasks.filter((t) => t.priority === p);
      });
    } else if (groupBy === "type") {
      const types = ["epic", "story", "task", "sub_task", "bug", "improvement", "spike"];
      types.forEach((t) => {
        swimlaneMap[t] = tasks.filter((task) => task.type === t);
      });
    }

    return Object.entries(swimlaneMap)
      .filter(([, swimTasks]) => swimTasks.length > 0)
      .map(([key, swimTasks]) => ({
        key,
        label: getLabelForKey(key, groupBy, employees),
        tasks: swimTasks,
      }));
  };

  const getLabelForKey = (key: string, groupBy: string, employees: Employee[]): string => {
    if (groupBy === "assignee") {
      if (key === "unassigned") return "Unassigned";
      const emp = employees.find((e) => (e.userId || e._id) === key);
      return emp ? `${emp.firstName} ${emp.lastName}` : key;
    } else if (groupBy === "priority") {
      return key.charAt(0).toUpperCase() + key.slice(1);
    } else if (groupBy === "type") {
      return key.replace(/_/g, " ").toUpperCase();
    }
    return key;
  };

  const swimlanes = getSwimlanes();

  const getColumnTasks = (column: any, swimlane: any) => {
    const mapping = column.statusMapping;
    const statusKeys: string[] = Array.isArray(mapping)
      ? mapping
      : mapping
        ? [mapping]
        : column.key
          ? [column.key]
          : [];
    return swimlane.tasks.filter((t: Task) => {
      const matchesCol = t.columnId && (column._id || column.id)
        ? t.columnId === (column._id || column.id)
        : statusKeys.includes(t.status);
      return matchesCol;
    });
  };

  if (groupBy === "none") {
    // No swimlanes, return null and let parent handle normal board layout
    return null;
  }

  return (
    <div className="space-y-3">
      {swimlanes.map((swimlane) => {
        const isExpanded = expandedSwimlanes.has(swimlane.key);
        const taskCount = swimlane.tasks.length;

        return (
          <div key={swimlane.key} className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            {/* Swimlane Header */}
            <button
              onClick={() => toggleSwimlanExpand(swimlane.key)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors text-left"
            >
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} text-[#475569]`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-semibold text-[13px] text-[#0F172A]">{swimlane.label}</span>
              <span className="ml-auto text-[11px] font-medium text-[#94A3B8] bg-white px-2 py-0.5 rounded-full">
                {taskCount} item{taskCount !== 1 ? "s" : ""}
              </span>
            </button>

            {/* Swimlane Content - Kanban columns */}
            {isExpanded && (
              <div className="overflow-x-auto">
                <div className="flex gap-4 p-4 min-w-full">
                  {columns.map((column: any) => {
                    const columnTasks = getColumnTasks(column, swimlane);
                    return (
                      <div key={column._id || column.key} className="flex-shrink-0 w-80">
                        <div className="mb-2 px-2 py-1 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]">
                          <h3 className="text-[12px] font-semibold text-[#475569]">{column.name}</h3>
                          <p className="text-[10px] text-[#94A3B8]">{columnTasks.length} items</p>
                        </div>

                        <div
                          onDragOver={onDragOver}
                          onDrop={(e) => onDrop?.(e, column)}
                          className="space-y-2 min-h-20 bg-gradient-to-br from-[#F8FAFC] to-[#F1F5F9] rounded-lg p-2 border-2 border-dashed border-[#E2E8F0] hover:border-[#CBD5E1] transition-colors"
                        >
                          {columnTasks.map((task: Task) => (
                            <TaskCard
                              key={task._id}
                              task={task}
                              draggable
                              onDragStart={(e: React.DragEvent) => onDragStart?.(e, task)}
                            />
                          ))}
                          {columnTasks.length === 0 && (
                            <div className="text-center py-8">
                              <p className="text-[11px] text-[#94A3B8]">No items</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
