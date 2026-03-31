import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IRole, IRoleAssignment, IPermission } from './role.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RoleService {
  constructor(
    @InjectModel('Role') private roleModel: Model<IRole>,
    @InjectModel('RoleAssignment') private assignmentModel: Model<IRoleAssignment>,
  ) {
    this.initializeSystemRoles();
  }

  /**
   * Initialize system roles
   */
  private async initializeSystemRoles(): Promise<void> {
    // System roles initialization happens once on startup
  }

  /**
   * Create role
   */
  async createRole(
    productId: string,
    roleData: {
      name: string;
      description?: string;
      permissions: IPermission[];
      parentRoles?: string[];
      isSystem?: boolean;
    },
  ): Promise<IRole> {
    const existingRole = await this.roleModel.findOne({ productId, name: roleData.name });
    if (existingRole && !roleData.isSystem) {
      throw new BadRequestException('Role with this name already exists');
    }

    const role = new this.roleModel({
      productId,
      ...roleData,
      isSystem: roleData.isSystem || false,
      priority: 0,
    });

    return role.save();
  }

  /**
   * Get role
   */
  async getRole(roleId: string): Promise<IRole> {
    const role = await this.roleModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  /**
   * Get product roles
   */
  async getProductRoles(productId: string): Promise<IRole[]> {
    return this.roleModel.find({ productId }).sort({ priority: -1 }).exec();
  }

  /**
   * Update role
   */
  async updateRole(roleId: string, updates: Partial<IRole>): Promise<IRole> {
    const role = await this.getRole(roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    Object.assign(role, updates);
    return role.save();
  }

  /**
   * Add permission to role
   */
  async addPermission(roleId: string, permission: IPermission): Promise<IRole> {
    const role = await this.getRole(roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    const exists = role.permissions.some(
      p => p.resource === permission.resource && p.action === permission.action,
    );

    if (exists) {
      throw new BadRequestException('Permission already exists for this role');
    }

    role.permissions.push(permission);
    return role.save();
  }

  /**
   * Remove permission from role
   */
  async removePermission(roleId: string, resource: string, action: string): Promise<IRole> {
    const role = await this.getRole(roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot modify system roles');
    }

    role.permissions = role.permissions.filter(
      p => !(p.resource === resource && p.action === action),
    );

    return role.save();
  }

  /**
   * Assign role to user
   */
  async assignRole(
    productId: string,
    userId: string,
    roleId: string,
    grantedBy: string,
    expiresAt?: Date,
  ): Promise<IRoleAssignment> {
    const role = await this.roleModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Check for duplicate active assignment
    const existing = await this.assignmentModel.findOne({
      productId,
      userId,
      roleId,
      isActive: true,
    });

    if (existing) {
      throw new BadRequestException('User already has this role');
    }

    const assignment = new this.assignmentModel({
      productId,
      userId,
      roleId,
      assignedAt: new Date(),
      expiresAt,
      grantedBy,
      isActive: true,
    });

    return assignment.save();
  }

  /**
   * Revoke role from user
   */
  async revokeRole(productId: string, userId: string, roleId: string): Promise<void> {
    await this.assignmentModel.updateOne(
      { productId, userId, roleId, isActive: true },
      { isActive: false },
    );
  }

  /**
   * Get user roles
   */
  async getUserRoles(productId: string, userId: string): Promise<IRole[]> {
    const assignments = await this.assignmentModel
      .find({
        productId,
        userId,
        isActive: true,
      })
      .exec();

    const roleIds = assignments.map(a => a.roleId);
    return this.roleModel.find({ _id: { $in: roleIds } }).exec();
  }

  /**
   * Check permission
   */
  async checkPermission(
    productId: string,
    userId: string,
    resource: string,
    action: string,
  ): Promise<boolean> {
    const roles = await this.getUserRoles(productId, userId);

    // Check if any role has the permission
    for (const role of roles) {
      const hasPermission = role.permissions.some(
        p => p.resource === resource && p.action === action,
      );

      if (hasPermission) {
        return true;
      }

      // Check parent roles
      if (role.parentRoles && role.parentRoles.length > 0) {
        for (const parentRoleId of role.parentRoles) {
          const parentRole = await this.getRole(parentRoleId);
          const parentHasPermission = parentRole.permissions.some(
            p => p.resource === resource && p.action === action,
          );
          if (parentHasPermission) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get role hierarchy
   */
  async getRoleHierarchy(roleId: string): Promise<any> {
    const role = await this.getRole(roleId);

    const hierarchy = {
      roleId: role._id,
      name: role.name,
      permissions: role.permissions.length,
      children: [] as any[],
    };

    if (role.parentRoles && role.parentRoles.length > 0) {
      for (const parentId of role.parentRoles) {
        const parent = await this.getRole(parentId);
        hierarchy.children.push({
          roleId: parent._id,
          name: parent.name,
          permissions: parent.permissions.length,
        });
      }
    }

    return hierarchy;
  }

  /**
   * Get role assignments for user
   */
  async getUserAssignments(productId: string, userId: string): Promise<IRoleAssignment[]> {
    return this.assignmentModel
      .find({ productId, userId, isActive: true })
      .sort({ assignedAt: -1 })
      .exec();
  }

  /**
   * Delete role
   */
  async deleteRole(roleId: string): Promise<void> {
    const role = await this.getRole(roleId);

    if (role.isSystem) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    await this.roleModel.findByIdAndDelete(roleId);
  }
}
