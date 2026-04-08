import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProjectMember } from '../schemas/project-member.schema';

export type ProjectRole = 'admin' | 'lead' | 'developer' | 'viewer';

export interface IProjectPermissions {
  createTask: boolean;
  editTask: boolean;
  deleteTask: boolean;
  manageMembers: boolean;
  manageProject: boolean;
  viewAnalytics: boolean;
  viewProject: boolean;
  assignTasks: boolean;
  createSprint: boolean;
  manageSprints: boolean;
  createRelease: boolean;
  manageReleases: boolean;
}

export const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, IProjectPermissions> =
  {
    admin: {
      createTask: true,
      editTask: true,
      deleteTask: true,
      manageMembers: true,
      manageProject: true,
      viewAnalytics: true,
      viewProject: true,
      assignTasks: true,
      createSprint: true,
      manageSprints: true,
      createRelease: true,
      manageReleases: true,
    },
    lead: {
      createTask: true,
      editTask: true,
      deleteTask: false,
      manageMembers: false,
      manageProject: false,
      viewAnalytics: true,
      viewProject: true,
      assignTasks: true,
      createSprint: true,
      manageSprints: true,
      createRelease: false,
      manageReleases: false,
    },
    developer: {
      createTask: true,
      editTask: true,
      deleteTask: false,
      manageMembers: false,
      manageProject: false,
      viewAnalytics: false,
      viewProject: true,
      assignTasks: false,
      createSprint: false,
      manageSprints: false,
      createRelease: false,
      manageReleases: false,
    },
    viewer: {
      createTask: false,
      editTask: false,
      deleteTask: false,
      manageMembers: false,
      manageProject: false,
      viewAnalytics: true,
      viewProject: true,
      assignTasks: false,
      createSprint: false,
      manageSprints: false,
      createRelease: false,
      manageReleases: false,
    },
  };

@Injectable()
export class ProjectPermissionsService {
  constructor(
    @InjectModel('ProjectMember')
    private readonly projectMemberModel: Model<IProjectMember>,
  ) {}

  async getUserProjectRole(
    userId: string,
    projectId: string,
  ): Promise<ProjectRole | null> {
    const projectMember = await this.projectMemberModel.findOne({
      userId,
      projectId,
    });

    if (!projectMember) return null;
    return projectMember.role;
  }

  async canAccessProject(
    userId: string,
    projectId: string,
    permission: keyof IProjectPermissions,
    orgRole?: string,
  ): Promise<boolean> {
    // Platform admin can do anything
    if (orgRole === 'platform_admin') return true;

    // Check project-specific role
    const projectRole = await this.getUserProjectRole(userId, projectId);

    if (!projectRole) return false;

    const projectPermissions = PROJECT_ROLE_PERMISSIONS[projectRole];
    return projectPermissions[permission];
  }

  hasPermission(
    projectRole: ProjectRole,
    permission: keyof IProjectPermissions,
  ): boolean {
    const permissions = PROJECT_ROLE_PERMISSIONS[projectRole];
    return permissions[permission];
  }

  getPermissionsForRole(projectRole: ProjectRole): IProjectPermissions {
    return PROJECT_ROLE_PERMISSIONS[projectRole];
  }
}
