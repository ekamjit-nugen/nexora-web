import { Injectable, CanActivate, ExecutionContext, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

/**
 * Guard that validates the requesting user belongs to the organization
 * specified in the route parameter `:id` or `:orgId`.
 *
 * Use on all org-scoped endpoints:
 * @UseGuards(JwtAuthGuard, OrgMembershipGuard)
 *
 * Platform admins bypass this check.
 */
@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(
    @InjectModel('OrgMembership') private orgMembershipModel: Model<any>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new HttpException('Authentication required', HttpStatus.UNAUTHORIZED);
    }

    // Platform admins can access any org
    if (user.isPlatformAdmin) {
      return true;
    }

    // Get org ID from route params (supports both :id and :orgId)
    const orgId = request.params?.id || request.params?.orgId;
    if (!orgId) {
      return true; // No org ID in route — skip check
    }

    const userId = user.userId || user.sub;
    if (!userId) {
      throw new HttpException('User ID not found in token', HttpStatus.UNAUTHORIZED);
    }

    // Check if user has an active membership in this org
    const membership = await this.orgMembershipModel.findOne({
      userId,
      organizationId: orgId,
      status: { $in: ['active', 'pending', 'invited'] },
    });

    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_ORG_MEMBER',
        message: 'You are not a member of this organization',
      });
    }

    // Attach membership info to request for downstream use
    request.orgMembership = membership;

    return true;
  }
}
