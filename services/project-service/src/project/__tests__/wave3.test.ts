/**
 * Wave 3: Advanced Project Management - Test Suite
 * Covers: Per-Project Roles, Visibility, Components, Releases, Task Cloning
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, Connection, Model } from 'mongoose';
import { ProjectSchema } from '../schemas/project.schema';
import { ProjectMemberSchema } from '../schemas/project-member.schema';
import { Wave3MethodsService } from '../utils/wave3-methods';
import { ProjectPermissionsService } from '../utils/permissions';
import { IProject } from '../schemas/project.schema';
import { IProjectMember } from '../schemas/project-member.schema';

describe('Wave 3: Advanced Project Management', () => {
  let service: Wave3MethodsService;
  let permissionsService: ProjectPermissionsService;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;
  let projectModel: Model<IProject>;
  let projectMemberModel: Model<IProjectMember>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoConnection = (await connect(mongoUri)).connection;
    projectModel = mongoConnection.model<IProject>(
      'Project',
      ProjectSchema,
    );
    projectMemberModel = mongoConnection.model<IProjectMember>(
      'ProjectMember',
      ProjectMemberSchema,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'ProjectModel',
          useValue: projectModel,
        },
        {
          provide: 'ProjectMemberModel',
          useValue: projectMemberModel,
        },
        ProjectPermissionsService,
        Wave3MethodsService,
      ],
    })
      .overrideProvider('Project')
      .useValue(projectModel)
      .overrideProvider('ProjectMember')
      .useValue(projectMemberModel)
      .compile();

    service = module.get<Wave3MethodsService>(Wave3MethodsService);
    permissionsService = module.get<ProjectPermissionsService>(
      ProjectPermissionsService,
    );
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoConnection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('3.1 Per-Project Role Assignment', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Test Project',
        projectKey: 'TEST',
        organizationId: 'org-123',
        visibility: 'private',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should add a user as project member with specific role', async () => {
      const member = await service.addProjectMember(
        projectId,
        {
          userId: 'user-2',
          role: 'developer',
        },
        'user-1',
      );

      expect(member.userId).toBe('user-2');
      expect(member.role).toBe('developer');
      expect(member.projectId).toBe(projectId);
      expect(member.addedBy).toBe('user-1');
    });

    it('should prevent duplicate project members', async () => {
      await service.addProjectMember(
        projectId,
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );

      await expect(
        service.addProjectMember(
          projectId,
          { userId: 'user-2', role: 'admin' },
          'user-1',
        ),
      ).rejects.toThrow('User is already a member');
    });

    it('should update project member role', async () => {
      await service.addProjectMember(
        projectId,
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );

      const updated = await service.updateProjectMember(projectId, 'user-2', {
        role: 'lead',
      });

      expect(updated.role).toBe('lead');
    });

    it('should remove project member', async () => {
      await service.addProjectMember(
        projectId,
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );

      await service.removeProjectMember(projectId, 'user-2');

      await expect(
        service.getProjectMember(projectId, 'user-2'),
      ).rejects.toThrow('not found');
    });

    it('should get all project members', async () => {
      await service.addProjectMember(
        projectId,
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );
      await service.addProjectMember(
        projectId,
        { userId: 'user-3', role: 'lead' },
        'user-1',
      );

      const members = await service.getProjectMembers(projectId);

      expect(members).toHaveLength(2);
      expect(members[0].userId).toBe('user-2');
    });

    it('user can be admin on Project A and developer on Project B', async () => {
      const project2 = new projectModel({
        projectName: 'Project B',
        projectKey: 'PROJB',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project2.save();

      await service.addProjectMember(
        projectId,
        { userId: 'user-2', role: 'admin' },
        'user-1',
      );
      await service.addProjectMember(
        project2._id.toString(),
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );

      const role1 = await permissionsService.getUserProjectRole(
        'user-2',
        projectId,
      );
      const role2 = await permissionsService.getUserProjectRole(
        'user-2',
        project2._id.toString(),
      );

      expect(role1).toBe('admin');
      expect(role2).toBe('developer');
    });
  });

  describe('3.3 Project Visibility Controls', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Visibility Test',
        projectKey: 'VIS',
        organizationId: 'org-123',
        visibility: 'public',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should update project visibility', async () => {
      const updated = await service.updateProjectVisibility(projectId, {
        visibility: 'private',
      });

      expect(updated.visibility).toBe('private');
    });

    it('should retrieve accessible projects for non-admin user', async () => {
      // Create public project
      const publicProj = new projectModel({
        projectName: 'Public Project',
        projectKey: 'PUB',
        organizationId: 'org-123',
        visibility: 'public',
        createdBy: 'user-1',
      });
      await publicProj.save();

      // Create private project where user is member
      const privateProj = new projectModel({
        projectName: 'Private Project',
        projectKey: 'PRIV',
        organizationId: 'org-123',
        visibility: 'private',
        createdBy: 'user-1',
      });
      await privateProj.save();

      await service.addProjectMember(
        privateProj._id.toString(),
        { userId: 'user-2', role: 'developer' },
        'user-1',
      );

      const accessible = await service.getAccessibleProjects(
        'user-2',
        'org-123',
        'member',
      );

      expect(accessible).toHaveLength(2);
      expect(accessible.map((p) => p._id.toString())).toContain(
        publicProj._id.toString(),
      );
      expect(accessible.map((p) => p._id.toString())).toContain(
        privateProj._id.toString(),
      );
    });

    it('should hide private projects from non-members', async () => {
      const privateProj = new projectModel({
        projectName: 'Private Project',
        projectKey: 'PRIV',
        organizationId: 'org-123',
        visibility: 'private',
        createdBy: 'user-1',
      });
      await privateProj.save();

      const accessible = await service.getAccessibleProjects(
        'user-2',
        'org-123',
        'member',
      );

      expect(
        accessible.map((p) => p._id.toString()).includes(privateProj._id.toString()),
      ).toBe(false);
    });
  });

  describe('3.4 Components', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Component Test',
        projectKey: 'COMP',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should create component', async () => {
      const project = await service.addComponent(projectId, {
        name: 'Auth Module',
        description: 'Authentication system',
        lead: 'user-2',
        defaultAssignee: 'user-3',
        color: '#FF0000',
      });

      expect(project.components).toHaveLength(1);
      expect(project.components[0].name).toBe('Auth Module');
      expect(project.components[0].lead).toBe('user-2');
    });

    it('should update component', async () => {
      let project = await service.addComponent(projectId, {
        name: 'Auth Module',
        lead: 'user-2',
      });

      const componentId = project.components[0]._id;

      project = await service.updateComponent(projectId, componentId, {
        lead: 'user-3',
      });

      expect(project.components[0].lead).toBe('user-3');
    });

    it('should delete component', async () => {
      let project = await service.addComponent(projectId, {
        name: 'Auth Module',
      });

      const componentId = project.components[0]._id;

      project = await service.deleteComponent(projectId, componentId);

      expect(project.components).toHaveLength(0);
    });

    it('should get components', async () => {
      await service.addComponent(projectId, { name: 'Auth' });
      await service.addComponent(projectId, { name: 'Database' });

      const components = await service.getComponents(projectId);

      expect(components).toHaveLength(2);
    });
  });

  describe('3.4 Releases (Fix Versions)', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Release Test',
        projectKey: 'REL',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should create release', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      const project = await service.createRelease(projectId, {
        name: 'v2.1.0',
        description: 'Major feature release',
        releaseDate: futureDate.toISOString(),
        status: 'planned',
      });

      expect(project.releases).toHaveLength(1);
      expect(project.releases[0].name).toBe('v2.1.0');
      expect(project.releases[0].status).toBe('planned');
    });

    it('should update release status', async () => {
      let project = await service.createRelease(projectId, {
        name: 'v2.1.0',
        status: 'planned',
      });

      const releaseId = project.releases[0]._id;

      project = await service.updateRelease(projectId, releaseId, {
        status: 'in_progress',
      });

      expect(project.releases[0].status).toBe('in_progress');
    });

    it('should delete release', async () => {
      let project = await service.createRelease(projectId, {
        name: 'v2.1.0',
      });

      const releaseId = project.releases[0]._id;

      project = await service.deleteRelease(projectId, releaseId);

      expect(project.releases).toHaveLength(0);
    });
  });

  describe('Permission Resolution', () => {
    it('should verify admin has all permissions', () => {
      const perms = permissionsService.getPermissionsForRole('admin');

      expect(perms.manageMembers).toBe(true);
      expect(perms.manageProject).toBe(true);
      expect(perms.deleteTask).toBe(true);
      expect(perms.createTask).toBe(true);
    });

    it('should verify developer has limited permissions', () => {
      const perms = permissionsService.getPermissionsForRole('developer');

      expect(perms.createTask).toBe(true);
      expect(perms.editTask).toBe(true);
      expect(perms.deleteTask).toBe(false);
      expect(perms.manageMembers).toBe(false);
    });

    it('should verify viewer can only view', () => {
      const perms = permissionsService.getPermissionsForRole('viewer');

      expect(perms.viewProject).toBe(true);
      expect(perms.createTask).toBe(false);
      expect(perms.editTask).toBe(false);
      expect(perms.manageMembers).toBe(false);
    });
  });
});
