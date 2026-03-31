"use client";

import { useState } from "react";
import { Task, Employee } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BulkOperationsProps {
  selectedTasks: Set<string>;
  onClearSelection: () => void;
  onBulkUpdate: (updates: {
    status?: string;
    assigneeId?: string;
    priority?: string;
    sprintId?: string;
    addLabels?: string[];
    removeLabels?: string[];
  }) => Promise<void>;
  employees: Employee[];
  sprints?: Array<{ _id: string; name: string }>;
  loading?: boolean;
}

export function BulkOperations({
  selectedTasks,
  onClearSelection,
  onBulkUpdate,
  employees,
  sprints = [],
  loading = false,
}: BulkOperationsProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const statuses = ["backlog", "todo", "in_progress", "in_review", "blocked", "done", "cancelled"];
  const priorities = ["critical", "high", "medium", "low", "trivial"];

  const handleStatusUpdate = async (status: string) => {
    setUpdatingField("status");
    try {
      await onBulkUpdate({ status });
      toast.success(`${selectedTasks.size} tasks updated to ${status}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setUpdatingField(null);
    }
  };

  const handleAssigneeUpdate = async (assigneeId: string) => {
    setUpdatingField("assignee");
    try {
      await onBulkUpdate({ assigneeId });
      const employee = employees.find((e) => (e.userId || e._id) === assigneeId);
      toast.success(`${selectedTasks.size} tasks assigned to ${employee?.firstName} ${employee?.lastName}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update assignee");
    } finally {
      setUpdatingField(null);
    }
  };

  const handlePriorityUpdate = async (priority: string) => {
    setUpdatingField("priority");
    try {
      await onBulkUpdate({ priority });
      toast.success(`${selectedTasks.size} tasks updated to ${priority} priority`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update priority");
    } finally {
      setUpdatingField(null);
    }
  };

  const handleSprintUpdate = async (sprintId: string) => {
    setUpdatingField("sprint");
    try {
      await onBulkUpdate({ sprintId });
      const sprint = sprints.find((s) => s._id === sprintId);
      toast.success(`${selectedTasks.size} tasks moved to ${sprint?.name}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to move to sprint");
    } finally {
      setUpdatingField(null);
    }
  };

  if (selectedTasks.size === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Floating Action Panel */}
      {showPanel && (
        <div className="absolute bottom-16 right-0 bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-4 w-96 space-y-3 animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[13px] text-[#0F172A]">Bulk Operations</h3>
            <button
              onClick={() => setShowPanel(false)}
              className="text-[#94A3B8] hover:text-[#475569]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {/* Status */}
            <div>
              <label className="text-[10px] font-semibold text-[#475569] block mb-1.5">Change Status</label>
              <div className="grid grid-cols-2 gap-1">
                {statuses.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusUpdate(s)}
                    disabled={updatingField === "status" || loading}
                    className="text-[11px] px-2 py-1.5 rounded border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FB] transition-colors disabled:opacity-50"
                  >
                    {s.replace(/_/g, " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label className="text-[10px] font-semibold text-[#475569] block mb-1.5">Change Priority</label>
              <div className="grid grid-cols-3 gap-1">
                {priorities.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePriorityUpdate(p)}
                    disabled={updatingField === "priority" || loading}
                    className="text-[11px] px-2 py-1.5 rounded border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FB] transition-colors disabled:opacity-50"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee */}
            {employees.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-[#475569] block mb-1.5">Assign To</label>
                <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                  {employees.map((emp) => {
                    const uid = emp.userId || emp._id;
                    const initials = `${emp.firstName?.charAt(0) || ""}${emp.lastName?.charAt(0) || ""}`.toUpperCase();
                    return (
                      <button
                        key={uid}
                        onClick={() => handleAssigneeUpdate(uid)}
                        disabled={updatingField === "assignee" || loading}
                        title={`${emp.firstName} ${emp.lastName}`}
                        className="text-[11px] px-2 py-1.5 rounded border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FB] transition-colors disabled:opacity-50"
                      >
                        {initials}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sprint */}
            {sprints.length > 0 && (
              <div>
                <label className="text-[10px] font-semibold text-[#475569] block mb-1.5">Move To Sprint</label>
                <div className="space-y-1">
                  {sprints.map((sprint) => (
                    <button
                      key={sprint._id}
                      onClick={() => handleSprintUpdate(sprint._id)}
                      disabled={updatingField === "sprint" || loading}
                      className="w-full text-left text-[11px] px-2 py-1.5 rounded border border-[#E2E8F0] hover:border-[#2E86C1] hover:bg-[#EBF5FB] transition-colors disabled:opacity-50"
                    >
                      {sprint.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-[#E2E8F0]">
            <button
              onClick={onClearSelection}
              className="flex-1 text-[11px] px-3 py-2 rounded border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors font-medium text-[#475569]"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-2 px-4 py-3 bg-[#2E86C1] text-white rounded-lg shadow-lg hover:bg-[#2471A3] transition-colors font-medium text-[12px]"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 15l-3-3m0 0l-3 3m3-3v4m7-11a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {selectedTasks.size} Selected
      </button>
    </div>
  );
}
