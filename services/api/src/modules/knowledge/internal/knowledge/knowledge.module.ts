import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';
import { SpaceSchema } from './schemas/space.schema';
import { PageSchema } from './schemas/page.schema';
import { PageVersionSchema } from './schemas/page-version.schema';
import { PageTemplateSchema } from './schemas/page-template.schema';
import { BookmarkSchema } from './schemas/bookmark.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Space', schema: SpaceSchema },
      { name: 'Page', schema: PageSchema },
      { name: 'PageVersion', schema: PageVersionSchema },
      { name: 'PageTemplate', schema: PageTemplateSchema },
      { name: 'Bookmark', schema: BookmarkSchema },
    ], "nexora_knowledge"),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeService, JwtAuthGuard],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
