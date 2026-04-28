/**
 * HrPublicApi — the cross-module surface of the hr module.
 *
 * Methods here mirror the HTTP endpoints other services call today:
 *   - payroll-service: getEmployeeById, findEmployeeByUserIdentity,
 *     searchEmployees, createEmployee
 *   - attendance-service, leave-service: getEmployeeById,
 *     findEmployeeByUserIdentity (when those migrate)
 *   - chat-service (invite-accepted listener): findEmployeeByUserIdentity
 *
 * Once the hr module is split out to its own service, this interface
 * becomes the wire contract — every method here turns into an HTTP
 * (or gRPC) endpoint. Keep the surface tight.
 */
export interface EmployeeSummary {
  _id: string;
  /** Business-visible id (e.g. NUG-3D0D21). */
  employeeId: string | null;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  /** Auth-service user id (when the employee has logged in at least once). */
  userId: string | null;
  /** Active / inactive / on_leave / etc. */
  status: string;
  joiningDate: Date | null;
  /** HR _id of reporting manager (if set). */
  reportingManagerId: string | null;
  designation: string | null;
  department: string | null;
  /** PII fields — surfaced because payroll needs them on payslips. */
  pan: string | null;
  uan: string | null;
  bankAccount: { accountNumber: string; ifsc: string; holderName: string } | null;
}

export interface FindEmployeeByUserIdentity {
  /** Auth-service user `_id` (preferred). */
  userId?: string;
  /** Email address — fallback when userId not yet linked. */
  email?: string;
  organizationId: string;
}

export interface SearchEmployeesQuery {
  organizationId: string;
  /** Free-text search (matches employeeId, name, email). */
  search?: string;
  /** Filter by status — active is the most common. */
  status?: 'active' | 'inactive' | 'on_leave' | 'terminated';
  /** Filter by reporting manager. */
  managerId?: string;
  limit?: number;
  page?: number;
}

export interface SearchEmployeesResult {
  data: EmployeeSummary[];
  total: number;
}

export interface CreateEmployeeInput {
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  designation?: string;
  department?: string;
  joiningDate?: Date;
  reportingManagerId?: string;
}

export interface HrPublicApi {
  /** Lookup by HR `_id`. Null when missing or soft-deleted. */
  getEmployeeById(id: string, organizationId: string): Promise<EmployeeSummary | null>;

  /**
   * Resolve an HR employee row given an auth-user identity
   * (userId or email). Used by every downstream service that
   * receives a JWT and needs to load the employee context.
   */
  findEmployeeByUserIdentity(query: FindEmployeeByUserIdentity): Promise<EmployeeSummary | null>;

  /** Paginated search/filter. */
  searchEmployees(query: SearchEmployeesQuery): Promise<SearchEmployeesResult>;

  /** Create a new employee row. */
  createEmployee(input: CreateEmployeeInput): Promise<EmployeeSummary>;
}

export const HR_PUBLIC_API = Symbol('HR_PUBLIC_API');
