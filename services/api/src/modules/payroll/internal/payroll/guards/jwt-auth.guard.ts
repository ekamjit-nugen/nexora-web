import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const SELF_ONLY_KEY = 'selfOnly';
export const SelfOnly = () => SetMetadata(SELF_ONLY_KEY, true);

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
    try {
      const payload = this.jwtService.verify(token);

      if (!payload.organizationId) {
        throw new ForbiddenException('Organization context required for payroll operations');
      }

      request.user = {
        userId: payload.sub,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        roles: payload.roles || [],
        // orgRole + isPlatformAdmin are needed server-side for rules like
        // owner-bypass on maker-checker (P-8). Previously these weren't
        // plumbed through, so single-admin orgs deadlocked on self-approval.
        orgRole: payload.orgRole || null,
        isPlatformAdmin: payload.isPlatformAdmin || false,
        organizationId: payload.organizationId,
      };

      // Check role-based access if @Roles() decorator is present
      const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredRoles && requiredRoles.length > 0) {
        // An endpoint can be authorised by EITHER axis:
        //   • top-level `roles[]` claim — for users with explicit
        //     super_admin / admin / hr / manager roles set on their User
        //     record (legacy migrated users + super admins).
        //   • per-org `orgRole` claim — for OTP-only users who never had
        //     top-level roles set (Varun-style owners come in with
        //     `roles: []` and orgRole "owner"; gating only on roles[]
        //     locked them out of every recruitment / payroll endpoint
        //     they should clearly have access to).
        // Platform admins always pass; org owners always pass (they're
        // tenant administrators). Otherwise we accept any required role
        // matching either axis, and treat orgRole "owner" as ≥ admin
        // so an owner satisfies an `@Roles('admin', 'hr')` gate.
        const userRoles: string[] = Array.isArray(request.user.roles) ? request.user.roles : [];
        const orgRole: string | null = request.user.orgRole;
        const isPlatformAdmin: boolean = request.user.isPlatformAdmin;
        const allowed =
          isPlatformAdmin ||
          requiredRoles.some((r) => userRoles.includes(r)) ||
          (orgRole !== null && requiredRoles.includes(orgRole)) ||
          // owner is strictly above admin/hr/manager in the hierarchy —
          // any decorator that admits one of those should admit owner too.
          (orgRole === 'owner' &&
            requiredRoles.some((r) => ['admin', 'hr', 'manager'].includes(r)));
        if (!allowed) {
          throw new ForbiddenException('Insufficient permissions for this operation');
        }
      }

      return true;
    } catch (err) {
      if (err instanceof ForbiddenException) throw err;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
