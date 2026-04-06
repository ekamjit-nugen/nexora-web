import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Communication audit interceptor.
 * Logs COMMS_* events for all state-changing operations.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('CommsAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only audit state-changing requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const userId = request.user?.userId || 'anonymous';
    const path = request.url;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - now;
          const action = this.deriveAction(method, path);
          if (action) {
            this.logger.log(JSON.stringify({
              event: action,
              userId,
              path,
              method,
              duration,
              timestamp: new Date().toISOString(),
            }));
          }
        },
      }),
    );
  }

  private deriveAction(method: string, path: string): string | null {
    if (path.includes('/messages') && method === 'POST') return 'COMMS_MESSAGE_SENT';
    if (path.includes('/messages') && method === 'PUT') return 'COMMS_MESSAGE_EDITED';
    if (path.includes('/messages') && method === 'DELETE') return 'COMMS_MESSAGE_DELETED';
    if (path.includes('/conversations') && method === 'POST') return 'COMMS_CONVERSATION_CREATED';
    if (path.includes('/participants') && method === 'POST') return 'COMMS_MEMBER_ADDED';
    if (path.includes('/participants') && method === 'DELETE') return 'COMMS_MEMBER_REMOVED';
    if (path.includes('/channels') && method === 'POST') return 'COMMS_CHANNEL_CREATED';
    if (path.includes('/threads') && method === 'POST') return 'COMMS_THREAD_REPLY';
    if (path.includes('/moderation') && method === 'PUT') return 'COMMS_MODERATION_REVIEW';
    return null;
  }
}
