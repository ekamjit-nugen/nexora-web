import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException('Authentication required');
    if (user.isPlatformAdmin) return true;

    const userOrgRole = user.orgRole || user.role || 'member';
    const roleHierarchy = ['viewer', 'member', 'manager', 'admin', 'owner'];
    const userRoleIndex = roleHierarchy.indexOf(userOrgRole);
    const minRequiredIndex = Math.min(...requiredRoles.map(r => roleHierarchy.indexOf(r)));

    if (userRoleIndex < 0 || userRoleIndex < minRequiredIndex) {
      throw new ForbiddenException(
        `Insufficient permissions. Required: ${requiredRoles.join(' or ')}. Your role: ${userOrgRole}`
      );
    }
    return true;
  }
}
