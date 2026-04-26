import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

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

    // Tenant-isolation guarantee: every HR route is org-scoped. A JWT without a
    // verified organizationId (e.g. a fresh OTP-verified user pre-org-creation,
    // or a malformed/tampered token) must never reach these handlers, otherwise
    // the per-org scope filters in the service layer collapse to "no filter".
    if (!payload.organizationId || typeof payload.organizationId !== 'string') {
      throw new ForbiddenException({
        code: 'ORG_SCOPE_REQUIRED',
        message: 'Organization context required. Create or switch to an organization before accessing HR resources.',
      });
    }

    request.user = {
      userId: payload.sub,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      roles: payload.roles,
      organizationId: payload.organizationId,
    };
    return true;
  }
}
