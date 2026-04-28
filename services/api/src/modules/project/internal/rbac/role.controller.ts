import { Controller, Post, Get, Put, Delete, Body, Param } from '@nestjs/common';
import { RoleService } from './role.service';
import { IPermission } from './role.model';

@Controller('api/v1/rbac')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  /**
   * Create role
   */
  @Post('roles')
  async createRole(@Body() body: any) {
    return this.roleService.createRole(body.productId, {
      name: body.name,
      description: body.description,
      permissions: body.permissions,
      parentRoles: body.parentRoles,
    });
  }

  /**
   * Get role
   */
  @Get('roles/:id')
  async getRole(@Param('id') id: string) {
    return this.roleService.getRole(id);
  }

  /**
   * Get product roles
   */
  @Get('product/:productId/roles')
  async getProductRoles(@Param('productId') productId: string) {
    return this.roleService.getProductRoles(productId);
  }

  /**
   * Update role
   */
  @Put('roles/:id')
  async updateRole(@Param('id') id: string, @Body() body: any) {
    return this.roleService.updateRole(id, body);
  }

  /**
   * Add permission
   */
  @Post('roles/:id/permissions')
  async addPermission(@Param('id') id: string, @Body() permission: IPermission) {
    return this.roleService.addPermission(id, permission);
  }

  /**
   * Remove permission
   */
  @Delete('roles/:id/permissions/:resource/:action')
  async removePermission(
    @Param('id') id: string,
    @Param('resource') resource: string,
    @Param('action') action: string,
  ) {
    return this.roleService.removePermission(id, resource, action);
  }

  /**
   * Assign role to user
   */
  @Post('users/:userId/assign-role')
  async assignRole(@Param('userId') userId: string, @Body() body: any) {
    return this.roleService.assignRole(
      body.productId,
      userId,
      body.roleId,
      body.grantedBy,
      body.expiresAt,
    );
  }

  /**
   * Revoke role from user
   */
  @Post('users/:userId/revoke-role')
  async revokeRole(@Param('userId') userId: string, @Body() body: any) {
    await this.roleService.revokeRole(body.productId, userId, body.roleId);
    return { success: true };
  }

  /**
   * Get user roles
   */
  @Get('product/:productId/users/:userId/roles')
  async getUserRoles(
    @Param('productId') productId: string,
    @Param('userId') userId: string,
  ) {
    return this.roleService.getUserRoles(productId, userId);
  }

  /**
   * Check permission
   */
  @Post('check-permission')
  async checkPermission(@Body() body: any) {
    const hasPermission = await this.roleService.checkPermission(
      body.productId,
      body.userId,
      body.resource,
      body.action,
    );
    return { hasPermission };
  }

  /**
   * Get role hierarchy
   */
  @Get('roles/:id/hierarchy')
  async getRoleHierarchy(@Param('id') id: string) {
    return this.roleService.getRoleHierarchy(id);
  }

  /**
   * Get user assignments
   */
  @Get('product/:productId/users/:userId/assignments')
  async getUserAssignments(
    @Param('productId') productId: string,
    @Param('userId') userId: string,
  ) {
    return this.roleService.getUserAssignments(productId, userId);
  }

  /**
   * Delete role
   */
  @Delete('roles/:id')
  async deleteRole(@Param('id') id: string) {
    await this.roleService.deleteRole(id);
    return { success: true };
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'rbac' };
  }
}
