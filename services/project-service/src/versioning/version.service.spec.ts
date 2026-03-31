import { Test, TestingModule } from '@nestjs/testing';
import { VersionService } from './version.service';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('VersionService', () => {
  let service: VersionService;
  let mockVersionModel: any;
  let mockHistoryModel: any;

  beforeEach(async () => {
    mockVersionModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ versionId: 'v1' }),
    }));
    mockVersionModel.findOne = jest.fn();
    mockVersionModel.find = jest.fn();
    mockVersionModel.deleteOne = jest.fn();

    mockHistoryModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ totalVersions: 1 }),
    }));
    mockHistoryModel.findOne = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VersionService,
        {
          provide: getModelToken('ProductVersion'),
          useValue: mockVersionModel,
        },
        {
          provide: getModelToken('VersionHistory'),
          useValue: mockHistoryModel,
        },
      ],
    }).compile();

    service = module.get<VersionService>(VersionService);
  });

  describe('createVersion', () => {
    it('should create version snapshot', async () => {
      mockHistoryModel.findOne.mockResolvedValue(null);

      const result = await service.createVersion('prod1', 'user1', {
        snapshotData: { name: 'Product' },
        action: 'create',
        changeDescription: 'Initial version',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getVersion', () => {
    it('should get version by id', async () => {
      const mockVersion = { versionId: 'v1', versionNumber: 1 };
      mockVersionModel.findOne.mockResolvedValue(mockVersion);

      const result = await service.getVersion('v1');

      expect(result).toEqual(mockVersion);
    });

    it('should throw error if version not found', async () => {
      mockVersionModel.findOne.mockResolvedValue(null);

      await expect(service.getVersion('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductVersions', () => {
    it('should return all versions for product', async () => {
      const mockVersions = [
        { versionId: 'v2', versionNumber: 2 },
        { versionId: 'v1', versionNumber: 1 },
      ];
      mockVersionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockVersions),
        }),
      });

      const result = await service.getProductVersions('prod1');

      expect(result.length).toBe(2);
    });
  });

  describe('getVersionAtTime', () => {
    it('should get version at specific timestamp', async () => {
      const mockVersion = { versionId: 'v1', createdAt: new Date('2026-03-31') };
      mockVersionModel.findOne.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockVersion),
        }),
      });

      const result = await service.getVersionAtTime('prod1', new Date('2026-03-31'));

      expect(result).toEqual(mockVersion);
    });
  });

  describe('restoreToVersion', () => {
    it('should restore to specific version', async () => {
      const targetVersion = {
        versionId: 'v1',
        productId: 'prod1',
        versionNumber: 1,
        snapshotData: { name: 'Product' },
      };
      mockVersionModel.findOne.mockResolvedValue(targetVersion);
      mockHistoryModel.findOne.mockResolvedValue(null);

      await service.restoreToVersion('prod1', 'v1', 'user1');

      expect(mockVersionModel.findOne).toHaveBeenCalled();
    });
  });

  describe('compareVersions', () => {
    it('should compare two versions and show differences', async () => {
      const v1 = {
        versionId: 'v1',
        snapshotData: { name: 'Product A', status: 'active' },
      };
      const v2 = {
        versionId: 'v2',
        snapshotData: { name: 'Product B', status: 'active' },
      };

      mockVersionModel.findOne
        .mockResolvedValueOnce(v1)
        .mockResolvedValueOnce(v2);

      const result = await service.compareVersions('v1', 'v2');

      expect(result).toHaveProperty('differences');
      expect(result.differences).toHaveProperty('modified');
    });
  });

  describe('publishVersion', () => {
    it('should publish version', async () => {
      const mockVersion = {
        versionId: 'v1',
        isPublished: false,
        save: jest.fn().mockResolvedValue({ isPublished: true }),
      };
      mockVersionModel.findOne.mockResolvedValue(mockVersion);

      await service.publishVersion('v1');

      expect(mockVersion.save).toHaveBeenCalled();
    });
  });

  describe('tagVersion', () => {
    it('should tag version', async () => {
      const mockVersion = {
        versionId: 'v1',
        tags: [],
        save: jest.fn().mockResolvedValue({ tags: ['release-1.0'] }),
      };
      mockVersionModel.findOne.mockResolvedValue(mockVersion);

      await service.tagVersion('v1', 'release-1.0');

      expect(mockVersion.save).toHaveBeenCalled();
    });

    it('should throw error if tag already exists', async () => {
      const mockVersion = {
        versionId: 'v1',
        tags: ['release-1.0'],
      };
      mockVersionModel.findOne.mockResolvedValue(mockVersion);

      await expect(service.tagVersion('v1', 'release-1.0')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDiffTimeline', () => {
    it('should get diff timeline for product', async () => {
      const mockVersions = [
        { versionNumber: 2, versionId: 'v2', action: 'update', createdAt: new Date() },
        { versionNumber: 1, versionId: 'v1', action: 'create', createdAt: new Date() },
      ];
      mockVersionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockVersions),
          }),
        }),
      });

      const result = await service.getDiffTimeline('prod1', 10);

      expect(result.length).toBe(2);
      expect(result[0]).toHaveProperty('versionNumber');
    });
  });

  describe('pruneOldVersions', () => {
    it('should prune old versions keeping recent ones', async () => {
      const versions = Array.from({ length: 60 }, (_, i) => ({
        versionNumber: i + 1,
        _id: `v${i}`,
      }));
      mockVersionModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(versions),
        }),
      });
      mockVersionModel.deleteOne.mockResolvedValue({});

      const result = await service.pruneOldVersions('prod1', 50);

      expect(result).toBe(10);
    });
  });
});
