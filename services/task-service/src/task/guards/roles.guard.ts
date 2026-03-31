import { Injectable, CanActivate, ExecutionContext, ForbiddenException, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

const ROLE_HIERARCHY = ['viewer', 'member', 'manager', 'admin', 'owner'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // Platform admin bypasses all role checks
    if (user.isPlatformAdmin) {
      return true;
    }

    const userOrgRole = user.orgRole || 'member';
    const userRoleIndex = ROLE_HIERARCHY.indexOf(userOrgRole);
    const minRequiredIndex = Math.min(...requiredRoles.map(r => ROLE_HIERARCHY.indexOf(r)));

    if (userRoleIndex < minRequiredIndex) {
      throw new ForbiddenException(
        `Insufficient permissions. Required role: ${requiredRoles.join(' or ')}. Your role: ${userOrgRole}`,
      );
    }

    return true;
  }
}
