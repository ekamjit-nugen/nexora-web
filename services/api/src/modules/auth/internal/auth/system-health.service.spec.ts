import { Test, TestingModule } from '@nestjs/testing';
import { SystemHealthService } from './system-health.service';
import { getModelToken } from '@nestjs/mongoose';

describe('SystemHealthService', () => {
  let service: SystemHealthService;
  let mockUserModel: any;

  beforeEach(async () => {
    mockUserModel = jest.fn();
    mockUserModel.countDocuments = jest.fn().mockReturnValue({
      limit: jest.fn().mockResolvedValue(1),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemHealthService,
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
      ],
    }).compile();

    service = module.get<SystemHealthService>(SystemHealthService);
  });

  describe('getSystemHealth', () => {
    it('should return system health status', async () => {
      const result = await service.getSystemHealth();

      expect(result).toHaveProperty('overallStatus');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('components');
      expect(result.components).toHaveProperty('database');
      expect(result.components).toHaveProperty('memory');
      expect(result.components).toHaveProperty('services');
    });

    it('should have healthy status when components are healthy', async () => {
      const result = await service.getSystemHealth();

      expect(['healthy', 'degraded']).toContain(result.overallStatus);
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const result = await service.getQueueMetrics();

      expect(result).toHaveProperty('emailQueue');
      expect(result).toHaveProperty('notificationQueue');
      expect(result).toHaveProperty('analyticsQueue');
      expect(result.emailQueue).toHaveProperty('pending');
      expect(result.emailQueue).toHaveProperty('processing');
      expect(result.emailQueue).toHaveProperty('failed');
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const result = await service.getDatabaseStats();

      expect(result).toHaveProperty('collections');
      expect(result).toHaveProperty('indexes');
      expect(result).toHaveProperty('storage');
      expect(result).toHaveProperty('replication');
    });
  });

  describe('getServiceDependencies', () => {
    it('should return service dependencies', async () => {
      const result = await service.getServiceDependencies();

      expect(result).toHaveProperty('mongodb');
      expect(result).toHaveProperty('redis');
      expect(result).toHaveProperty('elasticsearch');
      expect(result).toHaveProperty('kafka');
      expect(result.mongodb.status).toBe('connected');
    });
  });

  describe('getUptimeStats', () => {
    it('should return uptime statistics', async () => {
      const result = await service.getUptimeStats();

      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('startTime');
      expect(result).toHaveProperty('avgAvailability');
      expect(result.avgAvailability).toContain('%');
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const result = await service.getPerformanceMetrics();

      expect(result).toHaveProperty('cpu');
      expect(result).toHaveProperty('memory');
      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('disk');
      expect(result.cpu).toHaveProperty('usage');
      expect(result.memory).toHaveProperty('usage');
    });
  });
});
