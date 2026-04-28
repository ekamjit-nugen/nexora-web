import { Module } from '@nestjs/common';
import { BenchModule as InternalBenchModule } from './internal/bench/bench.module';

@Module({ imports: [InternalBenchModule] })
export class BenchModule {}
