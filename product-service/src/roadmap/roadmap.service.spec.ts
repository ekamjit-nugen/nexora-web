import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { RoadmapService } from './roadmap.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RoadmapService', () => {
  let service: RoadmapService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      findById: jest.fn(),
      findOne: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoadmapService,
        {
          provide: getModelToken('Roadmap'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<RoadmapService>(RoadmapService);
  });

  describe('createRoadmap', () => {
    it('should create a roadmap with valid dates', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-12-31');

      const roadmapData = {
        name: 'Q2-Q4 Roadmap',
        description: 'Test roadmap',
        phases: [],
        startDate,
        endDate,
      };

      expect(async () => {
        await service.createRoadmap('prod1', roadmapData);
      }).toBeDefined();
    });

    it('should throw error if start date is after end date', async () => {
      const startDate = new Date('2026-12-31');
      const endDate = new Date('2026-04-01');

      const roadmapData = {
        name: 'Invalid Roadmap',
        phases: [],
        startDate,
        endDate,
      };

      await expect(service.createRoadmap('prod1', roadmapData as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getRoadmap', () => {
    it('should retrieve a roadmap by id', async () => {
      const mockRoadmap = { _id: 'roadmap1', name: 'Test Roadmap' };
      mockModel.findById.mockResolvedValue(mockRoadmap);

      const result = await service.getRoadmap('roadmap1');

      expect(result).toEqual(mockRoadmap);
    });

    it('should throw NotFoundException if roadmap not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getRoadmap('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductRoadmap', () => {
    it('should retrieve product roadmap', async () => {
      const mockRoadmap = { _id: 'roadmap1', productId: 'prod1' };
      mockModel.findOne.mockResolvedValue(mockRoadmap);

      const result = await service.getProductRoadmap('prod1');

      expect(result).toEqual(mockRoadmap);
    });

    it('should throw NotFoundException if not found', async () => {
      mockModel.findOne.mockResolvedValue(null);

      await expect(service.getProductRoadmap('prod1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPhase', () => {
    it('should add a phase to roadmap', async () => {
      const mockRoadmap = {
        phases: [],
        save: jest.fn().mockResolvedValue({}),
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      const phase = {
        id: 'phase1',
        name: 'Phase 1',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-05-31'),
        status: 'planned',
        features: [],
        milestones: [],
      };

      await service.addPhase('roadmap1', phase);

      expect(mockRoadmap.save).toHaveBeenCalled();
    });

    it('should throw error if phase dates are invalid', async () => {
      const mockRoadmap = { phases: [] };
      mockModel.findById.mockResolvedValue(mockRoadmap);

      const phase = {
        id: 'phase1',
        name: 'Phase 1',
        startDate: new Date('2026-05-31'),
        endDate: new Date('2026-04-01'),
        status: 'planned',
        features: [],
        milestones: [],
      };

      await expect(service.addPhase('roadmap1', phase)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTimeline', () => {
    it('should return timeline view', async () => {
      const mockRoadmap = {
        productId: 'prod1',
        name: 'Test Roadmap',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-12-31'),
        phases: [
          {
            id: 'phase1',
            name: 'Phase 1',
            startDate: new Date('2026-04-01'),
            endDate: new Date('2026-05-31'),
            features: ['f1', 'f2'],
            milestones: [{ name: 'M1' }],
          },
        ],
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      const result = await service.getTimeline('roadmap1');

      expect(result.productId).toBe('prod1');
      expect(result.phases).toHaveLength(1);
    });
  });

  describe('getRoadmapStats', () => {
    it('should return roadmap statistics', async () => {
      const mockRoadmap = {
        phases: [
          {
            id: 'phase1',
            name: 'Phase 1',
            features: ['f1', 'f2'],
            milestones: [
              { name: 'M1', status: 'completed' },
              { name: 'M2', status: 'planned' },
            ],
          },
        ],
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      const result = await service.getRoadmapStats('roadmap1');

      expect(result.totalPhases).toBe(1);
      expect(result.totalFeatures).toBe(2);
      expect(result.totalMilestones).toBe(2);
    });
  });

  describe('exportRoadmap', () => {
    it('should export roadmap as JSON', async () => {
      const mockRoadmap = {
        toObject: jest.fn().mockReturnValue({ name: 'Test' }),
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      const result = await service.exportRoadmap('roadmap1', 'json');

      expect(result).toBeDefined();
    });

    it('should export roadmap as CSV', async () => {
      const mockRoadmap = {
        name: 'Test Roadmap',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-12-31'),
        phases: [],
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      const result = await service.exportRoadmap('roadmap1', 'csv');

      expect(typeof result).toBe('string');
      expect(result).toContain('Test Roadmap');
    });
  });

  describe('shareRoadmap', () => {
    it('should update roadmap visibility', async () => {
      const mockRoadmap = {
        visibility: 'private',
        save: jest.fn().mockResolvedValue({ visibility: 'public' }),
      };

      mockModel.findById.mockResolvedValue(mockRoadmap);

      await service.shareRoadmap('roadmap1', 'public');

      expect(mockRoadmap.save).toHaveBeenCalled();
    });
  });
});
