import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ReportingService } from './reporting.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReportingService', () => {
  let service: ReportingService;
  let mockOrganizationModel: any;
  let mockUserModel: any;
  let mockAuditLogModel: any;
  let mockReportTemplateModel: any;
  let mockScheduledReportModel: any;

  beforeEach(async () => {
    mockOrganizationModel = {
      find: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockUserModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockAuditLogModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    mockReportTemplateModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      findByIdAndDelete: jest.fn(),
    };

    mockScheduledReportModel = {
      create: jest.fn(),
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportingService,
        {
          provide: getModelToken('Organization'),
          useValue: mockOrganizationModel,
        },
        {
          provide: getModelToken('User'),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken('AuditLog'),
          useValue: mockAuditLogModel,
        },
        {
          provide: getModelToken('ReportTemplate'),
          useValue: mockReportTemplateModel,
        },
        {
          provide: getModelToken('ScheduledReport'),
          useValue: mockScheduledReportModel,
        },
      ],
    }).compile();

    service = module.get<ReportingService>(ReportingService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateReport', () => {
    it('should generate a PDF report for organizations', async () => {
      const filter = {
        type: 'organizations' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-12-31'),
      };

      const mockData = [
        {
          _id: 'org-1',
          name: 'Company A',
          status: 'active',
        },
        {
          _id: 'org-2',
          name: 'Company B',
          status: 'suspended',
        },
      ];

      mockOrganizationModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockData),
        }),
      });

      const buffer = await service.generateReport(filter, 'pdf');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(mockOrganizationModel.find).toHaveBeenCalled();
    });

    it('should generate an Excel report for users', async () => {
      const filter = {
        type: 'users' as const,
        organizationId: 'org-1',
      };

      const mockData = [
        {
          _id: 'user-1',
          email: 'user@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];

      mockUserModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockData),
        }),
      });

      const buffer = await service.generateReport(filter, 'excel');

      expect(buffer).toBeInstanceOf(Buffer);
      expect(mockUserModel.find).toHaveBeenCalledWith({
        organizationId: 'org-1',
      });
    });

    it('should generate a CSV report for audit logs', async () => {
      const filter = {
        type: 'audit-logs' as const,
      };

      const mockData = [
        {
          _id: 'log-1',
          action: 'CREATE',
          targetType: 'ORGANIZATION',
          performedBy: 'admin@example.com',
          createdAt: new Date(),
        },
      ];

      mockAuditLogModel.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(mockData),
        }),
      });

      const buffer = await service.generateReport(filter, 'csv');

      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should throw error for invalid format', async () => {
      const filter = {
        type: 'organizations' as const,
      };

      await expect(
        service.generateReport(filter, 'invalid' as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createTemplate', () => {
    it('should create a report template', async () => {
      const template = {
        _id: 'template-1',
        name: 'Monthly Report',
        description: 'Monthly organization report',
        type: 'organizations',
        format: 'pdf',
        filters: { type: 'organizations' },
        toObject: jest.fn().mockReturnValue({
          _id: 'template-1',
          name: 'Monthly Report',
          type: 'organizations',
        }),
      };

      mockReportTemplateModel.create.mockResolvedValue(template);

      const result = await service.createTemplate(
        'Monthly Report',
        'Monthly organization report',
        { type: 'organizations' as const },
        'pdf',
      );

      expect(result).toBeDefined();
      expect(mockReportTemplateModel.create).toHaveBeenCalled();
    });
  });

  describe('getTemplates', () => {
    it('should retrieve all templates', async () => {
      const templates = [
        {
          _id: 'template-1',
          name: 'Monthly Report',
          type: 'organizations',
        },
        {
          _id: 'template-2',
          name: 'User Report',
          type: 'users',
        },
      ];

      mockReportTemplateModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(templates),
      });

      const result = await service.getTemplates();

      expect(result).toEqual(templates);
      expect(result).toHaveLength(2);
    });
  });

  describe('getTemplate', () => {
    it('should retrieve a specific template', async () => {
      const template = {
        _id: 'template-1',
        name: 'Monthly Report',
        type: 'organizations',
        toObject: jest.fn().mockReturnValue({
          _id: 'template-1',
          name: 'Monthly Report',
        }),
      };

      mockReportTemplateModel.findById.mockResolvedValue(template);

      const result = await service.getTemplate('template-1');

      expect(result).toBeDefined();
      expect(mockReportTemplateModel.findById).toHaveBeenCalledWith('template-1');
    });

    it('should throw error if template not found', async () => {
      mockReportTemplateModel.findById.mockResolvedValue(null);

      await expect(service.getTemplate('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTemplate', () => {
    it('should update a template', async () => {
      const updated = {
        _id: 'template-1',
        name: 'Updated Report',
        type: 'users',
        toObject: jest.fn().mockReturnValue({
          _id: 'template-1',
          name: 'Updated Report',
        }),
      };

      mockReportTemplateModel.findByIdAndUpdate.mockResolvedValue(updated);

      const result = await service.updateTemplate('template-1', {
        name: 'Updated Report',
      });

      expect(result).toBeDefined();
      expect(mockReportTemplateModel.findByIdAndUpdate).toHaveBeenCalled();
    });
  });

  describe('deleteTemplate', () => {
    it('should delete a template', async () => {
      mockReportTemplateModel.findByIdAndDelete.mockResolvedValue({
        _id: 'template-1',
      });

      await expect(service.deleteTemplate('template-1')).resolves.not.toThrow();
      expect(mockReportTemplateModel.findByIdAndDelete).toHaveBeenCalledWith(
        'template-1',
      );
    });

    it('should throw error if template not found', async () => {
      mockReportTemplateModel.findByIdAndDelete.mockResolvedValue(null);

      await expect(service.deleteTemplate('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('scheduleReport', () => {
    it('should schedule a report', async () => {
      const template = {
        _id: 'template-1',
        name: 'Report',
        type: 'organizations',
      };

      mockReportTemplateModel.findById.mockResolvedValue(template);

      const scheduled = {
        _id: 'scheduled-1',
        templateId: 'template-1',
        recipients: ['admin@example.com'],
        schedule: 'daily',
        nextRun: new Date(),
        isActive: true,
        toObject: jest.fn().mockReturnValue({
          _id: 'scheduled-1',
          templateId: 'template-1',
          recipients: ['admin@example.com'],
          schedule: 'daily',
        }),
      };

      mockReportTemplateModel.findById.mockResolvedValue(template);
      mockScheduledReportModel.create.mockResolvedValue(scheduled);

      const result = await service.scheduleReport(
        'template-1',
        ['admin@example.com'],
        'daily',
      );

      expect(result).toBeDefined();
      expect(mockScheduledReportModel.create).toHaveBeenCalled();
    });
  });

  describe('getScheduledReports', () => {
    it('should retrieve active scheduled reports', async () => {
      const reports = [
        {
          _id: 'scheduled-1',
          templateId: 'template-1',
          schedule: 'daily',
          isActive: true,
        },
      ];

      mockScheduledReportModel.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue(reports),
      });

      const result = await service.getScheduledReports();

      expect(result).toEqual(reports);
      expect(mockScheduledReportModel.find).toHaveBeenCalledWith({
        isActive: true,
      });
    });
  });

  describe('deleteScheduledReport', () => {
    it('should deactivate a scheduled report', async () => {
      mockScheduledReportModel.findByIdAndUpdate.mockResolvedValue({
        _id: 'scheduled-1',
        isActive: false,
      });

      await expect(
        service.deleteScheduledReport('scheduled-1'),
      ).resolves.not.toThrow();

      expect(mockScheduledReportModel.findByIdAndUpdate).toHaveBeenCalledWith(
        'scheduled-1',
        { isActive: false },
      );
    });
  });

  describe('calculateNextRun', () => {
    it('should calculate next run for daily schedule', () => {
      const now = new Date();
      const result = (service as any).calculateNextRun('daily');

      expect(result.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should calculate next run for weekly schedule', () => {
      const now = new Date();
      const result = (service as any).calculateNextRun('weekly');

      const daysDiff = Math.floor(
        (result.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      expect(daysDiff).toBeGreaterThanOrEqual(6);
    });

    it('should calculate next run for monthly schedule', () => {
      const now = new Date();
      const result = (service as any).calculateNextRun('monthly');

      const monthsDiff = result.getMonth() - now.getMonth();
      expect(monthsDiff).toBeGreaterThanOrEqual(0);
    });
  });
});
