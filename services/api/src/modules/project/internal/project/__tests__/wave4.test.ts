/**
 * Wave 4: Reporting & Market Differentiators - Test Suite
 * Covers: Reporting, Time Tracking, Client Feedback, Asset Preview
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connect, Connection, Model } from 'mongoose';
import { ProjectSchema } from '../schemas/project.schema';
import { TimeLogSchema } from '../schemas/time-log.schema';
import { ClientFeedbackSchema } from '../schemas/client-feedback.schema';
import { AssetPreviewSchema } from '../schemas/asset-preview.schema';
import { ReportingService } from '../services/reporting.service';
import { TimeTrackingService } from '../services/time-tracking.service';
import { ClientFeedbackService } from '../services/client-feedback.service';
import { AssetPreviewService } from '../services/asset-preview.service';
import { IProject } from '../schemas/project.schema';
import { ITimeLog } from '../schemas/time-log.schema';
import { IClientFeedback } from '../schemas/client-feedback.schema';
import { IAssetPreview } from '../schemas/asset-preview.schema';

describe('Wave 4: Reporting & Market Differentiators', () => {
  let reportingService: ReportingService;
  let timeTrackingService: TimeTrackingService;
  let clientFeedbackService: ClientFeedbackService;
  let assetPreviewService: AssetPreviewService;
  let mongoServer: MongoMemoryServer;
  let mongoConnection: Connection;
  let projectModel: Model<IProject>;
  let timeLogModel: Model<ITimeLog>;
  let clientFeedbackModel: Model<IClientFeedback>;
  let assetPreviewModel: Model<IAssetPreview>;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoConnection = (await connect(mongoUri)).connection;
    projectModel = mongoConnection.model<IProject>('Project', ProjectSchema);
    timeLogModel = mongoConnection.model<ITimeLog>('TimeLog', TimeLogSchema);
    clientFeedbackModel = mongoConnection.model<IClientFeedback>(
      'ClientFeedback',
      ClientFeedbackSchema,
    );
    assetPreviewModel = mongoConnection.model<IAssetPreview>(
      'AssetPreview',
      AssetPreviewSchema,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: 'Project',
          useValue: projectModel,
        },
        {
          provide: 'TimeLog',
          useValue: timeLogModel,
        },
        {
          provide: 'ClientFeedback',
          useValue: clientFeedbackModel,
        },
        {
          provide: 'AssetPreview',
          useValue: assetPreviewModel,
        },
        ReportingService,
        TimeTrackingService,
        ClientFeedbackService,
        AssetPreviewService,
      ],
    })
      .overrideProvider('Project')
      .useValue(projectModel)
      .overrideProvider('TimeLog')
      .useValue(timeLogModel)
      .overrideProvider('ClientFeedback')
      .useValue(clientFeedbackModel)
      .overrideProvider('AssetPreview')
      .useValue(assetPreviewModel)
      .compile();

    reportingService = module.get<ReportingService>(ReportingService);
    timeTrackingService = module.get<TimeTrackingService>(TimeTrackingService);
    clientFeedbackService = module.get<ClientFeedbackService>(ClientFeedbackService);
    assetPreviewService = module.get<AssetPreviewService>(AssetPreviewService);
  });

  afterAll(async () => {
    await mongoConnection.dropDatabase();
    await mongoConnection.close();
    await mongoServer.stop();
  });

  afterEach(async () => {
    const collections = mongoConnection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  });

  describe('4.1 Reporting Layer', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Reporting Test Project',
        projectKey: 'REPORT',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should generate cumulative flow data', async () => {
      const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const toDate = new Date();

      const cfd = await reportingService.getCumulativeFlowData(
        projectId,
        fromDate,
        toDate,
      );

      expect(cfd.dates).toBeDefined();
      expect(cfd.dates.length).toBeGreaterThan(0);
      expect(cfd.columns).toBeDefined();
      expect(cfd.columns.length).toBeGreaterThan(0);
      expect(cfd.columns[0].name).toBeDefined();
      expect(cfd.columns[0].counts.length).toBe(cfd.dates.length);
    });

    it('should calculate cycle time statistics', async () => {
      const cycleTime = await reportingService.getCycleTimeData(projectId);

      expect(cycleTime.avgCycleTime).toBeGreaterThan(0);
      expect(cycleTime.medianCycleTime).toBeGreaterThan(0);
      expect(cycleTime.p90CycleTime).toBeGreaterThan(0);
      expect(cycleTime.p90CycleTime).toBeGreaterThanOrEqual(cycleTime.medianCycleTime);
      expect(cycleTime.tasks).toBeDefined();
    });

    it('should generate epic progress data', async () => {
      const epicProgress = await reportingService.getEpicProgressData(projectId);

      expect(epicProgress.epics).toBeDefined();
      expect(epicProgress.epics.length).toBeGreaterThan(0);
      expect(epicProgress.epics[0].key).toBeDefined();
      expect(epicProgress.epics[0].completedStories).toBeLessThanOrEqual(
        epicProgress.epics[0].totalStories,
      );
    });

    it('should prepare velocity report for export', async () => {
      const velocityReport = await reportingService.getVelocityReportForExport(projectId);

      expect(velocityReport.sprints).toBeDefined();
      expect(velocityReport.sprints[0]).toHaveProperty('sprint');
      expect(velocityReport.sprints[0]).toHaveProperty('committedPoints');
      expect(velocityReport.sprints[0]).toHaveProperty('completedPoints');
      expect(velocityReport.sprints[0]).toHaveProperty('completionPercentage');
    });

    it('should prepare billing report for export', async () => {
      const billingReport = await reportingService.getBillingReportForExport(
        projectId,
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date(),
      );

      expect(billingReport.totalHours).toBeDefined();
      expect(billingReport.billableHours).toBeDefined();
      expect(billingReport.totalCost).toBeDefined();
    });
  });

  describe('4.4 Time Tracking', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Time Tracking Test',
        projectKey: 'TIME',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should log time on a task', async () => {
      const timeLog = await timeTrackingService.logTime(
        projectId,
        'task-123',
        'user-2',
        {
          taskId: 'task-123',
          duration: 120, // 2 hours
          description: 'Worked on feature',
          date: new Date(),
          billable: true,
          rate: 50,
        },
      );

      expect(timeLog.duration).toBe(120);
      expect(timeLog.taskId).toBe('task-123');
      expect(timeLog.billable).toBe(true);
      expect(timeLog.rate).toBe(50);
    });

    it('should reject logs with zero or negative duration', async () => {
      await expect(
        timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
          taskId: 'task-123',
          duration: 0,
          description: 'Invalid',
          date: new Date(),
        }),
      ).rejects.toThrow('Duration must be at least 1 minute');
    });

    it('should get all logs for a task', async () => {
      await timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
        taskId: 'task-123',
        duration: 60,
        date: new Date(),
      });
      await timeTrackingService.logTime(projectId, 'task-123', 'user-3', {
        taskId: 'task-123',
        duration: 120,
        date: new Date(),
      });

      const logs = await timeTrackingService.getTaskTimeLogs(projectId, 'task-123');

      expect(logs).toHaveLength(2);
      expect(logs[0].userId).toBe('user-3'); // Most recent first
    });

    it('should calculate total time logged on task', async () => {
      await timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
        taskId: 'task-123',
        duration: 60,
        date: new Date(),
      });
      await timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
        taskId: 'task-123',
        duration: 120,
        date: new Date(),
      });

      const total = await timeTrackingService.getTotalTimeLogged(projectId, 'task-123');

      expect(total).toBe(180); // 3 hours
    });

    it('should update time log', async () => {
      const log = await timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
        taskId: 'task-123',
        duration: 60,
        description: 'Initial',
        date: new Date(),
      });

      const updated = await timeTrackingService.updateTimeLog(
        projectId,
        log._id.toString(),
        {
          duration: 90,
          description: 'Updated',
        },
      );

      expect(updated.duration).toBe(90);
      expect(updated.description).toBe('Updated');
    });

    it('should delete time log', async () => {
      const log = await timeTrackingService.logTime(projectId, 'task-123', 'user-2', {
        taskId: 'task-123',
        duration: 60,
        date: new Date(),
      });

      await timeTrackingService.deleteTimeLog(projectId, log._id.toString());

      const logs = await timeTrackingService.getTaskTimeLogs(projectId, 'task-123');
      expect(logs).toHaveLength(0);
    });

    it('should generate weekly timesheet', async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);

      await timeTrackingService.logTime(projectId, 'task-1', 'user-2', {
        taskId: 'task-1',
        duration: 480, // 8 hours
        date: new Date(monday),
      });
      await timeTrackingService.logTime(projectId, 'task-2', 'user-2', {
        taskId: 'task-2',
        duration: 240, // 4 hours
        date: new Date(monday.getTime() + 1 * 24 * 60 * 60 * 1000),
      });

      const timesheet = await timeTrackingService.getWeeklyTimesheet(
        projectId,
        'user-2',
        monday,
      );

      expect(timesheet.tasks.length).toBeGreaterThan(0);
      expect(timesheet.dailyTotals).toBeDefined();
    });

    it('should submit timesheet for approval', async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);

      const submitted = await timeTrackingService.submitTimesheet(
        projectId,
        'user-2',
        monday,
      );

      expect(submitted.submitted).toBe(true);
      expect(submitted.approvalStatus).toBe('pending');
      expect(submitted.submittedAt).toBeDefined();
    });

    it('should approve timesheet', async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);

      const approved = await timeTrackingService.approveTimesheet(
        projectId,
        'user-2',
        monday,
        'manager-1',
      );

      expect(approved.approvalStatus).toBe('approved');
      expect(approved.approvedBy).toBe('manager-1');
    });

    it('should reject timesheet with reason', async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() - monday.getDay() + 1);

      const rejected = await timeTrackingService.rejectTimesheet(
        projectId,
        'user-2',
        monday,
        'Missing time entries',
      );

      expect(rejected.approvalStatus).toBe('rejected');
      expect(rejected.rejectionReason).toBe('Missing time entries');
    });

    it('should calculate user billing data', async () => {
      const now = new Date();
      await timeTrackingService.logTime(projectId, 'task-1', 'user-2', {
        taskId: 'task-1',
        duration: 480, // 8 hours
        date: now,
        rate: 50,
        billable: true,
      });
      await timeTrackingService.logTime(projectId, 'task-2', 'user-2', {
        taskId: 'task-2',
        duration: 240, // 4 hours
        date: now,
        rate: 50,
        billable: false,
      });

      const billing = await timeTrackingService.getUserBillingData(
        projectId,
        'user-2',
        new Date(now.getTime() - 24 * 60 * 60 * 1000),
        new Date(now.getTime() + 24 * 60 * 60 * 1000),
      );

      expect(billing.totalHours).toBe(12);
      expect(billing.billableHours).toBe(8);
      expect(billing.totalCost).toBe(600); // 12 hours * 50
    });
  });

  describe('4.3 Client Feedback', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Client Feedback Test',
        projectKey: 'CFB',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should submit client feedback', async () => {
      const feedback = await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Login not working',
        description: 'Cannot login with email',
        priority: 'high',
      });

      expect(feedback.clientId).toBe('client-1');
      expect(feedback.type).toBe('bug');
      expect(feedback.status).toBe('new');
      expect(feedback.priority).toBe('high');
    });

    it('should get project feedback', async () => {
      await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Bug 1',
        description: 'Description',
      });
      await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-2',
        clientName: 'Jane',
        clientEmail: 'jane@example.com',
        type: 'feature',
        title: 'Feature Request',
        description: 'Description',
      });

      const result = await clientFeedbackService.getProjectFeedback(projectId);

      expect(result.feedback.length).toBe(2);
      expect(result.total).toBe(2);
    });

    it('should update feedback status', async () => {
      const feedback = await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Bug',
        description: 'Description',
      });

      const updated = await clientFeedbackService.updateFeedbackStatus(
        projectId,
        feedback._id.toString(),
        'in_progress',
      );

      expect(updated.status).toBe('in_progress');
    });

    it('should link feedback to task', async () => {
      const feedback = await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Bug',
        description: 'Description',
      });

      const linked = await clientFeedbackService.linkFeedbackToTask(
        projectId,
        feedback._id.toString(),
        'PROJ-123',
      );

      expect(linked.taskKey).toBe('PROJ-123');
    });

    it('should delete feedback', async () => {
      const feedback = await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Bug',
        description: 'Description',
      });

      await clientFeedbackService.deleteFeedback(projectId, feedback._id.toString());

      const result = await clientFeedbackService.getProjectFeedback(projectId);
      expect(result.feedback).toHaveLength(0);
    });

    it('should get feedback statistics', async () => {
      await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'bug',
        title: 'Bug 1',
        description: 'Desc',
        priority: 'high',
      });
      await clientFeedbackService.submitFeedback(projectId, {
        clientId: 'client-1',
        clientName: 'John',
        clientEmail: 'john@example.com',
        type: 'feature',
        title: 'Feature',
        description: 'Desc',
        priority: 'low',
      });

      const stats = await clientFeedbackService.getFeedbackStats(projectId);

      expect(stats.total).toBe(2);
      expect(stats.byType.bug).toBe(1);
      expect(stats.byType.feature).toBe(1);
    });
  });

  describe('4.2 Asset Preview', () => {
    let projectId: string;

    beforeEach(async () => {
      const project = new projectModel({
        projectName: 'Asset Preview Test',
        projectKey: 'ASSET',
        organizationId: 'org-123',
        createdBy: 'user-1',
        team: [],
      });
      await project.save();
      projectId = project._id.toString();
    });

    it('should upload asset', async () => {
      const asset = await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/image.png',
        name: 'image.png',
        type: 'image',
        size: 102400,
        width: 800,
        height: 600,
        format: 'png',
      });

      expect(asset.taskId).toBe('task-123');
      expect(asset.type).toBe('image');
      expect(asset.size).toBe(102400);
    });

    it('should get task assets', async () => {
      await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/image1.png',
        name: 'image1.png',
        type: 'image',
        size: 100000,
      });
      await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/video.mp4',
        name: 'video.mp4',
        type: 'video',
        size: 5000000,
      });

      const result = await assetPreviewService.getTaskAssets(projectId, 'task-123');

      expect(result.assets).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter assets by type', async () => {
      await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/image.png',
        name: 'image.png',
        type: 'image',
        size: 100000,
      });
      await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/video.mp4',
        name: 'video.mp4',
        type: 'video',
        size: 5000000,
      });

      const result = await assetPreviewService.getTaskAssets(projectId, 'task-123', {
        type: 'image',
      });

      expect(result.assets).toHaveLength(1);
      expect(result.assets[0].type).toBe('image');
    });

    it('should delete asset', async () => {
      const asset = await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-123',
        url: 'https://example.com/image.png',
        name: 'image.png',
        type: 'image',
        size: 100000,
      });

      await assetPreviewService.deleteAsset(projectId, asset._id.toString());

      const result = await assetPreviewService.getTaskAssets(projectId, 'task-123');
      expect(result.assets).toHaveLength(0);
    });

    it('should get asset statistics', async () => {
      await assetPreviewService.uploadAsset(projectId, 'user-1', {
        taskId: 'task-1',
        url: 'https://example.com/image.png',
        name: 'image.png',
        type: 'image',
        size: 100000,
      });
      await assetPreviewService.uploadAsset(projectId, 'user-2', {
        taskId: 'task-2',
        url: 'https://example.com/video.mp4',
        name: 'video.mp4',
        type: 'video',
        size: 5000000,
      });

      const stats = await assetPreviewService.getAssetStats(projectId);

      expect(stats.total).toBe(2);
      expect(stats.byType.image).toBe(1);
      expect(stats.byType.video).toBe(1);
    });
  });
});
