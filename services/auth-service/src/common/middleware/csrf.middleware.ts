import { Injectable, NestMiddleware, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

/**
 * CSRF validation middleware.
 * For state-changing requests (POST, PUT, DELETE, PATCH),
 * validates that the X-XSRF-TOKEN header matches the XSRF-TOKEN cookie.
 *
 * Skips validation for:
 * - GET, HEAD, OPTIONS requests (safe methods)
 * - Requests with no XSRF-TOKEN cookie (not cookie-authenticated)
 * - OAuth callback endpoints
 * - Webhook endpoints
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];
  private readonly EXEMPT_PATHS = [
    '/auth/oauth/',
    '/auth/saml/',
    '/api/v1/auth/oauth/',
    '/api/v1/auth/saml/',
  ];

  use(req: Request, _res: Response, next: NextFunction): void {
    // Skip safe methods
    if (this.SAFE_METHODS.includes(req.method)) {
      return next();
    }

    // Skip exempt paths
    if (this.EXEMPT_PATHS.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Only enforce CSRF if user has the XSRF-TOKEN cookie (cookie-based auth)
    const cookieToken = req.cookies?.['XSRF-TOKEN'];
    if (!cookieToken) {
      return next();
    }

    const headerToken = req.headers['x-xsrf-token'] as string;
    if (!headerToken) {
      throw new HttpException(
        { success: false, error: { code: 'CSRF_MISSING', message: 'CSRF token missing' } },
        HttpStatus.FORBIDDEN,
      );
    }

    // Timing-safe comparison
    try {
      const cookieBuf = Buffer.from(cookieToken);
      const headerBuf = Buffer.from(headerToken);
      if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
        throw new HttpException(
          { success: false, error: { code: 'CSRF_INVALID', message: 'CSRF token invalid' } },
          HttpStatus.FORBIDDEN,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: { code: 'CSRF_INVALID', message: 'CSRF token invalid' } },
        HttpStatus.FORBIDDEN,
      );
    }

    next();
  }
}
