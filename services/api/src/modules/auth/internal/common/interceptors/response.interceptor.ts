import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const requestId = request.headers['x-request-id'] || uuidv4();

    return next.handle().pipe(
      map(data => {
        // If controller already wrapped the response, pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return { ...data, meta: { timestamp: new Date().toISOString(), requestId } };
        }
        // Otherwise wrap it
        return {
          success: true,
          data,
          meta: { timestamp: new Date().toISOString(), requestId },
        };
      }),
    );
  }
}
