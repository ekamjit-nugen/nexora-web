import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

/**
 * Standard error envelope: `{ success: false, error: { code, message }, meta }`.
 * Mirrors the existing 18-service contract so the frontend's error
 * handling continues to work unchanged after the cutover.
 */
@Catch()
export class HttpExceptionFilterImpl implements ExceptionFilter {
  private readonly log = new Logger(HttpExceptionFilterImpl.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (typeof resp === 'string') {
        message = resp;
      } else if (typeof resp === 'object' && resp !== null) {
        const r = resp as any;
        message = r.message || message;
        code = r.code || statusToCode(status);
      }
      if (code === 'INTERNAL_ERROR') code = statusToCode(status);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.log.error(`unhandled: ${message}`, exception.stack);
    }

    response.status(status).json({
      success: false,
      error: { code, message },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: randomUUID(),
        path: request?.url,
      },
    });
  }
}

function statusToCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'UNPROCESSABLE_ENTITY';
    case 429: return 'RATE_LIMITED';
    default:  return status >= 500 ? 'INTERNAL_ERROR' : 'CLIENT_ERROR';
  }
}
