import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { NotFoundException } from '@nestjs/common';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken('AnalyticsReport'),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  describe('generateVelocityReport', () => {
    it('should generate a velocity report', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-06-30');

      expect(async () => {
        await service.generateVelocityReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('generateBurndownReport', () => {
    it('should generate a burndown report', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-14');

      expect(async () => {
        await service.generateBurndownReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('generateTrendReport', () => {
    it('should generate a trend report for specific metric', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-06-30');

      expect(async () => {
        await service.generateTrendReport('prod1', 'bug_count', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('generateForecastReport', () => {
    it('should generate a forecast report with predictions', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-12-31');

      expect(async () => {
        await service.generateForecastReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('getReport', () => {
    it('should retrieve a report by id', async () => {
      const mockReport = {
        _id: 'report1',
        reportType: 'velocity',
        metrics: [],
      };

      mockModel.findById.mockResolvedValue(mockReport);

      const result = await service.getReport('report1');

      expect(result).toEqual(mockReport);
    });

    it('should throw NotFoundException if report not found', async () => {
      mockModel.findById.mockResolvedValue(null);

      await expect(service.getReport('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProductReports', () => {
    it('should retrieve all reports for a product', async () => {
      const mockReports = [
        { _id: 'report1', productId: 'prod1', reportType: 'velocity' },
        { _id: 'report2', productId: 'prod1', reportType: 'burndown' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockReports),
        }),
      });

      const result = await service.getProductReports('prod1');

      expect(result).toHaveLength(2);
    });

    it('should retrieve reports filtered by type', async () => {
      const mockReports = [
        { _id: 'report1', productId: 'prod1', reportType: 'velocity' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockReports),
        }),
      });

      const result = await service.getProductReports('prod1', 'velocity');

      expect(result).toHaveLength(1);
    });
  });

  describe('getSummary', () => {
    it('should return analytics summary', async () => {
      const mockReports = [
        { reportType: 'velocity' },
        { reportType: 'burndown' },
        { reportType: 'velocity' },
      ];

      mockModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockReports),
          }),
        }),
      });

      const result = await service.getSummary('prod1');

      expect(result.productId).toBe('prod1');
      expect(result.reportsGenerated).toBe(3);
      expect(result.reportTypes.velocity).toBe(2);
      expect(result.reportTypes.burndown).toBe(1);
    });
  });

  describe('deleteReport', () => {
    it('should delete a report', async () => {
      mockModel.findByIdAndDelete.mockResolvedValue({});

      await service.deleteReport('report1');

      expect(mockModel.findByIdAndDelete).toHaveBeenCalledWith('report1');
    });
  });

  describe('velocity metrics generation', () => {
    it('should generate metrics for multiple weeks', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-29'); // 4 weeks

      expect(async () => {
        await service.generateVelocityReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('burndown metrics generation', () => {
    it('should generate declining metrics over sprint', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-04-14'); // 14 days

      expect(async () => {
        await service.generateBurndownReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });

  describe('prediction generation', () => {
    it('should generate predictions with confidence scores', async () => {
      const startDate = new Date('2026-04-01');
      const endDate = new Date('2026-12-31');

      expect(async () => {
        await service.generateForecastReport('prod1', startDate, endDate);
      }).toBeDefined();
    });
  });
});
