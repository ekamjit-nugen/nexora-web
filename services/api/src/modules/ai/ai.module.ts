import { Module } from '@nestjs/common';
import { AiModule as InternalAiModule } from './internal/ai/ai.module';

/**
 * AI module — stateless LLM proxy. No Mongo connection used today.
 * If AI ever persists state, register an AI_DB connection.
 */
@Module({ imports: [InternalAiModule] })
export class AiModule {}
