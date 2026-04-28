import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/require-roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context.switchToHttp().getRequest();
    const userRoles: string[] = request.user?.roles || [];
    const orgRole: string | undefined = request.user?.orgRole;

    const hasRole = requiredRoles.some(
      role => userRoles.includes(role) || orgRole === role,
    );

    if (!hasRole) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_ROLE',
        message: 'You do not have the required role to perform this action',
        details: { required: requiredRoles },
      });
    }

    return true;
  }
}
