import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);

    if (!token) {
      this.logger.warn('No JWT token found in request');
      throw new UnauthorizedException('JWT token is missing');
    }

    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      this.logger.warn(`JWT validation failed: ${info?.message || err?.message}`);
      throw err || new UnauthorizedException('Invalid JWT token');
    }
    return user;
  }

  private extractToken(request: any): string | null {
    // 1. Bearer token (API clients, seed scripts)
    const authHeader = request.headers.authorization;
    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }

    // 2. httpOnly cookie (browser clients — Wave 1.1 security hardening)
    if (request.cookies?.nexora_token) {
      return request.cookies.nexora_token;
    }

    return null;
  }
}

/*
 * When: Protected route is accessed
 * if: Authorization header contains valid Bearer token
 * then: extract and validate JWT, allow request to proceed
 */
