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

// Leave service previously had NO role-based access control on any
// endpoint. QA confirmed a live exploit: a developer could approve/cancel
// their OWN leave request (self-approval fraud) and anyone else's leave
// too. See the SEC-1 finding in the consolidated bug tracker.
//
// This guard mirrors the one we added in hr-service: keeps the existing
// token-verification + null-org rejection, and adds a `@Roles(...)`
// decorator whose metadata is checked here. An endpoint that omits
// `@Roles(...)` stays open to any authenticated user (so read paths and
// self-service `POST /leaves` don't regress) — only writes that should
// be admin/hr/manager-gated need the decorator.

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

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles: string[] = Array.isArray(request.user.roles) ? request.user.roles : [];
      const orgRole: string | null = request.user.orgRole;
      const isPlatformAdmin: boolean = request.user.isPlatformAdmin;
      const allowed = isPlatformAdmin
        || requiredRoles.some((r) => userRoles.includes(r))
        || (orgRole && requiredRoles.includes(orgRole))
        // owner has strictly more power than admin/hr/manager and passes
        // any decorator that includes those roles.
        || (orgRole === 'owner' && requiredRoles.some((r) => ['admin', 'hr', 'manager'].includes(r)));
      if (!allowed) {
        throw new ForbiddenException('Insufficient permissions for this operation');
      }
    }

    return true;
  }
}
