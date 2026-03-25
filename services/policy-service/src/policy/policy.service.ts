import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPolicy } from './schemas/policy.schema';
import { IPolicyAcknowledgement } from './schemas/policy-acknowledgement.schema';
import {
  CreatePolicyDto, UpdatePolicyDto, PolicyQueryDto,
  CreateFromTemplateDto, AcknowledgePolicyDto,
} from './dto/index';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(
    @InjectModel('Policy') private policyModel: Model<IPolicy>,
    @InjectModel('PolicyAcknowledgement') private acknowledgementModel: Model<IPolicyAcknowledgement>,
  ) {}

  // ── Create Policy ──

  async createPolicy(dto: CreatePolicyDto, userId: string, orgId?: string) {
    const policy = new this.policyModel({
      ...dto,
      organizationId: orgId || null,
      version: 1,
      isLatestVersion: true,
      isDeleted: false,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await policy.save();
    this.logger.debug(`Policy created: ${saved._id} by user ${userId}`);
    return saved;
  }

  // ── Get Policies (paginated) ──

  async getPolicies(query: PolicyQueryDto, orgId?: string) {
    const filter: any = {
      isDeleted: false,
    };

    // Org-scoped: show org policies + global templates
    if (orgId) {
      filter.$or = [
        { organizationId: orgId },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ];
    }

    if (query.category) filter.category = query.category;
    if (query.applicableTo) filter.applicableTo = query.applicableTo;
    if (query.isTemplate !== undefined) filter.isTemplate = query.isTemplate;
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    // Default to latest version only
    if (query.isLatestVersion !== undefined) {
      filter.isLatestVersion = query.isLatestVersion;
    } else {
      filter.isLatestVersion = true;
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.policyModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.policyModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ── Get Policy By ID ──

  async getPolicyById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) {
      filter.$or = [
        { organizationId: orgId },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ];
    }

    const policy = await this.policyModel.findOne(filter).exec();
    if (!policy) {
      throw new NotFoundException('Policy not found');
    }
    return policy;
  }

  // ── Update Policy (versioned) ──

  async updatePolicy(id: string, dto: UpdatePolicyDto, userId: string, orgId?: string) {
    const existing = await this.getPolicyById(id, orgId);

    if (existing.isTemplate) {
      throw new BadRequestException('Cannot update a template policy. Create from template instead.');
    }

    // If ONLY isActive is being changed, update in-place (no version bump)
    const dtoKeys = Object.keys(dto).filter(k => dto[k] !== undefined && k !== 'changeLog');
    if (dtoKeys.length === 1 && dtoKeys[0] === 'isActive') {
      await this.policyModel.updateOne({ _id: existing._id }, { isActive: dto.isActive, updatedBy: userId }).exec();
      this.logger.debug(`Policy ${id} active status toggled to ${dto.isActive}`);
      return this.policyModel.findById(existing._id);
    }

    // Build change summary comparing old vs new
    const changes: string[] = [];
    for (const key of Object.keys(dto)) {
      if (key === 'changeLog' || dto[key] === undefined) continue;
      const oldVal = (existing as unknown as Record<string, unknown>)[key];
      const newVal = dto[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push(key);
      }
    }

    // Mark old version as not latest
    await this.policyModel.updateOne({ _id: existing._id }, { isLatestVersion: false }).exec();

    // Create new version
    const oldObj = existing.toObject();
    delete oldObj._id;
    delete oldObj.__v;

    const changeLog = dto.changeLog || (changes.length > 0 ? `Updated: ${changes.join(', ')}` : 'Updated');

    const newVersion = new this.policyModel({
      ...oldObj,
      ...dto,
      version: existing.version + 1,
      previousVersionId: existing._id,
      isLatestVersion: true,
      updatedBy: userId,
      changeLog,
    });

    const saved = await newVersion.save();
    this.logger.debug(`Policy ${id} updated to version ${saved.version} by user ${userId}`);
    return saved;
  }

  // ── Delete Policy (soft) ──

  async deletePolicy(id: string, orgId?: string) {
    const policy = await this.getPolicyById(id, orgId);

    if (policy.isTemplate) {
      throw new BadRequestException('Cannot delete a template policy.');
    }

    await this.policyModel.updateOne({ _id: id }, { isDeleted: true }).exec();
    this.logger.debug(`Policy ${id} soft-deleted`);
    return { message: 'Policy deleted successfully' };
  }

  // ── Templates ──

  async getTemplates(category?: string) {
    const filter: any = {
      isTemplate: true,
      isDeleted: false,
    };
    if (category) filter.category = category;

    return this.policyModel.find(filter).sort({ category: 1, policyName: 1 }).exec();
  }

  // ── Create From Template ──

  async createFromTemplate(templateId: string, overrides: CreateFromTemplateDto, userId: string, orgId?: string) {
    const template = await this.policyModel.findOne({ _id: templateId, isTemplate: true, isDeleted: false }).exec();
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const templateObj = template.toObject();
    delete templateObj._id;
    delete templateObj.__v;

    const policy = new this.policyModel({
      ...templateObj,
      ...overrides,
      policyName: overrides.policyName || templateObj.policyName,
      organizationId: orgId || null,
      isTemplate: false,
      templateName: null,
      sourceTemplateId: template._id,
      version: 1,
      previousVersionId: null,
      isLatestVersion: true,
      isDeleted: false,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await policy.save();
    this.logger.debug(`Policy created from template ${templateId}: ${saved._id}`);
    return saved;
  }

  // ── Version History ──

  async getVersionHistory(id: string) {
    const versions: IPolicy[] = [];

    let current = await this.policyModel.findOne({ _id: id, isDeleted: false }).exec();
    if (!current) {
      throw new NotFoundException('Policy not found');
    }

    // Walk forward: find the latest version that traces back to this id
    // First, find the latest version in this chain
    let latest = await this.policyModel.findOne({
      isLatestVersion: true,
      isDeleted: false,
      $or: [
        { _id: id },
        { previousVersionId: id },
      ],
    }).exec();

    // Walk backwards from latest (or from the requested id)
    let walker = latest || current;
    while (walker) {
      versions.push(walker);
      if (walker.previousVersionId) {
        walker = await this.policyModel.findById(walker.previousVersionId).exec();
      } else {
        break;
      }
    }

    return versions;
  }

  // ── Acknowledge Policy ──

  async acknowledgePolicy(policyId: string, employeeId: string, dto: AcknowledgePolicyDto) {
    const policy = await this.policyModel.findOne({ _id: policyId, isDeleted: false }).exec();
    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    const version = dto.version || policy.version;

    // Upsert acknowledgement
    const ack = await this.acknowledgementModel.findOneAndUpdate(
      { policyId, employeeId },
      {
        policyId,
        employeeId,
        acknowledgedAt: new Date(),
        version,
      },
      { upsert: true, new: true },
    ).exec();

    this.logger.debug(`Policy ${policyId} acknowledged by employee ${employeeId} (v${version})`);
    return ack;
  }

  // ── Get Applicable Policies ──

  async getApplicablePolicies(orgId?: string, departmentId?: string, designationId?: string, employeeId?: string) {
    const filter: any = {
      isDeleted: false,
      isActive: true,
      isLatestVersion: true,
      isTemplate: false,
    };

    if (orgId) {
      filter.$or = [
        { organizationId: orgId },
        { organizationId: { $exists: false } },
        { organizationId: null },
      ];
    }

    const policies = await this.policyModel.find(filter).exec();

    // Filter by applicability
    return policies.filter((policy) => {
      if (policy.applicableTo === 'all') return true;

      if (policy.applicableTo === 'department' && departmentId) {
        return policy.applicableIds?.includes(departmentId);
      }
      if (policy.applicableTo === 'designation' && designationId) {
        return policy.applicableIds?.includes(designationId);
      }
      if (policy.applicableTo === 'specific' && employeeId) {
        return policy.applicableIds?.includes(employeeId);
      }

      return false;
    });
  }
}
