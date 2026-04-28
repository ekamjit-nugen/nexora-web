import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';

export interface ReportFilter {
  type: 'organizations' | 'users' | 'analytics' | 'audit-logs';
  startDate?: Date;
  endDate?: Date;
  organizationId?: string;
  status?: string;
  fields?: string[];
}

export interface ReportTemplate {
  _id: string;
  name: string;
  description: string;
  type: string;
  filters: ReportFilter;
  format: 'pdf' | 'excel' | 'csv';
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledReport {
  _id: string;
  templateId: string;
  recipients: string[];
  schedule: 'daily' | 'weekly' | 'monthly';
  nextRun: Date;
  isActive: boolean;
  createdAt: Date;
}

@Injectable()
export class ReportingService {
  constructor(
    @InjectModel('Organization', 'nexora_auth') private organizationModel: Model<any>,
    @InjectModel('User', 'nexora_auth') private userModel: Model<any>,
    @InjectModel('AuditLog', 'nexora_auth') private auditLogModel: Model<any>,
    @InjectModel('ReportTemplate', 'nexora_auth') private reportTemplateModel: Model<ReportTemplate>,
    @InjectModel('ScheduledReport', 'nexora_auth') private scheduledReportModel: Model<ScheduledReport>,
  ) {}

  // ── Report Generation ──

  async generateReport(filter: ReportFilter, format: 'pdf' | 'excel' | 'csv'): Promise<Buffer> {
    const data = await this.fetchReportData(filter);

    switch (format) {
      case 'pdf':
        return this.generatePDF(data, filter.type);
      case 'excel':
        return this.generateExcel(data, filter.type);
      case 'csv':
        return this.generateCSV(data, filter.type);
      default:
        throw new BadRequestException('Invalid format');
    }
  }

  private async fetchReportData(filter: ReportFilter): Promise<any[]> {
    const { type, startDate, endDate, organizationId, status, fields } = filter;
    let query: any = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    switch (type) {
      case 'organizations':
        if (status) query.status = status;
        return this.organizationModel.find(query).select(fields || '-__v').lean();

      case 'users':
        if (organizationId) query.organizationId = organizationId;
        return this.userModel.find(query).select(fields || '-password -__v').lean();

      case 'audit-logs':
        if (organizationId) query.organizationId = organizationId;
        return this.auditLogModel.find(query).sort({ createdAt: -1 }).lean();

      case 'analytics':
        return this.generateAnalyticsData(filter);

      default:
        throw new BadRequestException('Invalid report type');
    }
  }

  private async generateAnalyticsData(filter: ReportFilter): Promise<any[]> {
    const { organizationId, startDate, endDate } = filter;

    const matchStage: any = {};
    if (organizationId) matchStage.organizationId = organizationId;
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = startDate;
      if (endDate) matchStage.createdAt.$lte = endDate;
    }

    const result = await this.organizationModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrganizations: { $sum: 1 },
          activeOrganizations: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          suspendedOrganizations: {
            $sum: { $cond: [{ $eq: ['$status', 'suspended'] }, 1, 0] },
          },
          byPlan: {
            $push: { plan: '$plan', count: 1 },
          },
        },
      },
    ]);

    return result;
  }

  private generatePDF(data: any[], reportType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text(`${reportType} Report`, { align: 'center' });
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleDateString()}`, { align: 'center' });
      doc.moveDown();

      // Content
      if (data.length === 0) {
        doc.text('No data available for this report.');
      } else if (Array.isArray(data) && typeof data[0] === 'object') {
        const headers = Object.keys(data[0]);
        const tableData = [headers, ...data.map((row) => headers.map((h) => String(row[h] || '')))];

        this.drawTable(doc, tableData);
      }

      doc.end();
    });
  }

  private async generateExcel(data: any[], reportType: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(reportType);

    if (data.length === 0) {
      worksheet.addRow(['No data available']);
      return (await workbook.xlsx.writeBuffer()) as any as Buffer;
    }

    if (Array.isArray(data) && typeof data[0] === 'object') {
      const headers = Object.keys(data[0]);
      worksheet.columns = headers.map((h) => ({ header: h, key: h, width: 15 }));

      data.forEach((row) => {
        worksheet.addRow(row);
      });

      // Style header
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    }

    return (await workbook.xlsx.writeBuffer()) as any as Buffer;
  }

  private generateCSV(data: any[], reportType: string): Buffer {
    if (data.length === 0) {
      return Buffer.from('No data available');
    }

    const headers = Object.keys(data[0]);
    const csvLines = [headers.join(',')];

    data.forEach((row) => {
      const values = headers.map((h) => {
        const value = row[h];
        const stringValue = String(value || '');
        return stringValue.includes(',') ? `"${stringValue}"` : stringValue;
      });
      csvLines.push(values.join(','));
    });

    return Buffer.from(csvLines.join('\n'));
  }

  private drawTable(doc: InstanceType<typeof PDFDocument>, data: string[][], options: any = {}): void {
    const { x = 50, y = 100, width = 500, rowHeight = 20 } = options;
    const cellWidth = width / data[0].length;

    data.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        const cellX = x + colIndex * cellWidth;
        const cellY = y + rowIndex * rowHeight;

        doc
          .rect(cellX, cellY, cellWidth, rowHeight)
          .stroke();

        doc
          .fontSize(10)
          .text(String(cell), cellX + 5, cellY + 5, {
            width: cellWidth - 10,
            height: rowHeight - 10,
          });
      });
    });
  }

  // ── Report Templates ──

  async createTemplate(name: string, description: string, filter: ReportFilter, format: 'pdf' | 'excel' | 'csv'): Promise<ReportTemplate> {
    const template = await this.reportTemplateModel.create({
      name,
      description,
      type: filter.type,
      filters: filter,
      format,
    });

    return template.toObject();
  }

  async getTemplates(): Promise<ReportTemplate[]> {
    return this.reportTemplateModel.find().lean();
  }

  async getTemplate(templateId: string): Promise<ReportTemplate> {
    const template = await this.reportTemplateModel.findById(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template.toObject();
  }

  async updateTemplate(templateId: string, updates: Partial<ReportTemplate>): Promise<ReportTemplate> {
    const template = await this.reportTemplateModel.findByIdAndUpdate(templateId, updates, { new: true });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template.toObject();
  }

  async deleteTemplate(templateId: string): Promise<void> {
    const result = await this.reportTemplateModel.findByIdAndDelete(templateId);
    if (!result) {
      throw new NotFoundException('Template not found');
    }
  }

  // ── Scheduled Reports ──

  async scheduleReport(
    templateId: string,
    recipients: string[],
    schedule: 'daily' | 'weekly' | 'monthly',
  ): Promise<ScheduledReport> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const nextRun = this.calculateNextRun(schedule);

    const scheduledReport = await this.scheduledReportModel.create({
      templateId,
      recipients,
      schedule,
      nextRun,
      isActive: true,
    });

    return scheduledReport.toObject();
  }

  async getScheduledReports(): Promise<ScheduledReport[]> {
    return this.scheduledReportModel.find({ isActive: true }).lean();
  }

  async updateScheduledReport(reportId: string, updates: Partial<ScheduledReport>): Promise<ScheduledReport> {
    const report = await this.scheduledReportModel.findByIdAndUpdate(reportId, updates, { new: true });
    if (!report) {
      throw new NotFoundException('Scheduled report not found');
    }
    return report.toObject();
  }

  async deleteScheduledReport(reportId: string): Promise<void> {
    await this.scheduledReportModel.findByIdAndUpdate(reportId, { isActive: false });
  }

  private calculateNextRun(schedule: string): Date {
    const now = new Date();

    switch (schedule) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow;

      case 'weekly':
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + 7);
        nextWeek.setHours(9, 0, 0, 0);
        return nextWeek;

      case 'monthly':
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(9, 0, 0, 0);
        return nextMonth;

      default:
        return now;
    }
  }

  // ── Report Execution ──

  async executeScheduledReport(reportId: string): Promise<Buffer> {
    const scheduledReport = await this.scheduledReportModel.findById(reportId);
    if (!scheduledReport) {
      throw new NotFoundException('Scheduled report not found');
    }

    const template = await this.getTemplate(scheduledReport.templateId.toString());
    const reportBuffer = await this.generateReport(template.filters, template.format);

    // Update next run time
    const nextRun = this.calculateNextRun(scheduledReport.schedule);
    await this.scheduledReportModel.findByIdAndUpdate(reportId, { nextRun });

    return reportBuffer;
  }
}
