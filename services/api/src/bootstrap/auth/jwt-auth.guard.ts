import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

/**
 * Single JwtAuthGuard for the entire monolith — replaces 18 near-
 * identical copies that lived in services/<name>-service/.../guards/.
 *
 * Validates the bearer token, populates `request.user`, and (if a
 * `@Roles(...)` decorator is present) checks RBAC against either the
 * top-level `roles[]` claim or the per-org `orgRole` claim. Owners are
 * promoted above admin/hr/manager (matches the existing payroll guard
 * that we hardened earlier in the session).
 *
 * This guard is the part of the monolith that DOES change subtly when a
 * module splits: the standalone microservice still needs JWT validation,
 * so it imports the same guard at its module boundary. The JWT secret is
 * shared via env var. No code changes.
 */

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PUBLIC_ROUTE_KEY = 'isPublicRoute';
export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);

export interface AuthenticatedUser {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: string[];
  orgRole: string | null;
  isPlatformAdmin: boolean;
  organizationId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload.organizationId && payload.isPlatformAdmin !== true) {
      // Non-platform users always need an org context. Platform admins
      // operate above tenants.
      throw new ForbiddenException('Organization context required');
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
      orgRole: payload.orgRole || null,
      isPlatformAdmin: payload.isPlatformAdmin === true,
      organizationId: payload.organizationId,
    };
    request.user = user;

    // Optional RBAC gate.
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // Platform admins always pass. Owners are promoted above admin/hr/
    // manager (matches the hardened payroll-service behaviour).
    const allowed =
      user.isPlatformAdmin ||
      requiredRoles.some((r) => user.roles.includes(r)) ||
      (user.orgRole !== null && requiredRoles.includes(user.orgRole)) ||
      (user.orgRole === 'owner' &&
        requiredRoles.some((r) => ['admin', 'hr', 'manager'].includes(r)));

    if (!allowed) {
      throw new ForbiddenException('Insufficient permissions for this operation');
    }
    return true;
  }
}
