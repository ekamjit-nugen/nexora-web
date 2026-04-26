import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

// HR service previously had NO role-based access control. Any authenticated
// user with an org context could create/update/terminate employees,
// departments, and designations. QA Finding HR-RBAC-1 confirmed that a
// regular developer could successfully POST /employees and DELETE
// /employees/:id. This guard adds RBAC and enforces the combined
// roles + orgRole allowlist per endpoint.
//
// Usage on a controller method:
//
//     @UseGuards(JwtAuthGuard)
//     @Roles('admin', 'hr', 'super_admin')
//     async createEmployee(...) { ... }
//
// If `@Roles(...)` is omitted the endpoint stays read-authenticated for
// anyone with a valid token in an org context (no regression for the many
// harmless read paths — list, get, stats, org-chart).

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    request.user = {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles || [],
      orgRole: payload.orgRole || null,
      isPlatformAdmin: payload.isPlatformAdmin || false,
      organizationId: payload.organizationId || null,
    };

    // Bug #1 (P0) defence-in-depth: every HR endpoint is inherently org-scoped.
    // A JWT issued during OTP verification before org creation carries
    // `organizationId: null`; historically this caused `find({})` with no
    // tenant filter to dump every employee across every tenant.
    // Reject null-org tokens here so no downstream handler can leak.
    if (!request.user.organizationId) {
      throw new ForbiddenException(
        'Organization context required. Complete organization setup before accessing HR resources.',
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      // An endpoint can be gated by either the top-level `roles` claim
      // (e.g. 'admin' / 'super_admin' set on the auth User) OR by the
      // per-org `orgRole` (e.g. 'owner' / 'hr' on the membership). We
      // accept a match on either side. Platform admins always pass.
      const userRoles: string[] = Array.isArray(request.user.roles) ? request.user.roles : [];
      const orgRole: string | null = request.user.orgRole;
      const isPlatformAdmin: boolean = request.user.isPlatformAdmin;
      const allowed = isPlatformAdmin
        || requiredRoles.some((r) => userRoles.includes(r))
        || (orgRole && requiredRoles.includes(orgRole))
        // owner has strictly more power than admin/hr and should pass
        // any decorator that includes 'admin' or 'hr'.
        || (orgRole === 'owner' && (requiredRoles.includes('admin') || requiredRoles.includes('hr')));
      if (!allowed) {
        throw new ForbiddenException('Insufficient permissions for this operation');
      }
    }

    return true;
  }
}
