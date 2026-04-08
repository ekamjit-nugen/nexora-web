import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ProjectTemplateController } from './project-template.controller';
import { ProjectTemplateService } from './project-template.service';
import { ProjectTemplateSchema } from './schemas/project-template.schema';
import { ProjectSchema } from '../project/schemas/project.schema';
import { JwtAuthGuard } from '../project/guards/jwt-auth.guard';
import { RolesGuard } from '../project/guards/roles.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'ProjectTemplate', schema: ProjectTemplateSchema },
      { name: 'Project', schema: ProjectSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [ProjectTemplateController],
  providers: [
    ProjectTemplateService,
    JwtAuthGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [ProjectTemplateService],
})
export class ProjectTemplateModule {}
