/**
 * TaskPublicApi — what other modules can ask task for.
 *
 * Today's known consumers:
 *   - project: counts open tasks per project for the project list view.
 *   - notification: subscribes to 'task.assigned' / 'task.due-soon' events.
 *
 * Most callers care about the events (re-exported below), not the
 * methods.
 */
export interface TaskSummary {
  _id: string;
  organizationId: string;
  title: string;
  status: string;
  assigneeId: string | null;
  projectId: string | null;
  dueDate: Date | null;
}

export interface TaskPublicApi {
  /** Count open (non-done, non-cancelled) tasks for a project. */
  countOpenTasksForProject(organizationId: string, projectId: string): Promise<number>;
  /** Lightweight task summary by id. */
  getTaskById(organizationId: string, taskId: string): Promise<TaskSummary | null>;
}

export const TASK_PUBLIC_API = Symbol('TASK_PUBLIC_API');
