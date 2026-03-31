import { Test, TestingModule } from '@nestjs/testing';
import { PWAService } from './pwa.service';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PWAService', () => {
  let service: PWAService;
  let mockConfigModel: any;
  let mockOfflineStoreModel: any;
  let mockCacheModel: any;

  beforeEach(async () => {
    mockConfigModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ productId: 'prod1' }),
    }));
    mockConfigModel.findOne = jest.fn();

    mockOfflineStoreModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ storeId: 'store1' }),
    }));
    mockOfflineStoreModel.findOne = jest.fn();
    mockOfflineStoreModel.find = jest.fn();
    mockOfflineStoreModel.countDocuments = jest.fn();

    mockCacheModel = jest.fn().mockImplementation(() => ({
      save: jest.fn().mockResolvedValue({ productId: 'prod1' }),
    }));
    mockCacheModel.findOne = jest.fn();
    mockCacheModel.find = jest.fn();
    mockCacheModel.deleteOne = jest.fn();
    mockCacheModel.deleteMany = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PWAService,
        {
          provide: getModelToken('PWAConfig'),
          useValue: mockConfigModel,
        },
        {
          provide: getModelToken('OfflineStore'),
          useValue: mockOfflineStoreModel,
        },
        {
          provide: getModelToken('ServiceWorkerCache'),
          useValue: mockCacheModel,
        },
      ],
    }).compile();

    service = module.get<PWAService>(PWAService);
  });

  describe('createPWAConfig', () => {
    it('should create PWA configuration', async () => {
      mockConfigModel.findOne.mockResolvedValue(null);

      const result = await service.createPWAConfig('prod1', {
        appName: 'Nexora',
        appShortName: 'NXO',
        appDescription: 'Nexora Platform',
        startUrl: '/',
      });

      expect(result).toBeDefined();
    });

    it('should throw error if config already exists', async () => {
      mockConfigModel.findOne.mockResolvedValue({ productId: 'prod1' });

      await expect(
        service.createPWAConfig('prod1', { appName: 'Nexora' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPWAConfig', () => {
    it('should get PWA config by product id', async () => {
      const mockConfig = { productId: 'prod1', appName: 'Nexora' };
      mockConfigModel.findOne.mockResolvedValue(mockConfig);

      const result = await service.getPWAConfig('prod1');

      expect(result).toEqual(mockConfig);
    });

    it('should throw error if config not found', async () => {
      mockConfigModel.findOne.mockResolvedValue(null);

      await expect(service.getPWAConfig('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateManifest', () => {
    it('should generate manifest.json', async () => {
      const mockConfig = {
        appName: 'Nexora',
        appShortName: 'NXO',
        appDescription: 'Nexora Platform',
        startUrl: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme: {
          primaryColor: '#2196F3',
          backgroundColor: '#FFFFFF',
          statusBarColor: '#1976D2',
        },
        icons: [],
        screenshots: [],
      };
      mockConfigModel.findOne.mockResolvedValue(mockConfig);

      const result = await service.generateManifest('prod1');

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('short_name');
      expect(result.name).toBe('Nexora');
    });
  });

  describe('storeOfflineData', () => {
    it('should store offline data', async () => {
      const result = await service.storeOfflineData('prod1', 'user1', 'document', 'doc1', {
        title: 'My Doc',
      });

      expect(result).toBeDefined();
    });
  });

  describe('getUserOfflineData', () => {
    it('should get pending offline data for user', async () => {
      const mockData = [{ storeId: 'store1', status: 'pending' }];
      mockOfflineStoreModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.getUserOfflineData('prod1', 'user1');

      expect(result.length).toBe(1);
    });
  });

  describe('syncOfflineData', () => {
    it('should sync offline data', async () => {
      const mockData = [
        { status: 'pending', save: jest.fn() },
        { status: 'pending', save: jest.fn() },
      ];
      mockOfflineStoreModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.syncOfflineData('prod1', 'user1');

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('conflicts');
    });
  });

  describe('getOfflineConflicts', () => {
    it('should get conflict items', async () => {
      const mockData = [{ storeId: 'store1', status: 'conflict' }];
      mockOfflineStoreModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockData),
      });

      const result = await service.getOfflineConflicts('prod1', 'user1');

      expect(result.length).toBe(1);
    });
  });

  describe('cacheResponse', () => {
    it('should cache API response', async () => {
      mockCacheModel.findOne.mockResolvedValue(null);

      await service.cacheResponse('prod1', 'cache1', ['/api/users', '/api/posts'], 'application/json');

      expect(mockCacheModel.findOne).toHaveBeenCalled();
    });
  });

  describe('getCacheSize', () => {
    it('should calculate total cache size', async () => {
      const mockCaches = [
        {
          entries: [
            { size: 100 },
            { size: 200 },
          ],
        },
      ];
      mockCacheModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockCaches),
      });

      const result = await service.getCacheSize('prod1');

      expect(result).toBe(300);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache for product', async () => {
      mockCacheModel.deleteMany.mockResolvedValue({});

      await service.clearCache('prod1');

      expect(mockCacheModel.deleteMany).toHaveBeenCalledWith({ productId: 'prod1' });
    });

    it('should clear specific cache key', async () => {
      mockCacheModel.deleteOne.mockResolvedValue({});

      await service.clearCache('prod1', 'cache1');

      expect(mockCacheModel.deleteOne).toHaveBeenCalled();
    });
  });

  describe('generateServiceWorkerCode', () => {
    it('should generate service worker code', () => {
      const code = service.generateServiceWorkerCode();

      expect(code).toContain('CACHE_NAME');
      expect(code).toContain('fetch');
      expect(code).toContain('install');
    });
  });

  describe('getPWAMetrics', () => {
    it('should get PWA health metrics', async () => {
      const mockConfig = {
        appName: 'Nexora',
        updatedAt: new Date(),
      };
      mockConfigModel.findOne.mockResolvedValue(mockConfig);
      mockCacheModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      mockOfflineStoreModel.countDocuments.mockResolvedValue(5);

      const result = await service.getPWAMetrics('prod1');

      expect(result).toHaveProperty('appName');
      expect(result).toHaveProperty('hasManifest');
      expect(result).toHaveProperty('pendingSyncCount');
    });
  });
});
