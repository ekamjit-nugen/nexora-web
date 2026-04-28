import { Test, TestingModule } from '@nestjs/testing';
import { SystemHealthController } from './system-health.controller';
import { SystemHealthService } from './system-health.service';

describe('SystemHealthController', () => {
  let controller: SystemHealthController;
  let service: SystemHealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SystemHealthController],
      providers: [
        {
          provide: SystemHealthService,
          useValue: {
            getSystemHealth: jest.fn(),
            getQueueMetrics: jest.fn(),
            getDatabaseStats: jest.fn(),
            getServiceDependencies: jest.fn(),
            getUptimeStats: jest.fn(),
            getPerformanceMetrics: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<SystemHealthController>(SystemHealthController);
    service = module.get<SystemHealthService>(SystemHealthService);
  });

  describe('getSystemHealth', () => {
    it('should return system health status', async () => {
      const mockHealth = {
        overallStatus: 'healthy',
        timestamp: new Date(),
        components: {
          database: { status: 'healthy', latency: '15ms' },
          memory: { status: 'healthy', utilization: '65%' },
          responseTime: { avgResponseTime: '45ms' },
          services: { allServicesUp: true, healthyServices: 5 },
        },
      };

      jest.spyOn(service, 'getSystemHealth').mockResolvedValue(mockHealth);

      const result = await controller.getSystemHealth();

      expect(result.success).toBe(true);
      expect(result.data.overallStatus).toBe('healthy');
      expect(service.getSystemHealth).toHaveBeenCalled();
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const mockMetrics = {
        emailQueue: { pending: 50, processing: 5, failed: 2 },
        notificationQueue: { pending: 200, processing: 10, failed: 1 },
        analyticsQueue: { pending: 500, processing: 30, failed: 0 },
        timestamp: new Date(),
      };

      jest.spyOn(service, 'getQueueMetrics').mockResolvedValue(mockMetrics);

      const result = await controller.getQueueMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('emailQueue');
      expect(result.data).toHaveProperty('notificationQueue');
      expect(result.data).toHaveProperty('analyticsQueue');
      expect(service.getQueueMetrics).toHaveBeenCalled();
    });
  });

  describe('getDatabaseStats', () => {
    it('should return database statistics', async () => {
      const mockStats = {
        collections: {
          users: 1000,
          organizations: 50,
          memberships: 500,
          auditLogs: 5000,
        },
        indexes: { created: 15, status: 'optimal' },
        storage: { used: '2.5GB', available: '97.5GB' },
        replication: { status: 'active', lag: '0ms' },
        timestamp: new Date(),
      };

      jest.spyOn(service, 'getDatabaseStats').mockResolvedValue(mockStats);

      const result = await controller.getDatabaseStats();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('collections');
      expect(result.data).toHaveProperty('indexes');
      expect(result.data).toHaveProperty('storage');
      expect(service.getDatabaseStats).toHaveBeenCalled();
    });
  });

  describe('getServiceDependencies', () => {
    it('should return service dependency status', async () => {
      const mockDeps = {
        mongodb: { status: 'connected', latency: '2ms', version: '5.0.0' },
        redis: { status: 'connected', latency: '1ms', version: '7.0.0' },
        elasticsearch: { status: 'connected', latency: '5ms', version: '8.0.0' },
        kafka: { status: 'connected', brokers: 3, topics: 12 },
        timestamp: new Date(),
      };

      jest.spyOn(service, 'getServiceDependencies').mockResolvedValue(mockDeps);

      const result = await controller.getServiceDependencies();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('mongodb');
      expect(result.data).toHaveProperty('redis');
      expect(result.data).toHaveProperty('elasticsearch');
      expect(result.data).toHaveProperty('kafka');
      expect(service.getServiceDependencies).toHaveBeenCalled();
    });
  });

  describe('getUptimeStats', () => {
    it('should return uptime statistics', async () => {
      const mockUptime = {
        uptime: '30d 5h 20m',
        startTime: new Date(Date.now() - 2592000000),
        lastRestartReason: 'deployment',
        systemRestarts: 2,
        incidentCount: 0,
        avgAvailability: '99.98%',
        timestamp: new Date(),
      };

      jest.spyOn(service, 'getUptimeStats').mockResolvedValue(mockUptime);

      const result = await controller.getUptimeStats();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('uptime');
      expect(result.data).toHaveProperty('startTime');
      expect(result.data).toHaveProperty('avgAvailability');
      expect(service.getUptimeStats).toHaveBeenCalled();
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockPerformance = {
        cpu: { usage: '45%', cores: 8 },
        memory: { usage: '60%', heap: '250MB' },
        network: { inbound: '500 Mbps', outbound: '300 Mbps' },
        disk: { usage: '65%' },
        timestamp: new Date(),
      };

      jest.spyOn(service, 'getPerformanceMetrics').mockResolvedValue(mockPerformance);

      const result = await controller.getPerformanceMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('cpu');
      expect(result.data).toHaveProperty('memory');
      expect(result.data).toHaveProperty('network');
      expect(result.data).toHaveProperty('disk');
      expect(service.getPerformanceMetrics).toHaveBeenCalled();
    });
  });
});
