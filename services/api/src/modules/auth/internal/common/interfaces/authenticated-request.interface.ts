import { Request } from 'express';

export interface AuthenticatedUser {
  sub: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  organizationId?: string;
  orgRole?: string;
  roles: string[];
  permissions?: string[];
  setupStage?: string;
  isPlatformAdmin?: boolean;
  family?: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
