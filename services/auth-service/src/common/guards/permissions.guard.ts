import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context.switchToHttp().getRequest();
    const userPermissions: string[] = request.user?.permissions || [];

    const hasPermission = requiredPermissions.every(
      permission => userPermissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException({
        code: 'INSUFFICIENT_PERMISSION',
        message: 'You do not have permission to perform this action',
        details: { required: requiredPermissions },
      });
    }

    return true;
  }
}
