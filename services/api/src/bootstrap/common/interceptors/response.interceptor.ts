import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { randomUUID } from 'crypto';

/**
 * Standard envelope: `{ success, data, meta }`.
 * Identical to what the existing 18 services use, so the frontend
 * doesn't see any contract change.
 *
 * Skips wrapping for binary responses (PDF downloads, file streams)
 * — those handlers use `@Res()` directly.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data: any) => {
        // If a handler returns nothing or returns a Buffer/Stream, pass through.
        if (data === undefined || data === null) {
          return data;
        }
        if (Buffer.isBuffer(data) || typeof data?.pipe === 'function') {
          return data;
        }
        // If the handler already returned `{ success, ... }`, don't double-wrap.
        if (typeof data === 'object' && 'success' in data && 'data' in data) {
          return data;
        }
        return {
          success: true,
          data,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: randomUUID(),
          },
        };
      }),
    );
  }
}
