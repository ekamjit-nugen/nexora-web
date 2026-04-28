import { LoggerService, Injectable } from '@nestjs/common';

/**
 * E3 8.3: Structured Pino Logger.
 * JSON structured logs with: timestamp, level, service, correlationId, userId, message.
 *
 * Usage: Replace NestJS default logger in main.ts:
 *   const app = await NestFactory.create(AppModule, { logger: new PinoLoggerService('chat-service') });
 *
 * Requires: pino package. Falls back to console if pino not available.
 */
@Injectable()
export class PinoLoggerService implements LoggerService {
  private pino: any = null;
  private logger: any = null;
  private readonly serviceName: string;

  constructor(serviceName: string = 'nexora') {
    this.serviceName = serviceName;
    this.init();
  }

  private async init() {
    try {
      this.pino = await (Function('return import("pino")')());
      this.logger = this.pino.default({
        level: process.env.LOG_LEVEL || 'info',
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        base: { service: this.serviceName, pid: process.pid },
        timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
      });
    } catch {
      // Pino not available — use console
    }
  }

  log(message: any, ...optionalParams: any[]) {
    if (this.logger) {
      this.logger.info({ context: optionalParams[0] }, message);
    } else {
      console.log(`[${this.serviceName}] ${message}`, ...optionalParams);
    }
  }

  error(message: any, ...optionalParams: any[]) {
    if (this.logger) {
      this.logger.error({ context: optionalParams[1], stack: optionalParams[0] }, message);
    } else {
      console.error(`[${this.serviceName}] ${message}`, ...optionalParams);
    }
  }

  warn(message: any, ...optionalParams: any[]) {
    if (this.logger) {
      this.logger.warn({ context: optionalParams[0] }, message);
    } else {
      console.warn(`[${this.serviceName}] ${message}`, ...optionalParams);
    }
  }

  debug(message: any, ...optionalParams: any[]) {
    if (this.logger) {
      this.logger.debug({ context: optionalParams[0] }, message);
    } else {
      console.debug(`[${this.serviceName}] ${message}`, ...optionalParams);
    }
  }

  verbose(message: any, ...optionalParams: any[]) {
    if (this.logger) {
      this.logger.trace({ context: optionalParams[0] }, message);
    } else {
      console.log(`[${this.serviceName}] VERBOSE: ${message}`, ...optionalParams);
    }
  }
}
