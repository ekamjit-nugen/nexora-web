import { Test, TestingModule } from '@nestjs/testing';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

describe('ReportingController', () => {
  let controller: ReportingController;
  let service: ReportingService;

  const mockReportingService = {
    generateReport: jest.fn(),
    createTemplate: jest.fn(),
    getTemplates: jest.fn(),
    getTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    scheduleReport: jest.fn(),
    getScheduledReports: jest.fn(),
    updateScheduledReport: jest.fn(),
    deleteScheduledReport: jest.fn(),
    executeScheduledReport: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportingController],
      providers: [
        {
          provide: ReportingService,
          useValue: mockReportingService,
        },
      ],
    }).compile();

    controller = module.get<ReportingController>(ReportingController);
    service = module.get<ReportingService>(ReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should generate a PDF report', async () => {
      const mockBuffer = Buffer.from('PDF content');
      mockReportingService.generateReport.mockResolvedValue(mockBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.generateReport(
        {
          type: 'organizations',
          format: 'pdf',
        },
        mockRes as any,
      );

      expect(service.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'organizations',
        }),
        'pdf',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.send).toHaveBeenCalledWith(mockBuffer);
    });

    it('should generate an Excel report', async () => {
      const mockBuffer = Buffer.from('Excel content');
      mockReportingService.generateReport.mockResolvedValue(mockBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.generateReport(
        {
          type: 'users',
          format: 'excel',
        },
        mockRes as any,
      );

      expect(service.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'users',
        }),
        'excel',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
    });

    it('should generate a CSV report', async () => {
      const mockBuffer = Buffer.from('CSV content');
      mockReportingService.generateReport.mockResolvedValue(mockBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.generateReport(
        {
          type: 'audit-logs',
          format: 'csv',
        },
        mockRes as any,
      );

      expect(service.generateReport).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'audit-logs',
        }),
        'csv',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    });
  });

  describe('createTemplate', () => {
    it('should create a report template', async () => {
      const template = {
        _id: 'template-1',
        name: 'Org Report',
        description: 'Organization report template',
        type: 'organizations',
        format: 'pdf',
        filters: { type: 'organizations' },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockReportingService.createTemplate.mockResolvedValue(template);

      const result = await controller.createTemplate({
        name: 'Org Report',
        description: 'Organization report template',
        type: 'organizations',
        format: 'pdf',
      });

      expect(service.createTemplate).toHaveBeenCalledWith(
        'Org Report',
        'Organization report template',
        expect.any(Object),
        'pdf',
      );
      expect(result.data).toEqual(template);
    });
  });

  describe('getTemplates', () => {
    it('should retrieve all templates', async () => {
      const templates = [
        {
          _id: 'template-1',
          name: 'Org Report',
          type: 'organizations',
          format: 'pdf',
        },
        {
          _id: 'template-2',
          name: 'User Report',
          type: 'users',
          format: 'excel',
        },
      ];

      mockReportingService.getTemplates.mockResolvedValue(templates);

      const result = await controller.getTemplates();

      expect(service.getTemplates).toHaveBeenCalled();
      expect(result.data).toEqual(templates);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('scheduleReport', () => {
    it('should schedule a report', async () => {
      const scheduled = {
        _id: 'scheduled-1',
        templateId: 'template-1',
        recipients: ['admin@example.com'],
        schedule: 'daily',
        nextRun: new Date(),
        isActive: true,
        createdAt: new Date(),
      };

      mockReportingService.scheduleReport.mockResolvedValue(scheduled);

      const result = await controller.scheduleReport({
        templateId: 'template-1',
        recipients: ['admin@example.com'],
        schedule: 'daily',
      });

      expect(service.scheduleReport).toHaveBeenCalledWith(
        'template-1',
        ['admin@example.com'],
        'daily',
      );
      expect(result.data).toEqual(scheduled);
    });
  });

  describe('getScheduledReports', () => {
    it('should retrieve all scheduled reports', async () => {
      const reports = [
        {
          _id: 'scheduled-1',
          templateId: 'template-1',
          schedule: 'daily',
          isActive: true,
        },
      ];

      mockReportingService.getScheduledReports.mockResolvedValue(reports);

      const result = await controller.getScheduledReports();

      expect(service.getScheduledReports).toHaveBeenCalled();
      expect(result.data).toEqual(reports);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      mockReportingService.deleteTemplate.mockResolvedValue(undefined);

      const result = await controller.deleteTemplate('template-1');

      expect(service.deleteTemplate).toHaveBeenCalledWith('template-1');
      expect(result.success).toBe(true);
    });
  });

  describe('deleteScheduledReport', () => {
    it('should delete a scheduled report', async () => {
      mockReportingService.deleteScheduledReport.mockResolvedValue(undefined);

      const result = await controller.deleteScheduledReport('scheduled-1');

      expect(service.deleteScheduledReport).toHaveBeenCalledWith('scheduled-1');
      expect(result.success).toBe(true);
    });
  });

  describe('executeScheduledReport', () => {
    it('should execute a scheduled report', async () => {
      const mockBuffer = Buffer.from('Report content');
      mockReportingService.executeScheduledReport.mockResolvedValue(mockBuffer);

      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await controller.executeScheduledReport('scheduled-1', mockRes as any);

      expect(service.executeScheduledReport).toHaveBeenCalledWith('scheduled-1');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/octet-stream');
      expect(mockRes.send).toHaveBeenCalledWith(mockBuffer);
    });
  });
});
