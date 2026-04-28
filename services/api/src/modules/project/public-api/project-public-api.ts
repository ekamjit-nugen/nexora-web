/**
 * ProjectPublicApi — what other modules can ask project for.
 *
 * Today's known consumers:
 *   - task: link tasks to projects (project lookup at task creation).
 *   - bench (in legacy): show project assignments per employee.
 */
export interface ProjectSummary {
  _id: string;
  organizationId: string;
  name: string;
  status: string;
  clientId: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ProjectPublicApi {
  getProjectById(organizationId: string, projectId: string): Promise<ProjectSummary | null>;
  listActiveProjects(organizationId: string): Promise<ProjectSummary[]>;
}

export const PROJECT_PUBLIC_API = Symbol('PROJECT_PUBLIC_API');
