import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    if (!request.user?.isPlatformAdmin) {
      throw new HttpException('Platform admin access required', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}

/*
 * When: Platform admin endpoint is accessed
 * if: user has isPlatformAdmin flag set to true
 * then: allow request to proceed
 */
