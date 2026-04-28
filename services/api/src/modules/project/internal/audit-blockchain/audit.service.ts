import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAuditChain, IAuditLog, IAuditVerification, IAuditBlock } from './audit.model';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuditService {
  constructor(
    @InjectModel('AuditChain', 'nexora_projects') private auditChainModel: Model<IAuditChain>,
    @InjectModel('AuditLog', 'nexora_projects') private auditLogModel: Model<IAuditLog>,
    @InjectModel('AuditVerification', 'nexora_projects') private verificationModel: Model<IAuditVerification>,
  ) {}

  /**
   * Initialize audit chain for product
   */
  async initializeChain(productId: string): Promise<IAuditChain> {
    const existing = await this.auditChainModel.findOne({ productId });
    if (existing) {
      throw new BadRequestException('Audit chain already exists');
    }

    const chainId = uuidv4();
    const genesisBlock = this.createBlock(
      0,
      '',
      'initialize',
      'system',
      productId,
      'system',
      { initialized: true },
    );

    const chain = new this.auditChainModel({
      productId,
      chainId,
      blocks: [genesisBlock],
      lastBlockHash: genesisBlock.blockHash,
      totalBlocks: 1,
      integrity: true,
    });

    return chain.save();
  }

  /**
   * Create audit block
   */
  private createBlock(
    blockNumber: number,
    previousHash: string,
    action: string,
    resourceType: string,
    resourceId: string,
    userId: string,
    changes: Record<string, any>,
  ): IAuditBlock {
    const nonce = Math.random() * 1000000;
    const timestamp = new Date();

    const blockData = {
      blockNumber,
      previousHash,
      timestamp,
      action,
      resourceType,
      resourceId,
      userId,
      changes,
      nonce,
    };

    const blockHash = this.hashBlock(blockData);
    const merkleRoot = this.calculateMerkleRoot([blockHash]);

    return {
      blockNumber,
      blockHash,
      previousHash,
      timestamp,
      action,
      resourceType,
      resourceId,
      userId,
      changes,
      nonce,
      merkleRoot,
    };
  }

  /**
   * Hash block data using SHA-256
   */
  private hashBlock(data: any): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data))
      .digest('hex');
  }

  /**
   * Calculate merkle root
   */
  private calculateMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];

    const tree = [...hashes];
    while (tree.length > 1) {
      const newLevel = [];
      for (let i = 0; i < tree.length; i += 2) {
        const combined = tree[i] + (tree[i + 1] || tree[i]);
        newLevel.push(this.hashBlock(combined));
      }
      tree.length = 0;
      tree.push(...newLevel);
    }

    return tree[0];
  }

  /**
   * Record audit action
   */
  async recordAction(
    productId: string,
    action: 'create' | 'read' | 'update' | 'delete' | 'execute',
    resourceType: string,
    resourceId: string,
    userId: string,
    userName: string,
    changes: Record<string, any>,
    ipAddress: string,
  ): Promise<IAuditLog> {
    const chain = await this.auditChainModel.findOne({ productId });
    if (!chain) {
      throw new NotFoundException('Audit chain not initialized');
    }

    const blockNumber = chain.totalBlocks;
    const previousHash = chain.lastBlockHash;

    const newBlock = this.createBlock(
      blockNumber,
      previousHash,
      action,
      resourceType,
      resourceId,
      userId,
      changes,
    );

    // Add block to chain
    chain.blocks.push(newBlock);
    chain.lastBlockHash = newBlock.blockHash;
    chain.totalBlocks += 1;
    await chain.save();

    // Create audit log entry
    const log = new this.auditLogModel({
      productId,
      blockNumber,
      action,
      resourceType,
      resourceId,
      userId,
      userName,
      changes,
      ipAddress,
      status: 'success',
      timestamp: new Date(),
      blockHash: newBlock.blockHash,
    });

    return log.save();
  }

  /**
   * Get audit chain
   */
  async getChain(productId: string): Promise<IAuditChain> {
    const chain = await this.auditChainModel.findOne({ productId });
    if (!chain) {
      throw new NotFoundException('Audit chain not found');
    }
    return chain;
  }

  /**
   * Get audit logs for product
   */
  async getAuditLogs(productId: string, limit: number = 50): Promise<IAuditLog[]> {
    return this.auditLogModel
      .find({ productId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Get audit logs by resource
   */
  async getResourceAuditLogs(
    productId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<IAuditLog[]> {
    return this.auditLogModel
      .find({ productId, resourceType, resourceId })
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Get audit logs by user
   */
  async getUserAuditLogs(productId: string, userId: string): Promise<IAuditLog[]> {
    return this.auditLogModel
      .find({ productId, userId })
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Verify chain integrity
   */
  async verifyChainIntegrity(productId: string): Promise<boolean> {
    const chain = await this.getChain(productId);

    for (let i = 1; i < chain.blocks.length; i++) {
      const block = chain.blocks[i];
      const previousBlock = chain.blocks[i - 1];

      // Verify hash chain
      if (block.previousHash !== previousBlock.blockHash) {
        chain.integrity = false;
        await chain.save();
        return false;
      }

      // Verify block hash
      const recalculatedHash = this.hashBlock({
        blockNumber: block.blockNumber,
        previousHash: block.previousHash,
        timestamp: block.timestamp,
        action: block.action,
        resourceType: block.resourceType,
        resourceId: block.resourceId,
        userId: block.userId,
        changes: block.changes,
        nonce: block.nonce,
      });

      if (recalculatedHash !== block.blockHash) {
        chain.integrity = false;
        await chain.save();
        return false;
      }
    }

    chain.integrity = true;
    await chain.save();
    return true;
  }

  /**
   * Verify specific block
   */
  async verifyBlock(productId: string, blockNumber: number): Promise<boolean> {
    const chain = await this.getChain(productId);
    const block = chain.blocks[blockNumber];

    if (!block) {
      return false;
    }

    const recalculatedHash = this.hashBlock({
      blockNumber: block.blockNumber,
      previousHash: block.previousHash,
      timestamp: block.timestamp,
      action: block.action,
      resourceType: block.resourceType,
      resourceId: block.resourceId,
      userId: block.userId,
      changes: block.changes,
      nonce: block.nonce,
    });

    const verified = recalculatedHash === block.blockHash;

    // Create verification record
    const verification = new this.verificationModel({
      productId,
      chainId: chain.chainId,
      blockNumber,
      verified,
      verificationHash: recalculatedHash,
      verificationMethod: 'sha256',
      verifiedAt: new Date(),
    });

    await verification.save();
    return verified;
  }

  /**
   * Generate audit report
   */
  async generateAuditReport(
    productId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    const chain = await this.getChain(productId);
    let logs = await this.getAuditLogs(productId, 1000);

    if (startDate || endDate) {
      logs = logs.filter(log => {
        if (startDate && log.timestamp < startDate) return false;
        if (endDate && log.timestamp > endDate) return false;
        return true;
      });
    }

    const actions = {};
    const users = {};
    const resources = {};

    for (const log of logs) {
      actions[log.action] = (actions[log.action] || 0) + 1;
      users[log.userId] = (users[log.userId] || 0) + 1;
      const key = `${log.resourceType}:${log.resourceId}`;
      resources[key] = (resources[key] || 0) + 1;
    }

    return {
      productId,
      chainIntegrity: chain.integrity,
      totalBlocks: chain.totalBlocks,
      totalLogs: logs.length,
      period: {
        start: startDate || logs[logs.length - 1]?.timestamp,
        end: endDate || logs[0]?.timestamp,
      },
      actionBreakdown: actions,
      userActivity: users,
      resourceChanges: resources,
      generatedAt: new Date(),
    };
  }

  /**
   * Get chain statistics
   */
  async getChainStats(productId: string): Promise<any> {
    const chain = await this.getChain(productId);
    const logs = await this.getAuditLogs(productId, 10000);

    const actions = logs.reduce((acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      productId,
      totalBlocks: chain.totalBlocks,
      chainId: chain.chainId,
      integrity: chain.integrity,
      totalAuditLogs: logs.length,
      actionStats: actions,
      oldestLog: logs[logs.length - 1]?.timestamp,
      newestLog: logs[0]?.timestamp,
    };
  }
}
