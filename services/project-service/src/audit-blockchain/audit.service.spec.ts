import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AuditService', () => {
  let service: AuditService;
  let mockChainModel: any;
  let mockLogModel: any;
  let mockVerificationModel: any;

  beforeEach(async () => {
    mockChainModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ chainId: 'chain1' }),
    }));
    mockChainModel.findOne = jest.fn();

    mockLogModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ blockNumber: 1 }),
    }));
    mockLogModel.find = jest.fn();

    mockVerificationModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ verified: true }),
    }));
    mockVerificationModel.find = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: getModelToken('AuditChain'),
          useValue: mockChainModel,
        },
        {
          provide: getModelToken('AuditLog'),
          useValue: mockLogModel,
        },
        {
          provide: getModelToken('AuditVerification'),
          useValue: mockVerificationModel,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
  });

  describe('initializeChain', () => {
    it('should initialize audit chain with genesis block', async () => {
      mockChainModel.findOne.mockResolvedValue(null);

      const result = await service.initializeChain('prod1');

      expect(result).toBeDefined();
    });

    it('should throw error if chain already exists', async () => {
      mockChainModel.findOne.mockResolvedValue({ chainId: 'chain1' });

      await expect(service.initializeChain('prod1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordAction', () => {
    it('should record audit action to blockchain', async () => {
      const mockChain = {
        totalBlocks: 1,
        lastBlockHash: 'hash1',
        blocks: [],
        save: jest.fn(),
      };
      mockChainModel.findOne.mockResolvedValue(mockChain);

      await service.recordAction('prod1', 'create', 'document', 'doc1', 'user1', 'User One', {}, '192.168.1.1');

      expect(mockChain.save).toHaveBeenCalled();
    });

    it('should throw error if chain not initialized', async () => {
      mockChainModel.findOne.mockResolvedValue(null);

      await expect(
        service.recordAction('prod1', 'create', 'document', 'doc1', 'user1', 'User', {}, '192.168.1.1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getChain', () => {
    it('should get audit chain', async () => {
      const mockChain = { chainId: 'chain1', totalBlocks: 5 };
      mockChainModel.findOne.mockResolvedValue(mockChain);

      const result = await service.getChain('prod1');

      expect(result).toEqual(mockChain);
    });

    it('should throw error if chain not found', async () => {
      mockChainModel.findOne.mockResolvedValue(null);

      await expect(service.getChain('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs for product', async () => {
      const mockLogs = [
        { blockNumber: 2, action: 'update' },
        { blockNumber: 1, action: 'create' },
      ];
      mockLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await service.getAuditLogs('prod1', 50);

      expect(result.length).toBe(2);
    });
  });

  describe('getResourceAuditLogs', () => {
    it('should get audit logs for specific resource', async () => {
      const mockLogs = [
        { blockNumber: 2, resourceId: 'doc1', action: 'update' },
      ];
      mockLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockLogs),
        }),
      });

      const result = await service.getResourceAuditLogs('prod1', 'document', 'doc1');

      expect(result.length).toBe(1);
    });
  });

  describe('getUserAuditLogs', () => {
    it('should get audit logs for specific user', async () => {
      const mockLogs = [{ blockNumber: 2, userId: 'user1', action: 'update' }];
      mockLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockLogs),
        }),
      });

      const result = await service.getUserAuditLogs('prod1', 'user1');

      expect(result.length).toBe(1);
    });
  });

  describe('verifyChainIntegrity', () => {
    it('should verify chain integrity is valid', async () => {
      const mockChain = {
        blocks: [
          { blockNumber: 0, blockHash: 'genesis', previousHash: '' },
          {
            blockNumber: 1,
            blockHash: 'hash1',
            previousHash: 'genesis',
            timestamp: new Date(),
            action: 'create',
            resourceType: 'doc',
            resourceId: 'doc1',
            userId: 'user1',
            changes: {},
            nonce: 100,
          },
        ],
        integrity: false,
        save: jest.fn(),
      };
      mockChainModel.findOne.mockResolvedValue(mockChain);

      const result = await service.verifyChainIntegrity('prod1');

      expect(typeof result).toBe('boolean');
      expect(mockChain.save).toHaveBeenCalled();
    });
  });

  describe('verifyBlock', () => {
    it('should verify specific block in chain', async () => {
      const mockChain = {
        chainId: 'chain1',
        blocks: [
          { blockNumber: 0, blockHash: 'genesis', previousHash: '' },
          {
            blockNumber: 1,
            blockHash: 'hash1',
            previousHash: 'genesis',
            timestamp: new Date(),
            action: 'create',
            resourceType: 'doc',
            resourceId: 'doc1',
            userId: 'user1',
            changes: {},
            nonce: 100,
          },
        ],
      };
      mockChainModel.findOne.mockResolvedValue(mockChain);

      const result = await service.verifyBlock('prod1', 1);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('generateAuditReport', () => {
    it('should generate audit report', async () => {
      const mockChain = { integrity: true, totalBlocks: 10 };
      const mockLogs = [
        { action: 'create', userId: 'user1' },
        { action: 'update', userId: 'user1' },
        { action: 'delete', userId: 'user2' },
      ];
      mockChainModel.findOne.mockResolvedValue(mockChain);
      mockLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await service.generateAuditReport('prod1');

      expect(result).toHaveProperty('productId');
      expect(result).toHaveProperty('chainIntegrity');
      expect(result).toHaveProperty('actionBreakdown');
      expect(result).toHaveProperty('userActivity');
    });
  });

  describe('getChainStats', () => {
    it('should get chain statistics', async () => {
      const mockChain = { integrity: true, totalBlocks: 10, chainId: 'chain1' };
      const mockLogs = [
        { action: 'create' },
        { action: 'update' },
      ];
      mockChainModel.findOne.mockResolvedValue(mockChain);
      mockLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockLogs),
          }),
        }),
      });

      const result = await service.getChainStats('prod1');

      expect(result).toHaveProperty('totalBlocks');
      expect(result).toHaveProperty('integrity');
      expect(result).toHaveProperty('actionStats');
    });
  });
});
