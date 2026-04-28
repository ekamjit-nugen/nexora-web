import { Module } from '@nestjs/common';
import { KnowledgeModule as InternalKnowledgeModule } from './internal/knowledge/knowledge.module';

@Module({ imports: [InternalKnowledgeModule] })
export class KnowledgeModule {}
