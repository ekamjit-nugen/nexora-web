import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HelpdeskController } from './helpdesk.controller';
import { HelpdeskService } from './helpdesk.service';
import { TicketSchema } from './schemas/ticket.schema';
import { TicketCommentSchema } from './schemas/ticket-comment.schema';
import { HelpdeskTeamSchema } from './schemas/helpdesk-team.schema';
import { TicketCounterSchema } from './schemas/counter.schema';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Ticket', schema: TicketSchema },
      { name: 'TicketComment', schema: TicketCommentSchema },
      { name: 'HelpdeskTeam', schema: HelpdeskTeamSchema },
      { name: 'TicketCounter', schema: TicketCounterSchema },
    ], "nexora_helpdesk"),
    JwtModule.registerAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'nexora-secret-key-change-in-production',
      }),
    }),
  ],
  controllers: [HelpdeskController],
  providers: [HelpdeskService, JwtAuthGuard],
  exports: [HelpdeskService],
})
export class HelpdeskModule {}
