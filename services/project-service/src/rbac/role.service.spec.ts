import { Test, TestingModule } from '@nestjs/testing';
import { RoleService } from './role.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';

describe('RoleService', () => {
  let service: RoleService;
  let mockRoleModel: any;
  let mockAssignmentModel: any;

  beforeEach(async () => {
    mockRoleModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ _id: '1', name: 'Admin' }),
    }));
    mockRoleModel.findOne = jest.fn();
    mockRoleModel.findById = jest.fn();
    mockRoleModel.find = jest.fn();
    mockRoleModel.findByIdAndDelete = jest.fn();

    mockAssignmentModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ userId: 'user1', roleId: 'role1' }),
    }));
    mockAssignmentModel.findOne = jest.fn();
    mockAssignmentModel.find = jest.fn();
    mockAssignmentModel.updateOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: getModelToken('Role'),
          useValue: mockRoleModel,
        },
        {
          provide: getModelToken('RoleAssignment'),
          useValue: mockAssignmentModel,
        },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
  });

  describe('createRole', () => {
    it('should create a role successfully', async () => {
      mockRoleModel.findOne.mockResolvedValue(null);

      const result = await service.createRole('prod1', {
        name: 'Admin',
        permissions: [],
      });

      expect(mockRoleModel.findOne).toHaveBeenCalled();
    });

    it('should throw error if role exists', async () => {
      mockRoleModel.findOne.mockResolvedValue({ name: 'Admin' });

      await expect(
        service.createRole('prod1', { name: 'Admin', permissions: [] }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRole', () => {
    it('should get role by id', async () => {
      const mockRole = { _id: '1', name: 'Admin' };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      const result = await service.getRole('1');

      expect(result).toEqual(mockRole);
      expect(mockRoleModel.findById).toHaveBeenCalledWith('1');
    });

    it('should throw error if role not found', async () => {
      mockRoleModel.findById.mockResolvedValue(null);

      await expect(service.getRole('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPermission', () => {
    it('should add permission to role', async () => {
      const mockRole = {
        _id: '1',
        permissions: [],
        isSystem: false,
        save: jest.fn().mockResolvedValue({ permissions: [{ resource: 'users', action: 'read' }] }),
      };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      const result = await service.addPermission('1', { resource: 'users', action: 'read' });

      expect(mockRole.save).toHaveBeenCalled();
    });

    it('should throw error if permission already exists', async () => {
      const mockRole = {
        _id: '1',
        permissions: [{ resource: 'users', action: 'read' }],
        isSystem: false,
      };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      await expect(
        service.addPermission('1', { resource: 'users', action: 'read' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error if trying to modify system role', async () => {
      const mockRole = { _id: '1', permissions: [], isSystem: true };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      await expect(
        service.addPermission('1', { resource: 'users', action: 'read' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('removePermission', () => {
    it('should remove permission from role', async () => {
      const mockRole = {
        _id: '1',
        permissions: [{ resource: 'users', action: 'read' }],
        isSystem: false,
        save: jest.fn().mockResolvedValue({}),
      };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      await service.removePermission('1', 'users', 'read');

      expect(mockRole.save).toHaveBeenCalled();
    });
  });

  describe('assignRole', () => {
    it('should assign role to user', async () => {
      const mockRole = { _id: 'role1' };
      mockRoleModel.findById.mockResolvedValue(mockRole);
      mockAssignmentModel.findOne.mockResolvedValue(null);

      await service.assignRole('prod1', 'user1', 'role1', 'admin', new Date());

      expect(mockAssignmentModel.findOne).toHaveBeenCalled();
    });

    it('should throw error if user already has role', async () => {
      mockRoleModel.findById.mockResolvedValue({ _id: 'role1' });
      mockAssignmentModel.findOne.mockResolvedValue({ userId: 'user1', roleId: 'role1' });

      await expect(
        service.assignRole('prod1', 'user1', 'role1', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkPermission', () => {
    it('should return true if user has permission', async () => {
      const mockRole = {
        _id: 'role1',
        permissions: [{ resource: 'users', action: 'read' }],
        parentRoles: [],
      };
      mockAssignmentModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ roleId: 'role1' }]),
      });
      mockRoleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockRole]),
      });

      const result = await service.checkPermission('prod1', 'user1', 'users', 'read');

      expect(result).toBe(true);
    });

    it('should return false if user does not have permission', async () => {
      const mockRole = {
        permissions: [{ resource: 'other', action: 'read' }],
        parentRoles: [],
      };
      mockAssignmentModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([{ roleId: 'role1' }]),
      });
      mockRoleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([mockRole]),
      });

      const result = await service.checkPermission('prod1', 'user1', 'users', 'read');

      expect(result).toBe(false);
    });
  });

  describe('deleteRole', () => {
    it('should delete non-system role', async () => {
      const mockRole = { _id: '1', isSystem: false };
      mockRoleModel.findById.mockResolvedValue(mockRole);
      mockRoleModel.findByIdAndDelete.mockResolvedValue({});

      await service.deleteRole('1');

      expect(mockRoleModel.findByIdAndDelete).toHaveBeenCalledWith('1');
    });

    it('should throw error when deleting system role', async () => {
      const mockRole = { _id: '1', isSystem: true };
      mockRoleModel.findById.mockResolvedValue(mockRole);

      await expect(service.deleteRole('1')).rejects.toThrow(ForbiddenException);
    });
  });
});
