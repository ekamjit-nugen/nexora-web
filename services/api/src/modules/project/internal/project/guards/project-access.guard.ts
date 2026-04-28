import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProject } from '../schemas/project.schema';
import { IProjectMember } from '../schemas/project-member.schema';

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    @InjectModel('Project', 'nexora_projects') private projectModel: Model<IProject>,
    @InjectModel('ProjectMember', 'nexora_projects')
    private projectMemberModel: Model<IProjectMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const projectId = request.params.projectId;

    if (!user || !projectId) {
      return true; // Let controller handle missing values
    }

    const project = await this.projectModel.findById(projectId);

    if (!project) {
      throw new ForbiddenException('Project not found');
    }

    // Platform admin can access any project
    if (user.orgRole === 'platform_admin') {
      return true;
    }

    // Public projects can be viewed by any org member
    if (project.visibility === 'public') {
      return true;
    }

    // Check if user is a member of the project
    const membership = await this.projectMemberModel.findOne({
      projectId,
      userId: user._id || user.id,
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this project');
    }

    // Attach member info to request for use in controllers
    request.projectMember = membership;

    return true;
  }
}
