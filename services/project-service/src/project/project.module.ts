import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ProjectController } from './project.controller';
import { Wave3Controller } from './wave3.controller';
import { ReportingController } from './wave4.controller';
import { TimeTrackingController, TimesheetController, BillingController } from './wave4.controller';
import { ClientFeedbackController, ClientPortalController } from './wave4.controller';
import { AssetPreviewController } from './controllers/asset-preview.controller';
import { ProjectService } from './project.service';
import { ProjectSchema } from './schemas/project.schema';
import { ProjectMemberSchema } from './schemas/project-member.schema';
import { TimeLogSchema } from './schemas/time-log.schema';
import { ClientFeedbackSchema } from './schemas/client-feedback.schema';
import { AssetPreviewSchema } from './schemas/asset-preview.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ProjectAccessGuard } from './guards/project-access.guard';
import { ProjectPermissionsService } from './utils/permissions';
import { Wave3MethodsService } from './utils/wave3-methods';
import { ReportingService } from './services/reporting.service';
import { TimeTrackingService } from './services/time-tracking.service';
import { ClientFeedbackService } from './services/client-feedback.service';
import { AssetPreviewService } from './services/asset-preview.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Project', schema: ProjectSchema },
      { name: 'ProjectMember', schema: ProjectMemberSchema },
      { name: 'TimeLog', schema: TimeLogSchema },
      { name: 'ClientFeedback', schema: ClientFeedbackSchema },
      { name: 'AssetPreview', schema: AssetPreviewSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [
    ProjectController,
    Wave3Controller,
    ReportingController,
    TimeTrackingController,
    TimesheetController,
    BillingController,
    ClientFeedbackController,
    ClientPortalController,
    AssetPreviewController,
  ],
  providers: [
    ProjectService,
    ProjectPermissionsService,
    Wave3MethodsService,
    ReportingService,
    TimeTrackingService,
    ClientFeedbackService,
    AssetPreviewService,
    JwtAuthGuard,
    RolesGuard,
    ProjectAccessGuard,
    Reflector,
  ],
  exports: [
    ProjectService,
    ProjectPermissionsService,
    Wave3MethodsService,
    ReportingService,
    TimeTrackingService,
    ClientFeedbackService,
    AssetPreviewService,
  ],
})
export class ProjectModule {}
