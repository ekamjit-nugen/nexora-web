// User & Authentication Types
export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  roleId: string;
  departmentId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  roleId: string;
  departmentId: string;
  permissions: string[];
  iat: number;
  exp: number;
}

export interface AuthContext {
  userId: string;
  email: string;
  roleId: string;
  departmentId: string;
  permissions: string[];
}

// Role & Permission Types
export type PermissionAction = 'READ' | 'WRITE' | 'DELETE' | 'HARD_DELETE' | 'APPROVE' | 'REJECT' | 'FORCE_WRITE' | 'EXPORT' | 'CONFIGURE' | 'BULK_ACTION' | 'IMPERSONATE';

export interface Permission {
  _id: string;
  action: PermissionAction;
  resource: string;
  scope: 'SELF' | 'TEAM' | 'DEPARTMENT' | 'PROJECT' | 'ORGANIZATION';
  roleId: string;
}

export interface Role {
  _id: string;
  name: string;
  permissions: Permission[];
  description: string;
  isActive: boolean;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Audit Log Types
export interface AuditLog {
  _id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: {
    before: any;
    after: any;
  };
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

// Event Types for Pub/Sub
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  data: any;
  metadata?: {
    userId: string;
    timestamp: Date;
    version: number;
  };
}

// Database Base Types
export interface BaseDocument {
  _id: string;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  schemaVersion?: number;
}

// Pagination Types
export interface PaginationQuery {
  page?: number;
  limit?: number;
  skip?: number;
  sort?: string;
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

// Microservice Types
export interface ServiceConfig {
  name: string;
  port: number;
  version: string;
  env: 'development' | 'staging' | 'production';
  database: {
    uri: string;
    name: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
}

export interface HealthStatus {
  status: 'UP' | 'DOWN' | 'DEGRADED';
  timestamp: Date;
  services: {
    database: HealthStatus;
    redis: HealthStatus;
    elasticsearch: HealthStatus;
  };
}

// Error Types
export class ServiceError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    public details?: any
  ) {
    super();
    this.name = 'ServiceError';
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, id: string) {
    super('NOT_FOUND', 404, { resource, id });
    this.message = `${resource} not found with id: ${id}`;
  }
}

export class UnauthorizedError extends ServiceError {
  constructor(message: string = 'Unauthorized') {
    super('UNAUTHORIZED', 401, { message });
    this.message = message;
  }
}

export class ForbiddenError extends ServiceError {
  constructor(message: string = 'Forbidden') {
    super('FORBIDDEN', 403, { message });
    this.message = message;
  }
}

// Enum Types
export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERN = 'intern',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  HALF_DAY = 'half_day',
  ABSENT = 'absent',
  HOLIDAY = 'holiday',
  LEAVE = 'leave',
  WFH = 'wfh',
  COMP_OFF = 'comp_off',
}

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum PayslipStatus {
  DRAFT = 'draft',
  FINALIZED = 'finalized',
  SENT = 'sent',
}
