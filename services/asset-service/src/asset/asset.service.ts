import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAsset } from './schemas/asset.schema';
import { IAssetCategory } from './schemas/asset-category.schema';
import { IAssetAssignment } from './schemas/asset-assignment.schema';
import { IAssetMaintenance } from './schemas/asset-maintenance.schema';
import { IAssetCounter } from './schemas/counter.schema';

@Injectable()
export class AssetService {
  private readonly logger = new Logger(AssetService.name);

  constructor(
    @InjectModel('Asset') private assetModel: Model<IAsset>,
    @InjectModel('AssetCategory') private categoryModel: Model<IAssetCategory>,
    @InjectModel('AssetAssignment') private assignmentModel: Model<IAssetAssignment>,
    @InjectModel('AssetMaintenance') private maintenanceModel: Model<IAssetMaintenance>,
    @InjectModel('AssetCounter') private counterModel: Model<IAssetCounter>,
  ) {}

  // ── Helper: Generate Asset Tag ──

  private async generateAssetTag(orgId: string): Promise<string> {
    const counter = await this.counterModel.findOneAndUpdate(
      { organizationId: orgId },
      { $inc: { seq: 1 } },
      { upsert: true, new: true },
    );
    return `AST-${String(counter.seq).padStart(5, '0')}`;
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  // ── Categories ──

  async createCategory(dto: any, userId: string, orgId: string) {
    const slug = this.slugify(dto.name);
    const existing = await this.categoryModel.findOne({ organizationId: orgId, slug, isDeleted: false });
    if (existing) throw new ConflictException('Category with this name already exists');

    return this.categoryModel.create({
      organizationId: orgId,
      name: dto.name,
      slug,
      description: dto.description || '',
      icon: dto.icon || '',
      customFields: dto.customFields || [],
      depreciationMethod: dto.depreciationMethod || 'straight_line',
      defaultUsefulLifeYears: dto.defaultUsefulLifeYears || 3,
      createdBy: userId,
    });
  }

  async getCategories(orgId: string) {
    return this.categoryModel.find({ organizationId: orgId, isDeleted: false }).sort({ name: 1 }).lean();
  }

  async getCategory(orgId: string, id: string) {
    const cat = await this.categoryModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async updateCategory(orgId: string, id: string, dto: any, userId: string) {
    const updates: any = { ...dto, updatedBy: userId };
    if (dto.name) updates.slug = this.slugify(dto.name);
    const cat = await this.categoryModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      updates,
      { new: true },
    ).lean();
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async deleteCategory(orgId: string, id: string, userId: string) {
    const assetCount = await this.assetModel.countDocuments({ organizationId: orgId, categoryId: id, isDeleted: false });
    if (assetCount > 0) throw new BadRequestException(`Cannot delete category with ${assetCount} assets. Reassign or remove them first.`);

    const cat = await this.categoryModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!cat) throw new NotFoundException('Category not found');
    return { message: 'Category deleted' };
  }

  // ── Assets CRUD ──

  async createAsset(dto: any, userId: string, orgId: string) {
    const category = await this.categoryModel.findOne({ _id: dto.categoryId, organizationId: orgId, isDeleted: false });
    if (!category) throw new NotFoundException('Category not found');

    const assetTag = await this.generateAssetTag(orgId);

    const asset = await this.assetModel.create({
      organizationId: orgId,
      assetTag,
      name: dto.name,
      categoryId: dto.categoryId,
      serialNumber: dto.serialNumber || '',
      modelName: dto.model || '',
      manufacturer: dto.manufacturer || '',
      description: dto.description || '',
      condition: dto.condition || 'new',
      status: 'available',
      purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
      purchasePrice: dto.purchasePrice || 0,
      vendor: dto.vendor || '',
      invoiceNumber: dto.invoiceNumber || '',
      warrantyStartDate: dto.warrantyStartDate ? new Date(dto.warrantyStartDate) : null,
      warrantyEndDate: dto.warrantyEndDate ? new Date(dto.warrantyEndDate) : null,
      warrantyProvider: dto.warrantyProvider || '',
      warrantyNotes: dto.warrantyNotes || '',
      location: dto.location || '',
      building: dto.building || '',
      floor: dto.floor || '',
      depreciationMethod: dto.depreciationMethod || category.depreciationMethod || 'straight_line',
      usefulLifeYears: dto.usefulLifeYears || category.defaultUsefulLifeYears || 3,
      salvageValue: dto.salvageValue || 0,
      currentBookValue: dto.purchasePrice || 0,
      customFieldValues: dto.customFieldValues || {},
      tags: dto.tags || [],
      notes: dto.notes || '',
      createdBy: userId,
    });

    return asset.toObject();
  }

  async getAssets(orgId: string, query: any) {
    const filter: any = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.categoryId) filter.categoryId = query.categoryId;
    if (query.assigneeId) filter.currentAssigneeId = query.assigneeId;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { assetTag: { $regex: query.search, $options: 'i' } },
        { serialNumber: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

    const [data, total] = await Promise.all([
      this.assetModel.find(filter).sort({ [sortField]: sortOrder }).skip((page - 1) * limit).limit(limit).lean(),
      this.assetModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getAsset(orgId: string, id: string) {
    const asset = await this.assetModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async updateAsset(orgId: string, id: string, dto: any, userId: string) {
    const asset = await this.assetModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { ...dto, updatedBy: userId },
      { new: true },
    ).lean();
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async deleteAsset(orgId: string, id: string, userId: string) {
    const asset = await this.assetModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!asset) throw new NotFoundException('Asset not found');
    return { message: 'Asset deleted' };
  }

  // ── Assignment ──

  async assignAsset(dto: any, userId: string, orgId: string) {
    const asset = await this.assetModel.findOne({ _id: dto.assetId, organizationId: orgId, isDeleted: false });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status === 'assigned') throw new BadRequestException('Asset is already assigned');
    if (asset.status === 'retired' || asset.status === 'disposed') throw new BadRequestException('Cannot assign retired/disposed asset');

    asset.currentAssigneeId = dto.assigneeId;
    asset.currentAssigneeType = dto.assigneeType || 'employee';
    asset.assignedAt = new Date();
    asset.status = 'assigned';
    asset.updatedBy = userId;
    await asset.save();

    await this.assignmentModel.create({
      organizationId: orgId,
      assetId: asset._id.toString(),
      assetTag: asset.assetTag,
      action: 'assigned',
      assigneeId: dto.assigneeId,
      assigneeType: dto.assigneeType || 'employee',
      assignedBy: userId,
      assignedAt: new Date(),
      expectedReturnDate: dto.expectedReturnDate ? new Date(dto.expectedReturnDate) : null,
      conditionAtAssignment: asset.condition,
      notes: dto.notes || '',
    });

    return asset.toObject();
  }

  async unassignAsset(dto: any, userId: string, orgId: string) {
    const asset = await this.assetModel.findOne({ _id: dto.assetId, organizationId: orgId, isDeleted: false });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.status !== 'assigned') throw new BadRequestException('Asset is not currently assigned');

    const prevAssignee = asset.currentAssigneeId;

    // Update the latest assignment record
    await this.assignmentModel.findOneAndUpdate(
      { assetId: asset._id.toString(), assigneeId: prevAssignee, returnedAt: null, organizationId: orgId },
      { returnedAt: new Date(), conditionAtReturn: dto.conditionAtReturn || '' },
      { sort: { assignedAt: -1 } },
    );

    // Create unassignment record
    await this.assignmentModel.create({
      organizationId: orgId,
      assetId: asset._id.toString(),
      assetTag: asset.assetTag,
      action: 'unassigned',
      assigneeId: prevAssignee,
      assignedBy: userId,
      assignedAt: new Date(),
      returnedAt: new Date(),
      conditionAtReturn: dto.conditionAtReturn || '',
      notes: dto.notes || '',
    });

    asset.currentAssigneeId = null;
    asset.currentAssigneeType = null;
    asset.assignedAt = null;
    asset.status = 'available';
    if (dto.conditionAtReturn) asset.condition = dto.conditionAtReturn;
    asset.updatedBy = userId;
    await asset.save();

    return asset.toObject();
  }

  async transferAsset(dto: any, userId: string, orgId: string) {
    const asset = await this.assetModel.findOne({ _id: dto.assetId, organizationId: orgId, isDeleted: false });
    if (!asset) throw new NotFoundException('Asset not found');
    if (asset.currentAssigneeId !== dto.fromAssigneeId) throw new BadRequestException('Asset is not assigned to the specified employee');

    // Close old assignment
    await this.assignmentModel.findOneAndUpdate(
      { assetId: asset._id.toString(), assigneeId: dto.fromAssigneeId, returnedAt: null, organizationId: orgId },
      { returnedAt: new Date() },
      { sort: { assignedAt: -1 } },
    );

    // Create transfer record
    await this.assignmentModel.create({
      organizationId: orgId,
      assetId: asset._id.toString(),
      assetTag: asset.assetTag,
      action: 'transferred',
      assigneeId: dto.toAssigneeId,
      previousAssigneeId: dto.fromAssigneeId,
      assignedBy: userId,
      assignedAt: new Date(),
      notes: dto.notes || '',
    });

    asset.currentAssigneeId = dto.toAssigneeId;
    asset.assignedAt = new Date();
    asset.updatedBy = userId;
    await asset.save();

    return asset.toObject();
  }

  async bulkAssign(dto: any, userId: string, orgId: string) {
    const results = [];
    for (const assetId of dto.assetIds) {
      try {
        const result = await this.assignAsset({ assetId, assigneeId: dto.assigneeId, notes: dto.notes }, userId, orgId);
        results.push({ assetId, success: true, data: result });
      } catch (err) {
        results.push({ assetId, success: false, error: err.message });
      }
    }
    return results;
  }

  async bulkUnassign(dto: any, userId: string, orgId: string) {
    const results = [];
    for (const assetId of dto.assetIds) {
      try {
        const result = await this.unassignAsset({ assetId, ...dto }, userId, orgId);
        results.push({ assetId, success: true, data: result });
      } catch (err) {
        results.push({ assetId, success: false, error: err.message });
      }
    }
    return results;
  }

  // ── Employee Assets ──

  async getEmployeeAssets(orgId: string, employeeId: string) {
    return this.assetModel.find({
      organizationId: orgId,
      currentAssigneeId: employeeId,
      status: 'assigned',
      isDeleted: false,
    }).lean();
  }

  async getUnreturnedAssets(orgId: string, employeeId: string) {
    return this.assetModel.find({
      organizationId: orgId,
      currentAssigneeId: employeeId,
      status: 'assigned',
      isDeleted: false,
    }).select('_id assetTag name categoryId serialNumber condition assignedAt').lean();
  }

  // ── History & Maintenance ──

  async getAssetHistory(orgId: string, assetId: string) {
    return this.assignmentModel.find({
      organizationId: orgId,
      assetId,
      isDeleted: false,
    }).sort({ assignedAt: -1 }).lean();
  }

  async getAssetMaintenance(orgId: string, assetId: string) {
    return this.maintenanceModel.find({
      organizationId: orgId,
      assetId,
      isDeleted: false,
    }).sort({ createdAt: -1 }).lean();
  }

  async createMaintenance(dto: any, userId: string, orgId: string) {
    const asset = await this.assetModel.findOne({ _id: dto.assetId, organizationId: orgId, isDeleted: false });
    if (!asset) throw new NotFoundException('Asset not found');

    const log = await this.maintenanceModel.create({
      organizationId: orgId,
      assetId: dto.assetId,
      assetTag: asset.assetTag,
      type: dto.type,
      description: dto.description,
      vendor: dto.vendor || '',
      cost: dto.cost || 0,
      scheduledDate: dto.scheduledDate ? new Date(dto.scheduledDate) : null,
      createdBy: userId,
    });

    // Optionally set asset to maintenance status
    if (asset.status === 'available') {
      asset.status = 'maintenance';
      asset.updatedBy = userId;
      await asset.save();
    }

    return log.toObject();
  }

  async updateMaintenance(orgId: string, id: string, dto: any, userId: string) {
    const log = await this.maintenanceModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { ...dto, completionDate: dto.completionDate ? new Date(dto.completionDate) : undefined },
      { new: true },
    ).lean();
    if (!log) throw new NotFoundException('Maintenance log not found');

    // If completed, set asset back to available
    if (dto.status === 'completed' && log.assetId) {
      await this.assetModel.findOneAndUpdate(
        { _id: log.assetId, organizationId: orgId, status: 'maintenance' },
        { status: 'available', updatedBy: userId },
      );
    }

    return log;
  }

  // ── Dashboard Stats ──

  async getStats(orgId: string) {
    const [
      totalAssets, assigned, available, inMaintenance, retired,
      byCategory, warrantyExpiring30, warrantyExpiring90,
      recentAssignments, totalValue,
    ] = await Promise.all([
      this.assetModel.countDocuments({ organizationId: orgId, isDeleted: false }),
      this.assetModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'assigned' }),
      this.assetModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'available' }),
      this.assetModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'maintenance' }),
      this.assetModel.countDocuments({ organizationId: orgId, isDeleted: false, status: 'retired' }),
      this.assetModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } },
      ]),
      this.assetModel.countDocuments({
        organizationId: orgId, isDeleted: false,
        warrantyEndDate: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        status: { $nin: ['retired', 'disposed'] },
      }),
      this.assetModel.countDocuments({
        organizationId: orgId, isDeleted: false,
        warrantyEndDate: { $gte: new Date(), $lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
        status: { $nin: ['retired', 'disposed'] },
      }),
      this.assignmentModel.find({ organizationId: orgId, isDeleted: false })
        .sort({ assignedAt: -1 }).limit(10).lean(),
      this.assetModel.aggregate([
        { $match: { organizationId: orgId, isDeleted: false } },
        { $group: { _id: null, totalPurchase: { $sum: '$purchasePrice' }, totalBook: { $sum: '$currentBookValue' } } },
      ]),
    ]);

    // Enrich byCategory with names
    const categories = await this.categoryModel.find({ organizationId: orgId, isDeleted: false }).select('_id name').lean();
    const catMap = new Map(categories.map(c => [c._id.toString(), c.name]));
    const byCategoryEnriched = byCategory.map(c => ({
      categoryId: c._id,
      categoryName: catMap.get(c._id) || 'Unknown',
      count: c.count,
    }));

    const valueSummary = totalValue[0] || { totalPurchase: 0, totalBook: 0 };

    return {
      totalAssets, assigned, available, inMaintenance, retired,
      byCategory: byCategoryEnriched,
      warrantyExpiringIn30Days: warrantyExpiring30,
      warrantyExpiringIn90Days: warrantyExpiring90,
      totalAssetValue: valueSummary.totalPurchase,
      totalDepreciatedValue: valueSummary.totalBook,
      recentAssignments,
    };
  }

  async getWarrantyExpiring(orgId: string, days: number = 30) {
    const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return this.assetModel.find({
      organizationId: orgId,
      isDeleted: false,
      warrantyEndDate: { $gte: new Date(), $lte: cutoff },
      status: { $nin: ['retired', 'disposed'] },
    }).sort({ warrantyEndDate: 1 }).lean();
  }
}
