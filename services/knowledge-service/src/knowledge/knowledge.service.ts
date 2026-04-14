import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { ISpace } from './schemas/space.schema';
import { IPage } from './schemas/page.schema';
import { IPageVersion } from './schemas/page-version.schema';
import { IPageTemplate } from './schemas/page-template.schema';
import { IBookmark } from './schemas/bookmark.schema';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly aiServiceUrl: string;

  constructor(
    @InjectModel('Space') private spaceModel: Model<ISpace>,
    @InjectModel('Page') private pageModel: Model<IPage>,
    @InjectModel('PageVersion') private versionModel: Model<IPageVersion>,
    @InjectModel('PageTemplate') private templateModel: Model<IPageTemplate>,
    @InjectModel('Bookmark') private bookmarkModel: Model<IBookmark>,
    private configService: ConfigService,
  ) {
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://localhost:3080';
  }

  private slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // ── Spaces ──

  async createSpace(orgId: string, dto: any, userId: string) {
    const slug = this.slugify(dto.name);
    const existing = await this.spaceModel.findOne({ organizationId: orgId, slug, isDeleted: false });
    if (existing) throw new ConflictException('A space with this name already exists');

    return this.spaceModel.create({
      organizationId: orgId, name: dto.name, slug,
      description: dto.description || '', icon: dto.icon || '📚', color: dto.color || '#3B82F6',
      visibility: dto.visibility || 'public',
      allowedRoles: dto.allowedRoles || [], allowedTeamIds: dto.allowedTeamIds || [], allowedUserIds: dto.allowedUserIds || [],
      createdBy: userId,
    });
  }

  async getSpaces(orgId: string) {
    return this.spaceModel.find({ organizationId: orgId, isDeleted: false }).sort({ order: 1, name: 1 }).lean();
  }

  async getSpace(orgId: string, id: string) {
    const space = await this.spaceModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async updateSpace(orgId: string, id: string, dto: any, userId: string) {
    const updates: any = { ...dto, updatedBy: userId };
    if (dto.name) updates.slug = this.slugify(dto.name);
    const space = await this.spaceModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false }, updates, { new: true },
    ).lean();
    if (!space) throw new NotFoundException('Space not found');
    return space;
  }

  async deleteSpace(orgId: string, id: string, userId: string) {
    const space = await this.spaceModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: userId }, { new: true },
    );
    if (!space) throw new NotFoundException('Space not found');
    // Soft delete all pages in the space
    await this.pageModel.updateMany(
      { spaceId: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );
    return { message: 'Space deleted' };
  }

  async getSpaceTree(orgId: string, spaceId: string) {
    const pages = await this.pageModel.find({
      spaceId, organizationId: orgId, isDeleted: false,
    }).select('_id title slug parentId icon status isPinned order version').sort({ order: 1 }).lean();

    // Build tree in memory
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const page of pages) {
      map.set(page._id.toString(), { ...page, children: [] });
    }
    for (const page of pages) {
      const node = map.get(page._id.toString());
      if (page.parentId && map.has(page.parentId)) {
        map.get(page.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  // ── Pages ──

  async createPage(orgId: string, dto: any, userId: string) {
    // Validate space exists
    const space = await this.spaceModel.findOne({ _id: dto.spaceId, organizationId: orgId, isDeleted: false });
    if (!space) throw new NotFoundException('Space not found');

    // If templateId provided, load template content
    let initialContent = dto.content || '';
    if (dto.templateId) {
      const template = await this.templateModel.findOne({ _id: dto.templateId, isDeleted: false });
      if (template) initialContent = template.content;
    }

    const slug = this.slugify(dto.title) + '-' + Date.now().toString(36);
    const plainText = this.stripHtml(initialContent);

    const page = await this.pageModel.create({
      organizationId: orgId, spaceId: dto.spaceId, parentId: dto.parentId || null,
      title: dto.title, slug, content: initialContent, contentPlainText: plainText,
      excerpt: plainText.slice(0, 200), icon: dto.icon || '📄',
      status: dto.status || 'draft', version: 1,
      tags: dto.tags || [], createdBy: userId, lastEditedBy: userId,
    });

    return page.toObject();
  }

  async getPage(orgId: string, id: string) {
    const page = await this.pageModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async updatePage(orgId: string, id: string, dto: any, userId: string) {
    const page = await this.pageModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!page) throw new NotFoundException('Page not found');

    // Save current state as version snapshot before updating
    await this.versionModel.create({
      organizationId: orgId, pageId: page._id.toString(), version: page.version,
      title: page.title, content: page.content, contentPlainText: page.contentPlainText,
      editedBy: page.lastEditedBy, changeSummary: dto.changeSummary || '',
    });

    // Apply updates
    if (dto.title) { page.title = dto.title; page.slug = this.slugify(dto.title) + '-' + Date.now().toString(36); }
    if (dto.content !== undefined) {
      page.content = dto.content;
      page.contentPlainText = this.stripHtml(dto.content);
      page.excerpt = page.contentPlainText.slice(0, 200);
    }
    if (dto.icon) page.icon = dto.icon;
    if (dto.status) page.status = dto.status;
    if (dto.tags) page.tags = dto.tags;
    if (dto.coverImage !== undefined) page.coverImage = dto.coverImage;

    page.version += 1;
    page.lastEditedBy = userId;
    page.updatedBy = userId;
    await page.save();

    return page.toObject();
  }

  async deletePage(orgId: string, id: string, userId: string) {
    const page = await this.pageModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: userId }, { new: true },
    );
    if (!page) throw new NotFoundException('Page not found');
    // Also delete child pages
    await this.pageModel.updateMany(
      { parentId: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );
    return { message: 'Page deleted' };
  }

  async movePage(orgId: string, id: string, dto: any, userId: string) {
    const updates: any = { updatedBy: userId };
    if (dto.parentId !== undefined) updates.parentId = dto.parentId || null;
    if (dto.spaceId) updates.spaceId = dto.spaceId;

    const page = await this.pageModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false }, updates, { new: true },
    ).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async reorderPage(orgId: string, id: string, order: number, userId: string) {
    const page = await this.pageModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { order, updatedBy: userId }, { new: true },
    ).lean();
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async togglePin(orgId: string, id: string, userId: string) {
    const page = await this.pageModel.findOne({ _id: id, organizationId: orgId, isDeleted: false });
    if (!page) throw new NotFoundException('Page not found');
    page.isPinned = !page.isPinned;
    page.updatedBy = userId;
    await page.save();
    return page.toObject();
  }

  // ── Versions ──

  async getVersions(orgId: string, pageId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      this.versionModel.find({ pageId, organizationId: orgId })
        .sort({ version: -1 }).skip((page - 1) * limit).limit(limit)
        .select('version title editedBy changeSummary createdAt').lean(),
      this.versionModel.countDocuments({ pageId, organizationId: orgId }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getVersion(orgId: string, pageId: string, version: number) {
    const v = await this.versionModel.findOne({ pageId, version, organizationId: orgId }).lean();
    if (!v) throw new NotFoundException('Version not found');
    return v;
  }

  async restoreVersion(orgId: string, pageId: string, version: number, userId: string) {
    const v = await this.versionModel.findOne({ pageId, version, organizationId: orgId });
    if (!v) throw new NotFoundException('Version not found');

    return this.updatePage(orgId, pageId, {
      title: v.title, content: v.content, changeSummary: `Restored from version ${version}`,
    }, userId);
  }

  // ── Search ──

  async search(orgId: string, query: any) {
    const filter: any = { organizationId: orgId, isDeleted: false, status: 'published' };
    if (query.spaceId) filter.spaceId = query.spaceId;
    if (query.tags) {
      const tagList = query.tags.split(',').map((t: string) => t.trim());
      filter.tags = { $in: tagList };
    }

    const limit = Math.min(50, query.limit || 20);

    if (query.q) {
      filter.$text = { $search: query.q };
      const results = await this.pageModel.find(filter, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } }).limit(limit)
        .select('_id title slug spaceId excerpt icon tags isPinned version createdAt updatedAt')
        .lean();
      return results;
    }

    return this.pageModel.find(filter).sort({ updatedAt: -1 }).limit(limit)
      .select('_id title slug spaceId excerpt icon tags isPinned version createdAt updatedAt').lean();
  }

  async semanticSearch(orgId: string, queryText: string, spaceId?: string) {
    // Step 1: Get candidate pages via text search
    const filter: any = { organizationId: orgId, isDeleted: false, status: 'published' };
    if (spaceId) filter.spaceId = spaceId;

    const candidates = await this.pageModel.find(filter)
      .sort({ updatedAt: -1 }).limit(30)
      .select('_id title excerpt spaceId icon tags').lean();

    if (candidates.length === 0) return [];

    // Step 2: Ask AI to rank by relevance
    try {
      const pageList = candidates.map((p, i) => `${i + 1}. [${p._id}] "${p.title}" - ${p.excerpt?.slice(0, 100) || 'No excerpt'}`).join('\n');

      const prompt = `Given this user query: "${queryText}"\n\nRank these wiki pages by relevance. Return ONLY a JSON array of page IDs (the values in brackets), most relevant first. Only include relevant pages.\n\nPages:\n${pageList}`;

      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, systemPrompt: 'You are a search ranking assistant. Return only valid JSON arrays of strings.' }),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) throw new Error(`AI service returned ${res.status}`);
      const data: any = await res.json();
      const responseText = data?.data?.response || data?.response || '';

      // Extract JSON array from response
      const match = responseText.match(/\[[\s\S]*?\]/);
      if (match) {
        const rankedIds: string[] = JSON.parse(match[0]);
        const idMap = new Map(candidates.map(c => [c._id.toString(), c]));
        return rankedIds.map(id => idMap.get(id)).filter(Boolean);
      }
    } catch (err: any) {
      this.logger.warn(`Semantic search failed, falling back to text results: ${err?.message}`);
    }

    // Fallback: return candidates as-is
    return candidates;
  }

  // ── Pages by Entity ──

  async getPagesByEntity(orgId: string, entityType: string, entityId: string) {
    return this.pageModel.find({
      organizationId: orgId, isDeleted: false,
      'linkedEntities.entityType': entityType,
      'linkedEntities.entityId': entityId,
    }).select('_id title slug spaceId icon status').lean();
  }

  // ── Templates ──

  async createTemplate(orgId: string, dto: any, userId: string) {
    const slug = this.slugify(dto.name);
    return this.templateModel.create({
      organizationId: orgId, name: dto.name, slug,
      description: dto.description || '', category: dto.category || 'custom',
      content: dto.content || '', icon: dto.icon || '📝', createdBy: userId,
    });
  }

  async getTemplates(orgId: string) {
    return this.templateModel.find({
      $or: [{ organizationId: orgId }, { organizationId: null, isSystem: true }],
      isDeleted: false,
    }).sort({ isSystem: -1, order: 1 }).lean();
  }

  async getTemplate(orgId: string, id: string) {
    const t = await this.templateModel.findOne({ _id: id, isDeleted: false }).lean();
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async updateTemplate(orgId: string, id: string, dto: any, userId: string) {
    const t = await this.templateModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { ...dto }, { new: true },
    ).lean();
    if (!t) throw new NotFoundException('Template not found');
    return t;
  }

  async deleteTemplate(orgId: string, id: string) {
    const t = await this.templateModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false, isSystem: false },
      { isDeleted: true }, { new: true },
    );
    if (!t) throw new NotFoundException('Template not found or is a system template');
    return { message: 'Template deleted' };
  }

  // ── Bookmarks ──

  async addBookmark(orgId: string, userId: string, pageId: string) {
    const page = await this.pageModel.findOne({ _id: pageId, organizationId: orgId, isDeleted: false });
    if (!page) throw new NotFoundException('Page not found');

    const existing = await this.bookmarkModel.findOne({ userId, pageId });
    if (existing) return existing.toObject();

    return this.bookmarkModel.create({ organizationId: orgId, userId, pageId, spaceId: page.spaceId });
  }

  async removeBookmark(userId: string, pageId: string) {
    await this.bookmarkModel.deleteOne({ userId, pageId });
    return { message: 'Bookmark removed' };
  }

  async getBookmarks(orgId: string, userId: string) {
    const bookmarks = await this.bookmarkModel.find({ userId, organizationId: orgId }).sort({ createdAt: -1 }).lean();
    const pageIds = bookmarks.map(b => b.pageId);
    const pages = await this.pageModel.find({ _id: { $in: pageIds }, isDeleted: false })
      .select('_id title slug spaceId icon status excerpt').lean();
    const pageMap = new Map(pages.map(p => [p._id.toString(), p]));
    return bookmarks.map(b => ({ ...b, page: pageMap.get(b.pageId) || null })).filter(b => b.page);
  }
}
