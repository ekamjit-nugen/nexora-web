import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { IStandup } from './schemas/standup.schema';
import { IStandupResponse } from './schemas/standup.schema';

@Injectable()
export class StandupService {
  private readonly logger = new Logger(StandupService.name);
  private readonly aiServiceUrl: string;

  constructor(
    @InjectModel('Standup') private standupModel: Model<IStandup>,
    @InjectModel('StandupResponse') private responseModel: Model<IStandupResponse>,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:3080';
  }

  private getTodayDate(): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ── CRUD ──

  async createStandup(orgId: string, dto: any, userId: string) {
    return this.standupModel.create({
      organizationId: orgId,
      projectId: dto.projectId || null,
      name: dto.name,
      schedule: {
        frequency: dto.frequency || 'weekdays',
        time: dto.time || '09:00',
        timezone: dto.timezone || 'Asia/Kolkata',
        daysOfWeek: dto.daysOfWeek || [],
      },
      questions: dto.questions?.length > 0
        ? dto.questions
        : ['What did you do yesterday?', 'What will you do today?', 'Any blockers?'],
      participants: dto.participants || [],
      createdBy: userId,
    });
  }

  async getStandups(orgId: string, userId: string) {
    return this.standupModel.find({
      organizationId: orgId,
      isActive: true,
      $or: [{ participants: userId }, { createdBy: userId }],
    }).sort({ createdAt: -1 }).lean();
  }

  async getStandup(orgId: string, id: string) {
    const standup = await this.standupModel.findOne({ _id: id, organizationId: orgId }).lean();
    if (!standup) throw new NotFoundException('Standup not found');
    return standup;
  }

  async updateStandup(orgId: string, id: string, dto: any) {
    const updates: any = {};
    if (dto.name) updates.name = dto.name;
    if (dto.questions) updates.questions = dto.questions;
    if (dto.participants) updates.participants = dto.participants;
    if (dto.projectId !== undefined) updates.projectId = dto.projectId;
    if (dto.isActive !== undefined) updates.isActive = dto.isActive;
    if (dto.frequency || dto.time || dto.timezone || dto.daysOfWeek) {
      updates.schedule = {};
      if (dto.frequency) updates['schedule.frequency'] = dto.frequency;
      if (dto.time) updates['schedule.time'] = dto.time;
      if (dto.timezone) updates['schedule.timezone'] = dto.timezone;
      if (dto.daysOfWeek) updates['schedule.daysOfWeek'] = dto.daysOfWeek;
    }

    const standup = await this.standupModel.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { $set: updates },
      { new: true },
    ).lean();
    if (!standup) throw new NotFoundException('Standup not found');
    return standup;
  }

  async deleteStandup(orgId: string, id: string) {
    const standup = await this.standupModel.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { isActive: false },
      { new: true },
    );
    if (!standup) throw new NotFoundException('Standup not found');
    return { message: 'Standup deactivated' };
  }

  // ── Responses ──

  async submitResponse(orgId: string, standupId: string, userId: string, userName: string, dto: any) {
    const standup = await this.standupModel.findOne({ _id: standupId, organizationId: orgId, isActive: true });
    if (!standup) throw new NotFoundException('Standup not found');

    const today = this.getTodayDate();

    // Check if already submitted today
    const existing = await this.responseModel.findOne({
      standupId, userId, date: today, organizationId: orgId,
    });
    if (existing) throw new ConflictException('You have already submitted today\'s standup');

    // Extract task IDs from answers (pattern: PROJ-123 or any KEY-NUM)
    const linkedTaskIds: string[] = [];
    const taskPattern = /[A-Z]+-\d+/g;
    for (const answer of dto.answers || []) {
      const matches = (answer.answer || '').match(taskPattern);
      if (matches) linkedTaskIds.push(...matches);
    }

    return this.responseModel.create({
      organizationId: orgId,
      standupId,
      userId,
      userName: userName || 'Unknown',
      date: today,
      answers: dto.answers || [],
      submittedAt: new Date(),
      linkedTaskIds: [...new Set(linkedTaskIds)],
    });
  }

  async getResponses(orgId: string, standupId: string, query: any) {
    const filter: any = { standupId, organizationId: orgId };
    if (query.date) {
      const d = new Date(query.date);
      d.setHours(0, 0, 0, 0);
      filter.date = d;
    }
    if (query.userId) filter.userId = query.userId;

    return this.responseModel.find(filter).sort({ submittedAt: -1 }).lean();
  }

  async getTodayResponses(orgId: string, standupId: string) {
    const today = this.getTodayDate();
    return this.responseModel.find({
      standupId, organizationId: orgId, date: today,
    }).sort({ submittedAt: 1 }).lean();
  }

  async getMyTodayStatus(orgId: string, standupId: string, userId: string) {
    const today = this.getTodayDate();
    const response = await this.responseModel.findOne({
      standupId, userId, date: today, organizationId: orgId,
    }).lean();
    return { submitted: !!response, response };
  }

  // ── AI Summary ──

  async getSummary(orgId: string, standupId: string) {
    const standup = await this.standupModel.findOne({ _id: standupId, organizationId: orgId });
    if (!standup) throw new NotFoundException('Standup not found');

    const todayResponses = await this.getTodayResponses(orgId, standupId);
    if (todayResponses.length === 0) {
      return { summary: 'No responses submitted yet for today.', responseCount: 0 };
    }

    // Build prompt
    const responseText = todayResponses.map(r => {
      const answers = r.answers.map(a => `  ${a.question}: ${a.answer}`).join('\n');
      return `${r.userName}:\n${answers}`;
    }).join('\n\n');

    const prompt = `Summarize this team standup update concisely. Highlight:
1. Key accomplishments from yesterday
2. Focus areas for today
3. Blockers that need attention (if any)
4. Any patterns or concerns

Team responses:\n${responseText}`;

    try {
      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          systemPrompt: 'You are a concise standup summarizer. Output a brief, actionable summary in markdown format. Keep it under 200 words.',
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) throw new Error(`AI service returned ${res.status}`);
      const data: any = await res.json();
      const summary = data?.data?.response || data?.response || 'Could not generate summary.';

      return { summary, responseCount: todayResponses.length, totalParticipants: standup.participants.length };
    } catch (err: any) {
      this.logger.warn(`AI summary failed: ${err?.message}`);
      return {
        summary: `${todayResponses.length} of ${standup.participants.length} team members have submitted. Manual review recommended.`,
        responseCount: todayResponses.length,
        totalParticipants: standup.participants.length,
      };
    }
  }
}
