import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { DependencyService } from './dependency.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('DependencyService', () => {
  let service: DependencyService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findOne: jest.fn(),
      findOneAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DependencyService,
        {
          provide: getModelToken('DependencyGraph'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<DependencyService>(DependencyService);
  });

  describe('getGraph', () => {
    it('should return existing dependency graph', async () => {
      const mockGraph = { productId: 'prod1', dependencies: [], impactAnalyses: [] };
      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.getGraph('prod1');

      expect(result).toEqual(mockGraph);
    });

    it('should create new graph if not exists', async () => {
      mockModel.findOne.mockResolvedValue(null);

      expect(async () => {
        await service.getGraph('prod1');
      }).toBeDefined();
    });
  });

  describe('addDependency', () => {
    it('should add dependency between products', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const dependency = {
        sourceProductId: 'prod1',
        targetProductId: 'prod2',
        type: 'depends-on' as const,
        severity: 'high' as const,
        description: 'Test dependency',
      };

      await service.addDependency('prod1', dependency);

      expect(mockGraph.save).toHaveBeenCalled();
    });

    it('should throw error for self-referencing dependency', async () => {
      const mockGraph = { productId: 'prod1', dependencies: [] };
      mockModel.findOne.mockResolvedValue(mockGraph);

      const dependency = {
        sourceProductId: 'prod1',
        targetProductId: 'prod1',
        type: 'depends-on' as const,
        severity: 'high' as const,
        description: 'Invalid',
      };

      await expect(service.addDependency('prod1', dependency)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          { id: 'dep1', sourceProductId: 'prod1', targetProductId: 'prod2' },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      await service.removeDependency('prod1', 'dep1');

      expect(mockGraph.dependencies).toHaveLength(0);
      expect(mockGraph.save).toHaveBeenCalled();
    });
  });

  describe('analyzeImpact', () => {
    it('should analyze impact of changes', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          {
            id: 'dep1',
            sourceProductId: 'prod1',
            targetProductId: 'prod2',
            type: 'impacts',
          },
          {
            id: 'dep2',
            sourceProductId: 'prod1',
            targetProductId: 'prod3',
            type: 'impacts',
          },
        ],
        impactAnalyses: [],
        lastAnalyzedAt: null,
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.analyzeImpact('prod1', 'prod1');

      expect(result.sourceProductId).toBe('prod1');
      expect(result.riskLevel).toBeDefined();
      expect(result.mitigation).toBeDefined();
    });

    it('should classify critical risk for many affected products', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: Array.from({ length: 15 }, (_, i) => ({
          id: `dep${i}`,
          sourceProductId: 'prod1',
          targetProductId: `prod${i + 2}`,
          type: 'impacts',
        })),
        impactAnalyses: [],
        lastAnalyzedAt: null,
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.analyzeImpact('prod1', 'prod1');

      expect(result.riskLevel).toBe('critical');
    });
  });

  describe('getGraphVisualization', () => {
    it('should return graph visualization data', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          {
            sourceProductId: 'prod1',
            targetProductId: 'prod2',
            type: 'impacts',
            severity: 'high',
          },
          {
            sourceProductId: 'prod2',
            targetProductId: 'prod3',
            type: 'depends-on',
            severity: 'medium',
          },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.getGraphVisualization('prod1');

      expect(result.nodes).toBeDefined();
      expect(result.edges).toBeDefined();
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.edges).toHaveLength(2);
    });
  });

  describe('getCriticalPaths', () => {
    it('should identify critical dependency paths', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          { sourceProductId: 'prod1', targetProductId: 'prod2', severity: 'critical' },
          { sourceProductId: 'prod2', targetProductId: 'prod3', severity: 'high' },
          { sourceProductId: 'prod3', targetProductId: 'prod4', severity: 'critical' },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.getCriticalPaths('prod1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(['prod1', 'prod2']);
    });
  });

  describe('updateDependency', () => {
    it('should update dependency severity', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          { id: 'dep1', severity: 'high', sourceProductId: 'prod1', targetProductId: 'prod2' },
        ],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      await service.updateDependency('prod1', 'dep1', { severity: 'critical' });

      expect(mockGraph.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if dependency not found', async () => {
      const mockGraph = { productId: 'prod1', dependencies: [] };
      mockModel.findOne.mockResolvedValue(mockGraph);

      await expect(
        service.updateDependency('prod1', 'nonexistent', {}),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductDependencies', () => {
    it('should return all dependencies for a product', async () => {
      const mockGraph = {
        productId: 'prod1',
        dependencies: [
          { id: 'dep1', sourceProductId: 'prod1', targetProductId: 'prod2' },
          { id: 'dep2', sourceProductId: 'prod1', targetProductId: 'prod3' },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.getProductDependencies('prod1');

      expect(result).toHaveLength(2);
    });
  });

  describe('getImpactAnalyses', () => {
    it('should return impact analyses', async () => {
      const mockGraph = {
        productId: 'prod1',
        impactAnalyses: [
          {
            sourceProductId: 'prod1',
            affectedProducts: ['prod2', 'prod3'],
            riskLevel: 'high',
          },
        ],
      };

      mockModel.findOne.mockResolvedValue(mockGraph);

      const result = await service.getImpactAnalyses('prod1');

      expect(result).toHaveLength(1);
      expect(result[0].affectedProducts).toHaveLength(2);
    });
  });

  describe('deleteGraph', () => {
    it('should delete dependency graph', async () => {
      mockModel.findOneAndDelete.mockResolvedValue({});

      await service.deleteGraph('prod1');

      expect(mockModel.findOneAndDelete).toHaveBeenCalledWith({ productId: 'prod1' });
    });
  });
});
