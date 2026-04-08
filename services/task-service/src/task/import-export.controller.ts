import {
  Controller, Get, Post, Query, Req, Res,
  UseGuards, HttpCode, HttpStatus, Logger,
  BadRequestException,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { TaskService } from './task.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard, Roles } from './guards/roles.guard';

@Controller('tasks')
export class ImportExportController {
  private readonly logger = new Logger(ImportExportController.name);

  constructor(private taskService: TaskService) {}

  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportTasks(
    @Query('projectId') projectId: string,
    @Query('format') format: string,
    @Query('status') status: string,
    @Query('type') type: string,
    @Query('assigneeId') assigneeId: string,
    @Query('sprintId') sprintId: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }

    const tasks = await this.taskService.getTasksForExport(
      { projectId, status, type, assigneeId, sprintId },
      req.user?.organizationId,
    );

    const dateStr = new Date().toISOString().split('T')[0];

    if (format === 'json') {
      const jsonData = tasks.map(t => ({
        key: t.taskKey,
        title: t.title,
        description: t.description,
        type: t.type,
        status: t.status,
        priority: t.priority,
        assignee: t.assigneeId,
        storyPoints: t.storyPoints,
        dueDate: t.dueDate ? new Date(t.dueDate).toISOString().split('T')[0] : null,
        sprint: t.sprintId,
        labels: t.labels || [],
        created: t.createdAt,
        updated: t.updatedAt,
      }));
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=tasks-${projectId}-${dateStr}.json`);
      return res.send(JSON.stringify(jsonData, null, 2));
    }

    // Default: CSV
    const csv = this.taskService.tasksToCSV(tasks);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=tasks-${projectId}-${dateStr}.csv`);
    return res.send(csv);
  }

  @Get('import/template')
  @UseGuards(JwtAuthGuard)
  async getImportTemplate(@Res() res: Response) {
    const csv = this.taskService.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=task-import-template.csv');
    return res.send(csv);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'manager', 'admin', 'owner')
  @HttpCode(HttpStatus.OK)
  async importTasks(@Req() req: any, @Res() res: Response) {
    // Read raw body as multipart or plain text
    const contentType = req.headers['content-type'] || '';
    let csvContent = '';
    let projectId = '';
    let projectKey = '';

    if (contentType.includes('multipart/form-data')) {
      // Parse multipart manually — NestJS platform-express includes multer
      const result = await this.parseMultipart(req);
      csvContent = result.fileContent;
      projectId = result.fields.projectId || '';
      projectKey = result.fields.projectKey || '';
    } else {
      throw new BadRequestException('Content-Type must be multipart/form-data');
    }

    if (!projectId) {
      throw new BadRequestException('projectId is required');
    }
    if (!csvContent) {
      throw new BadRequestException('CSV file is required');
    }

    const summary = await this.taskService.importTasks(
      csvContent,
      projectId,
      req.user.userId,
      req.user?.organizationId,
      projectKey || undefined,
    );

    return res.json({
      success: true,
      message: `Import complete: ${summary.created} created, ${summary.failed} failed`,
      data: summary,
    });
  }

  private parseMultipart(req: Request): Promise<{ fileContent: string; fields: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      const boundary = this.getBoundary(req.headers['content-type'] || '');
      if (!boundary) {
        return reject(new BadRequestException('Invalid multipart boundary'));
      }

      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        try {
          const body = Buffer.concat(chunks).toString('utf-8');
          const parts = body.split('--' + boundary).filter(p => p.trim() && p.trim() !== '--');
          const fields: Record<string, string> = {};
          let fileContent = '';

          for (const part of parts) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;
            const headerSection = part.substring(0, headerEnd);
            const bodySection = part.substring(headerEnd + 4).replace(/\r\n$/, '');

            const nameMatch = headerSection.match(/name="([^"]+)"/);
            const filenameMatch = headerSection.match(/filename="([^"]+)"/);

            if (nameMatch) {
              if (filenameMatch) {
                // This is a file field
                fileContent = bodySection;
              } else {
                fields[nameMatch[1]] = bodySection.trim();
              }
            }
          }

          resolve({ fileContent, fields });
        } catch (e) {
          reject(new BadRequestException('Failed to parse multipart data'));
        }
      });
      req.on('error', (e) => reject(e));
    });
  }

  private getBoundary(contentType: string): string | null {
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
    return match ? (match[1] || match[2]) : null;
  }
}
