import { Module } from '@nestjs/common';
import { HelpdeskModule as InternalHelpdeskModule } from './internal/helpdesk/helpdesk.module';

@Module({ imports: [InternalHelpdeskModule] })
export class HelpdeskModule {}
