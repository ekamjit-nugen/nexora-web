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
        const userRoles: string[] = request.user.roles;
        const hasRole = requiredRoles.some((role) => userRoles.includes(role));
        if (!hasRole) {
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
