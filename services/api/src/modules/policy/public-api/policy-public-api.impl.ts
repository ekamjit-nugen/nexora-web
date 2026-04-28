import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PolicyPublicApi, PolicySummary } from './policy-public-api';
import { POLICY_DB } from '../../../bootstrap/database/database.tokens';

@Injectable()
export class PolicyPublicApiImpl implements PolicyPublicApi {
  constructor(
    @InjectModel('Policy', POLICY_DB) private readonly policyModel: Model<any>,
  ) {}

  async getActivePoliciesForOrg(
    organizationId: string,
    category?: string,
  ): Promise<PolicySummary[]> {
    const filter: any = { organizationId, isActive: true, isDeleted: { $ne: true } };
    if (category) filter.category = category;
    const rows: any[] = await this.policyModel.find(filter).lean();
    return rows.map((p) => ({
      _id: String(p._id),
      organizationId: String(p.organizationId),
      name: p.name,
      category: p.category,
      rules: Array.isArray(p.rules) ? p.rules : [],
      effectiveFrom: p.effectiveFrom || null,
      isActive: p.isActive === true,
    }));
  }
}
