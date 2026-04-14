import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ITicket } from './schemas/ticket.schema';
import { ITicketComment } from './schemas/ticket-comment.schema';
import { IHelpdeskTeam } from './schemas/helpdesk-team.schema';
import { ITicketCounter } from './schemas/counter.schema';

@Injectable()
export class HelpdeskService {
  private readonly logger = new Logger(HelpdeskService.name);

  constructor(
    @InjectModel('Ticket') private ticketModel: Model<ITicket>,
    @InjectModel('TicketComment') private commentModel: Model<ITicketComment>,
    @InjectModel('HelpdeskTeam') private teamModel: Model<IHelpdeskTeam>,
    @InjectModel('TicketCounter') private counterModel: Model<ITicketCounter>,
  ) {}

  private async generateTicketNumber(orgId: string): Promise<string> {
    const counter = await this.counterModel.findOneAndUpdate(
      { organizationId: orgId }, { $inc: { seq: 1 } }, { upsert: true, new: true },
    );
    return `TKT-${String(counter.seq).padStart(5, '0')}`;
  }

  // ── Tickets ──

  async createTicket(orgId: string, dto: any, userId: string, userName: string, userEmail: string) {
    const ticketNumber = await this.generateTicketNumber(orgId);

    // Auto-route: find team by category
    const team = await this.teamModel.findOne({ organizationId: orgId, category: dto.category, isActive: true, isDeleted: false });

    let assigneeId: string = null;
    let assigneeName = '';
    let teamId: string = null;
    let slaResponseDue: Date = null;
    let slaResolutionDue: Date = null;

    if (team) {
      teamId = team._id.toString();
      const priority = dto.priority || 'medium';
      const sla = team.slaPolicy?.[priority];

      // Calculate SLA deadlines
      if (sla) {
        slaResponseDue = new Date(Date.now() + sla.responseMinutes * 60 * 1000);
        slaResolutionDue = new Date(Date.now() + sla.resolutionMinutes * 60 * 1000);
      }

      // Auto-assign via round-robin
      if (team.autoAssign && team.members.length > 0) {
        const nextIndex = (team.lastAssignedIndex + 1) % team.members.length;
        const agent = team.members[nextIndex];
        assigneeId = agent.userId;
        assigneeName = agent.name;
        team.lastAssignedIndex = nextIndex;
        await team.save();
      }
    }

    const ticket = await this.ticketModel.create({
      organizationId: orgId, ticketNumber, title: dto.title,
      description: dto.description || '', category: dto.category,
      priority: dto.priority || 'medium',
      status: assigneeId ? 'assigned' : 'open',
      requesterId: userId, requesterName: userName, requesterEmail: userEmail,
      assigneeId, assigneeName, teamId,
      tags: dto.tags || [],
      slaResponseDue, slaResolutionDue,
      createdBy: userId,
    });

    return ticket.toObject();
  }

  async getTickets(orgId: string, query: any, userId: string, isAgent: boolean) {
    const filter: any = { organizationId: orgId, isDeleted: false };

    if (!isAgent) {
      // Employees only see their own tickets
      filter.requesterId = userId;
    } else if (query.requesterId) {
      filter.requesterId = query.requesterId;
    }

    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.priority) filter.priority = query.priority;
    if (query.assigneeId) filter.assigneeId = query.assigneeId;
    if (query.slaBreached === 'true') {
      filter.$or = [{ slaResponseBreached: true }, { slaResolutionBreached: true }];
    }
    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { ticketNumber: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const sortField = query.sortBy || '-createdAt';

    const [data, total] = await Promise.all([
      this.ticketModel.find(filter).sort(sortField).skip((page - 1) * limit).limit(limit).lean(),
      this.ticketModel.countDocuments(filter),
    ]);

    // Check SLA breaches on the fly
    const now = new Date();
    for (const ticket of data) {
      if (!ticket.slaResponseBreached && ticket.slaResponseDue && now > ticket.slaResponseDue && !ticket.firstRespondedAt) {
        ticket.slaResponseBreached = true;
      }
      if (!ticket.slaResolutionBreached && ticket.slaResolutionDue && now > ticket.slaResolutionDue && !ticket.resolvedAt) {
        ticket.slaResolutionBreached = true;
      }
    }

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getTicket(orgId: string, id: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  async updateTicket(orgId: string, id: string, dto: any, userId: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (dto.status === 'resolved' && !ticket.resolvedAt) ticket.resolvedAt = new Date();
    if (dto.status === 'closed' && !ticket.closedAt) ticket.closedAt = new Date();
    if (dto.status === 'open' && ticket.status === 'resolved') { ticket.resolvedAt = null; ticket.closedAt = null; }

    Object.assign(ticket, { ...dto, updatedBy: userId });
    await ticket.save();
    return ticket.toObject();
  }

  async assignTicket(orgId: string, id: string, assigneeId: string, assigneeName: string, userId: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.assigneeId = assigneeId;
    ticket.assigneeName = assigneeName || '';
    if (ticket.status === 'open') ticket.status = 'assigned';
    ticket.updatedBy = userId;
    await ticket.save();
    return ticket.toObject();
  }

  async closeTicket(orgId: string, id: string, userId: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!ticket) throw new NotFoundException('Ticket not found');
    ticket.status = 'closed';
    ticket.closedAt = new Date();
    if (!ticket.resolvedAt) ticket.resolvedAt = new Date();
    ticket.updatedBy = userId;
    await ticket.save();
    return ticket.toObject();
  }

  async rateTicket(orgId: string, id: string, dto: any, userId: string) {
    const ticket = await this.ticketModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!ticket) throw new NotFoundException('Ticket not found');
    if (ticket.requesterId !== userId) throw new ForbiddenException('Only the requester can rate');
    if (!['resolved', 'closed'].includes(ticket.status)) throw new BadRequestException('Ticket must be resolved or closed to rate');

    ticket.rating = dto.rating;
    ticket.ratingComment = dto.ratingComment || '';
    ticket.updatedBy = userId;
    await ticket.save();
    return ticket.toObject();
  }

  // ── Comments ──

  async addComment(orgId: string, ticketId: string, dto: any, userId: string, userName: string) {
    const ticket = await this.ticketModel.findOne({ _id: ticketId, organizationId: orgId, isDeleted: false });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const comment = await this.commentModel.create({
      organizationId: orgId, ticketId, authorId: userId,
      authorName: userName, content: dto.content, isInternal: dto.isInternal || false,
    });

    // Track first agent response (non-internal, not from requester)
    if (!ticket.firstRespondedAt && userId !== ticket.requesterId && !dto.isInternal) {
      ticket.firstRespondedAt = new Date();
      ticket.slaResponseBreached = ticket.slaResponseDue ? new Date() > ticket.slaResponseDue : false;
      await ticket.save();
    }

    return comment.toObject();
  }

  async getComments(orgId: string, ticketId: string, isAgent: boolean) {
    const filter: any = { ticketId, organizationId: orgId };
    if (!isAgent) filter.isInternal = false;
    return this.commentModel.find(filter).sort({ createdAt: 1 }).lean();
  }

  // ── Teams ──

  async createTeam(orgId: string, dto: any, userId: string) {
    return this.teamModel.create({
      organizationId: orgId, name: dto.name, description: dto.description || '',
      category: dto.category || '', members: dto.members || [],
      slaPolicy: dto.slaPolicy || undefined, workingHours: dto.workingHours || undefined,
      autoAssign: dto.autoAssign !== false, createdBy: userId,
    });
  }

  async getTeams(orgId: string) {
    return this.teamModel.find({ organizationId: orgId, isDeleted: false, isActive: true }).sort({ name: 1 }).lean();
  }

  async getTeam(orgId: string, id: string) {
    const team = await this.teamModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async updateTeam(orgId: string, id: string, dto: any, userId: string) {
    const team = await this.teamModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false }, { ...dto }, { new: true },
    ).lean();
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async deleteTeam(orgId: string, id: string) {
    const team = await this.teamModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, isActive: false }, { new: true },
    );
    if (!team) throw new NotFoundException('Team not found');
    return { message: 'Team deleted' };
  }

  // ── Dashboard & Stats ──

  async getAgentDashboard(orgId: string, userId: string) {
    const now = new Date();
    const [openCount, assignedToMe, slaBreached, avgResolution, byCategory, byPriority] = await Promise.all([
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, status: { $in: ['open', 'assigned', 'in_progress', 'waiting_on_requester'] } }),
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, assigneeId: userId, status: { $nin: ['closed', 'cancelled', 'resolved'] } }),
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, $or: [{ slaResponseBreached: true }, { slaResolutionBreached: true }], status: { $nin: ['closed', 'cancelled'] } }),
      this.ticketModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false, resolvedAt: { $ne: null } } },
        { $project: { resolutionMs: { $subtract: ['$resolvedAt', '$createdAt'] } } },
        { $group: { _id: null, avg: { $avg: '$resolutionMs' } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    const avgResMs = avgResolution[0]?.avg || 0;
    const avgResHours = avgResMs > 0 ? Math.round(avgResMs / 3600000 * 10) / 10 : 0;

    // Recent unassigned
    const unassigned = await this.ticketModel.find({
      organizationId: orgId, isDeleted: false, assigneeId: null, status: 'open',
    }).sort({ createdAt: -1 }).limit(5).lean();

    return {
      openTickets: openCount, assignedToMe, slaBreached,
      avgResolutionHours: avgResHours,
      byCategory: byCategory.map(c => ({ category: c._id, count: c.count })),
      byPriority: byPriority.map(p => ({ priority: p._id, count: p.count })),
      unassignedTickets: unassigned,
    };
  }

  async getStats(orgId: string) {
    const [total, open, resolved, closed, avgRating, slaCompliance] = await Promise.all([
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false }),
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, status: { $in: ['open', 'assigned', 'in_progress'] } }),
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'resolved' }),
      this.ticketModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'closed' }),
      this.ticketModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false, rating: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ]),
      this.ticketModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false, resolvedAt: { $ne: null } } },
        { $group: { _id: null, total: { $sum: 1 }, breached: { $sum: { $cond: [{ $or: ['$slaResponseBreached', '$slaResolutionBreached'] }, 1, 0] } } } },
      ]),
    ]);

    const ratingData = avgRating[0] || { avg: 0, count: 0 };
    const slaData = slaCompliance[0] || { total: 0, breached: 0 };
    const slaCompliancePercent = slaData.total > 0 ? Math.round(((slaData.total - slaData.breached) / slaData.total) * 100) : 100;

    return {
      totalTickets: total, openTickets: open, resolvedTickets: resolved, closedTickets: closed,
      avgRating: Math.round(ratingData.avg * 10) / 10, ratedCount: ratingData.count,
      slaCompliancePercent,
    };
  }

  // ── Helper: check if user is an agent ──

  async isUserAgent(orgId: string, userId: string): Promise<boolean> {
    const team = await this.teamModel.findOne({
      organizationId: orgId, isActive: true, isDeleted: false,
      'members.userId': userId,
    });
    return !!team;
  }
}
