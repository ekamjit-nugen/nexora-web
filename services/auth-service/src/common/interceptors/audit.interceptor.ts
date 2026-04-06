import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDIT_KEY, AuditMetadata } from '../decorators/auditable.decorator';
import { AuditService } from '../../auth/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditMeta = this.reflector.get<AuditMetadata>(
      AUDIT_KEY,
      context.getHandler(),
    );

    if (!auditMeta) {
      return next.handle(); // No audit metadata, skip
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const orgId = request.user?.organizationId || request.params?.orgId;

    return next.handle().pipe(
      tap(responseData => {
        // Fire-and-forget: don't block response for audit logging
        this.auditService.log({
          action: auditMeta.action as any,
          resource: auditMeta.resource,
          organizationId: orgId,
          userId: user?.sub,
          resourceId: responseData?.id || request.params?.id,
          details: {
            method: request.method,
            path: request.url,
            body: this.sanitizeBody(request.body),
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        }).catch(err => {
          // Log but don't fail - audit is non-blocking
          console.error('Audit log failed:', err.message);
        });
      }),
    );
  }

  private sanitizeBody(body: any): any {
    if (!body) return undefined;
    const sensitiveFields = ['password', 'otp', 'mfaSecret', 'accountNumber', 'pan', 'tan'];
    const sanitized = { ...body };
    for (const field of sensitiveFields) {
      if (sanitized[field]) sanitized[field] = '***REDACTED***';
    }
    return sanitized;
  }
}
