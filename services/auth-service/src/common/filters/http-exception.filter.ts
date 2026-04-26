import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class HttpExceptionFilterImpl implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilterImpl.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, any> | undefined;
    let fields: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;

      // Support both flat { code, message } and nested { error: { code, message } } formats
      const nested = exceptionResponse?.error || {};
      code = nested.code || exceptionResponse.code || this.statusToCode(status);
      message = nested.message || exceptionResponse.message || exception.message;
      details = nested.details || exceptionResponse.details;
      fields = nested.fields || exceptionResponse.fields;

      // Handle class-validator validation errors
      if (status === HttpStatus.BAD_REQUEST && Array.isArray(exceptionResponse.message)) {
        code = 'VALIDATION_ERROR';
        message = 'Validation failed';
        fields = this.formatValidationErrors(exceptionResponse.message);
      }
    } else {
      // Non-HttpException → 500. Without logging the actual error, every
      // unexpected failure surfaces as a generic "An unexpected error
      // occurred" with no way to trace it. Log the stack here so ops
      // can diagnose. Only fires for unhandled exceptions; HttpException
      // (which carries its own message) still goes through the path
      // above.
      const err = exception as Error;
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err?.message || exception}`,
        err?.stack,
      );
    }

    const errorResponse = {
      success: false as const,
      error: { code, message, ...(details && { details }), ...(fields && { fields }) },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'] || 'unknown',
      },
    };

    response.status(status).json(errorResponse);
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      410: 'GONE',
      422: 'VALIDATION_ERROR',
      429: 'RATE_LIMITED',
    };
    return map[status] || 'INTERNAL_ERROR';
  }

  private formatValidationErrors(messages: string[]): Record<string, string> {
    const fields: Record<string, string> = {};
    for (const msg of messages) {
      // class-validator format: "fieldName must be ..."
      const match = msg.match(/^(\w+)\s+(.+)$/);
      if (match) {
        fields[match[1]] = match[2];
      } else {
        fields['_general'] = msg;
      }
    }
    return fields;
  }
}
