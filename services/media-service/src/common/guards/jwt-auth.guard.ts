import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * JWT Auth Guard for media-service.
 * Verifies Bearer token from Authorization header using jsonwebtoken.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization token');
    }

    const token = authHeader.split(' ')[1];
    try {
      const jwt = require('jsonwebtoken');
      const secret = process.env.JWT_SECRET;
      if (!secret) throw new Error('JWT_SECRET not configured');

      const payload = jwt.verify(token, secret);
      request.user = {
        userId: payload.sub,
        email: payload.email,
        organizationId: payload.organizationId || null,
        roles: payload.roles || [],
        orgRole: payload.orgRole || 'member',
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
