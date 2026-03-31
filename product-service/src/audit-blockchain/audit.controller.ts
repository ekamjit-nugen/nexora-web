import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * Initialize audit chain
   */
  @Post('chain/init')
  async initializeChain(@Body() body: any) {
    return this.auditService.initializeChain(body.productId);
  }

  /**
   * Record audit action
   */
  @Post('log')
  async recordAction(@Body() body: any) {
    return this.auditService.recordAction(
      body.productId,
      body.action,
      body.resourceType,
      body.resourceId,
      body.userId,
      body.userName,
      body.changes,
      body.ipAddress,
    );
  }

  /**
   * Get audit chain
   */
  @Get('chain/:productId')
  async getChain(@Param('productId') productId: string) {
    return this.auditService.getChain(productId);
  }

  /**
   * Get audit logs
   */
  @Get('logs/:productId')
  async getAuditLogs(
    @Param('productId') productId: string,
    @Query('limit') limit: number = 50,
  ) {
    return this.auditService.getAuditLogs(productId, limit);
  }

  /**
   * Get resource audit logs
   */
  @Get('logs/:productId/resource/:resourceType/:resourceId')
  async getResourceAuditLogs(
    @Param('productId') productId: string,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.getResourceAuditLogs(productId, resourceType, resourceId);
  }

  /**
   * Get user audit logs
   */
  @Get('logs/:productId/user/:userId')
  async getUserAuditLogs(
    @Param('productId') productId: string,
    @Param('userId') userId: string,
  ) {
    return this.auditService.getUserAuditLogs(productId, userId);
  }

  /**
   * Verify chain integrity
   */
  @Post('verify/chain/:productId')
  async verifyChainIntegrity(@Param('productId') productId: string) {
    const isValid = await this.auditService.verifyChainIntegrity(productId);
    return { productId, chainValid: isValid };
  }

  /**
   * Verify specific block
   */
  @Post('verify/block/:productId/:blockNumber')
  async verifyBlock(
    @Param('productId') productId: string,
    @Param('blockNumber') blockNumber: number,
  ) {
    const isValid = await this.auditService.verifyBlock(productId, blockNumber);
    return { productId, blockNumber, blockValid: isValid };
  }

  /**
   * Generate audit report
   */
  @Get('report/:productId')
  async generateAuditReport(
    @Param('productId') productId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.auditService.generateAuditReport(
      productId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Get chain statistics
   */
  @Get('stats/:productId')
  async getChainStats(@Param('productId') productId: string) {
    return this.auditService.getChainStats(productId);
  }

  /**
   * Health check
   */
  @Get('health/status')
  async health() {
    return { status: 'healthy', service: 'audit-blockchain' };
  }
}
