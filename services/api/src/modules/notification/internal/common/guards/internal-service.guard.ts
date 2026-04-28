import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

/**
 * Internal Service Guard for notification-service.
 *
 * Validates requests come from trusted internal services via:
 * 1. JWT Bearer token (for user-initiated requests via API gateway)
 * 2. X-Internal-Service-Key header (for service-to-service calls)
 *
 * Rejects all unauthenticated requests.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Option 1: JWT Bearer token (routed through API gateway)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error('JWT_SECRET not set');
        const payload = jwt.verify(authHeader.split(' ')[1], secret) as any;
        request.user = { userId: payload.sub, organizationId: payload.organizationId };
        return true;
      } catch {
        // Fall through to check internal key
      }
    }

    // Option 2: Internal service key (for direct service-to-service calls)
    const serviceKey = request.headers['x-internal-service-key'];
    const expectedKey = process.env.INTERNAL_SERVICE_KEY;
    if (expectedKey && serviceKey === expectedKey) {
      request.user = { userId: 'system', organizationId: 'internal' };
      return true;
    }

    throw new UnauthorizedException('Authentication required');
  }
}
