import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model } from 'mongoose';
import { IBenchSnapshot } from './schemas/bench-snapshot.schema';
import { IResourceRequest } from './schemas/resource-request.schema';
import { IBenchConfig } from './schemas/bench-config.schema';

export interface EmployeeData {
  userId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  skills: string[];
  joiningDate: string;
  status: string;
}

export interface ProjectAllocation {
  projectId: string;
  projectName: string;
  allocationPercentage: number;
  role: string;
}

export interface SalaryData {
  employeeId: string;
  ctc: number;
  grossSalary: number;
  netSalary: number;
}

export interface DepartmentData {
  _id: string;
  name: string;
}

@Injectable()
export class BenchService {
  private readonly logger = new Logger(BenchService.name);
  private readonly hrServiceUrl: string;
  private readonly projectServiceUrl: string;
  private readonly payrollServiceUrl: string;

  constructor(
    @InjectModel('BenchSnapshot', 'nexora_bench') private snapshotModel: Model<IBenchSnapshot>,
    @InjectModel('ResourceRequest', 'nexora_bench') private requestModel: Model<IResourceRequest>,
    @InjectModel('BenchConfig', 'nexora_bench') private configModel: Model<IBenchConfig>,
    private configService: ConfigService,
  ) {
    this.hrServiceUrl = this.configService.get<string>('HR_SERVICE_URL') || 'http://localhost:3010';
    this.projectServiceUrl = this.configService.get<string>('PROJECT_SERVICE_URL') || 'http://localhost:3020';
    this.payrollServiceUrl = this.configService.get<string>('PAYROLL_SERVICE_URL') || 'http://localhost:3014';
  }

  // ── Cross-Service HTTP Helpers ──

  private async fetchJSON(url: string, token?: string, timeoutMs = 8000): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = token;
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) {
        this.logger.warn(`HTTP ${res.status} from ${url}`);
        return null;
      }
      const json: any = await res.json();
      return json?.data ?? json;
    } catch (err: any) {
      this.logger.warn(`Failed to fetch ${url}: ${err?.message || err}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchEmployees(orgId: string, token?: string): Promise<EmployeeData[]> {
    const url = `${this.hrServiceUrl}/api/v1/employees?status=active&limit=10000&organizationId=${orgId}`;
    const result = await this.fetchJSON(url, token);
    return Array.isArray(result) ? result : result?.data || [];
  }

  private async fetchDepartments(orgId: string, token?: string): Promise<DepartmentData[]> {
    const url = `${this.hrServiceUrl}/api/v1/departments?organizationId=${orgId}`;
    const result = await this.fetchJSON(url, token);
    return Array.isArray(result) ? result : result?.data || [];
  }

  private async fetchProjectAllocations(orgId: string, token?: string): Promise<Map<string, ProjectAllocation[]>> {
    const url = `${this.projectServiceUrl}/api/v1/projects?status=active&limit=10000&organizationId=${orgId}`;
    const projects = await this.fetchJSON(url, token);
    const allocationMap = new Map<string, ProjectAllocation[]>();

    const projectList = Array.isArray(projects) ? projects : projects?.data || [];
    for (const proj of projectList) {
      if (!proj.team) continue;
      for (const member of proj.team) {
        const userId = member.userId;
        if (!allocationMap.has(userId)) allocationMap.set(userId, []);
        allocationMap.get(userId).push({
          projectId: proj._id,
          projectName: proj.projectName,
          allocationPercentage: member.allocationPercentage || 100,
          role: member.role || member.projectRole || 'member',
        });
      }
    }
    return allocationMap;
  }

  private async fetchSalaries(orgId: string, token?: string): Promise<Map<string, SalaryData>> {
    const url = `${this.payrollServiceUrl}/api/v1/salary-structures?status=active&limit=10000&organizationId=${orgId}`;
    const result = await this.fetchJSON(url, token);
    const salaryMap = new Map<string, SalaryData>();

    const structures = Array.isArray(result) ? result : result?.data || [];
    for (const s of structures) {
      salaryMap.set(s.employeeId, {
        employeeId: s.employeeId,
        ctc: s.ctc || 0,
        grossSalary: s.grossSalary || 0,
        netSalary: s.netSalary || 0,
      });
    }
    return salaryMap;
  }

  // ── Core Bench Computation ──

  private async getOrCreateConfig(orgId: string): Promise<IBenchConfig> {
    let config = await this.configModel.findOne({ organizationId: orgId, isDeleted: false });
    if (!config) {
      config = await this.configModel.create({ organizationId: orgId });
    }
    return config;
  }

  private computeBenchData(
    employees: EmployeeData[],
    allocationMap: Map<string, ProjectAllocation[]>,
    salaryMap: Map<string, SalaryData>,
    departments: DepartmentData[],
    config: IBenchConfig,
  ) {
    const deptNameMap = new Map<string, string>();
    for (const d of departments) deptNameMap.set(d._id, d.name);

    const workingDaysPerYear = config.workingDaysPerMonth * 12;
    const benchEmployees: any[] = [];
    let allocatedCount = 0;
    let partiallyAllocatedCount = 0;

    const deptBreakdown = new Map<string, { benchCount: number; allocatedCount: number; benchCost: number }>();
    const skillCount = new Map<string, { benchCount: number; allocatedCount: number }>();

    for (const emp of employees) {
      const allocations = allocationMap.get(emp.userId) || [];
      const totalAllocation = allocations.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
      const isOnBench = totalAllocation <= config.benchThresholdPercentage;
      const isPartial = !isOnBench && totalAllocation < 100;

      // Salary
      const salary = salaryMap.get(emp.employeeId) || salaryMap.get(emp.userId);
      let annualCost = 0;
      if (salary) {
        if (config.costCalculationMethod === 'gross') annualCost = salary.grossSalary;
        else if (config.costCalculationMethod === 'net') annualCost = salary.netSalary;
        else annualCost = salary.ctc;
      }
      const dailyCost = workingDaysPerYear > 0 ? Math.round(annualCost / workingDaysPerYear) : 0;

      // Bench portion cost
      const benchPortion = isOnBench ? 1 : isPartial ? (100 - totalAllocation) / 100 : 0;
      const dailyBenchCost = Math.round(dailyCost * benchPortion);

      // Bench duration (days since joining if never allocated, else approximate)
      const joiningDate = emp.joiningDate ? new Date(emp.joiningDate) : new Date();
      const benchSinceDays = isOnBench
        ? Math.max(0, Math.floor((Date.now() - joiningDate.getTime()) / (1000 * 60 * 60 * 24)))
        : 0;

      // Department breakdown
      const deptId = emp.departmentId || 'unassigned';
      if (!deptBreakdown.has(deptId)) {
        deptBreakdown.set(deptId, { benchCount: 0, allocatedCount: 0, benchCost: 0 });
      }
      const dept = deptBreakdown.get(deptId);

      // Skill breakdown
      for (const skill of emp.skills || []) {
        const lowerSkill = skill.toLowerCase();
        if (!skillCount.has(lowerSkill)) skillCount.set(lowerSkill, { benchCount: 0, allocatedCount: 0 });
        const sc = skillCount.get(lowerSkill);
        if (isOnBench) sc.benchCount++;
        else sc.allocatedCount++;
      }

      if (isOnBench) {
        dept.benchCount++;
        dept.benchCost += dailyBenchCost;
        benchEmployees.push({
          userId: emp.userId,
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          departmentId: emp.departmentId,
          departmentName: deptNameMap.get(emp.departmentId) || 'Unassigned',
          skills: emp.skills || [],
          benchSinceDays,
          dailyCost: dailyBenchCost,
          allocationPercentage: totalAllocation,
        });
      } else if (isPartial) {
        partiallyAllocatedCount++;
        dept.allocatedCount++;
        // Include partial bench employees too for visibility
        benchEmployees.push({
          userId: emp.userId,
          employeeId: emp.employeeId,
          name: `${emp.firstName} ${emp.lastName}`,
          departmentId: emp.departmentId,
          departmentName: deptNameMap.get(emp.departmentId) || 'Unassigned',
          skills: emp.skills || [],
          benchSinceDays: 0,
          dailyCost: dailyBenchCost,
          allocationPercentage: totalAllocation,
        });
      } else {
        allocatedCount++;
        dept.allocatedCount++;
      }
    }

    // Sort bench employees: fully on bench first (by bench days desc), then partial
    benchEmployees.sort((a, b) => {
      if (a.allocationPercentage === 0 && b.allocationPercentage > 0) return -1;
      if (a.allocationPercentage > 0 && b.allocationPercentage === 0) return 1;
      return b.benchSinceDays - a.benchSinceDays;
    });

    const benchCount = benchEmployees.filter(e => e.allocationPercentage <= config.benchThresholdPercentage).length;
    const totalDailyBenchCost = benchEmployees.reduce((sum, e) => sum + e.dailyCost, 0);
    const totalMonthlyBenchCost = totalDailyBenchCost * config.workingDaysPerMonth;
    const benchPercentage = employees.length > 0 ? Math.round((benchCount / employees.length) * 100) : 0;

    const departmentBreakdown = Array.from(deptBreakdown.entries()).map(([deptId, data]) => ({
      departmentId: deptId,
      departmentName: deptNameMap.get(deptId) || 'Unassigned',
      ...data,
    }));

    const skillBreakdown = Array.from(skillCount.entries())
      .map(([skill, data]) => ({ skill, ...data }))
      .sort((a, b) => b.benchCount - a.benchCount)
      .slice(0, 20);

    return {
      totalEmployees: employees.length,
      benchCount,
      allocatedCount,
      partiallyAllocatedCount,
      benchCostDaily: totalDailyBenchCost,
      benchCostMonthly: totalMonthlyBenchCost,
      benchPercentage,
      departmentBreakdown,
      skillBreakdown,
      benchEmployees,
    };
  }

  // ── Public Methods ──

  async getBenchOverview(orgId: string, token?: string) {
    const [employees, allocationMap, salaryMap, departments, config] = await Promise.all([
      this.fetchEmployees(orgId, token),
      this.fetchProjectAllocations(orgId, token),
      this.fetchSalaries(orgId, token),
      this.fetchDepartments(orgId, token),
      this.getOrCreateConfig(orgId),
    ]);

    return this.computeBenchData(employees, allocationMap, salaryMap, departments, config);
  }

  async getBenchEmployees(orgId: string, query: any, token?: string) {
    const overview = await this.getBenchOverview(orgId, token);
    let filtered = overview.benchEmployees;

    if (query.search) {
      const s = query.search.toLowerCase();
      filtered = filtered.filter(e => e.name.toLowerCase().includes(s) || e.employeeId.toLowerCase().includes(s));
    }
    if (query.departmentId) {
      filtered = filtered.filter(e => e.departmentId === query.departmentId);
    }
    if (query.skill) {
      const skill = query.skill.toLowerCase();
      filtered = filtered.filter(e => e.skills.some(sk => sk.toLowerCase().includes(skill)));
    }
    if (query.sortBy === 'cost') {
      filtered.sort((a, b) => b.dailyCost - a.dailyCost);
    } else if (query.sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const total = filtered.length;
    const data = filtered.slice((page - 1) * limit, page * limit);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getEmployeeAllocationStatus(orgId: string, userId: string, token?: string) {
    const [employees, allocationMap, salaryMap, config] = await Promise.all([
      this.fetchEmployees(orgId, token),
      this.fetchProjectAllocations(orgId, token),
      this.fetchSalaries(orgId, token),
      this.getOrCreateConfig(orgId),
    ]);

    const emp = employees.find(e => e.userId === userId);
    if (!emp) throw new NotFoundException('Employee not found');

    const allocations = allocationMap.get(userId) || [];
    const totalAllocation = allocations.reduce((sum, a) => sum + (a.allocationPercentage || 0), 0);
    const isOnBench = totalAllocation <= config.benchThresholdPercentage;

    const salary = salaryMap.get(emp.employeeId) || salaryMap.get(emp.userId);
    const workingDaysPerYear = config.workingDaysPerMonth * 12;
    let annualCost = salary?.ctc || 0;
    if (config.costCalculationMethod === 'gross') annualCost = salary?.grossSalary || 0;
    else if (config.costCalculationMethod === 'net') annualCost = salary?.netSalary || 0;
    const dailyCost = workingDaysPerYear > 0 ? Math.round(annualCost / workingDaysPerYear) : 0;

    return {
      userId: emp.userId,
      employeeId: emp.employeeId,
      name: `${emp.firstName} ${emp.lastName}`,
      skills: emp.skills,
      totalAllocationPercentage: totalAllocation,
      isOnBench,
      isPartiallyAllocated: !isOnBench && totalAllocation < 100,
      dailyCost,
      allocations,
    };
  }

  async getSkillAvailability(orgId: string, skills: string[], token?: string) {
    const overview = await this.getBenchOverview(orgId, token);
    const benchEmployees = overview.benchEmployees;

    return skills.map(skill => {
      const lowerSkill = skill.toLowerCase();
      const matching = benchEmployees.filter(e =>
        e.skills.some(s => s.toLowerCase().includes(lowerSkill)),
      );
      return {
        skill,
        availableCount: matching.length,
        employees: matching.map(e => ({
          userId: e.userId,
          employeeId: e.employeeId,
          name: e.name,
          allocationPercentage: e.allocationPercentage,
          dailyCost: e.dailyCost,
        })),
      };
    });
  }

  // ── Resource Requests ──

  async createResourceRequest(orgId: string, dto: any, userId: string, token?: string) {
    const lastReq = await this.requestModel
      .findOne({ organizationId: orgId })
      .sort({ createdAt: -1 })
      .select('requestId')
      .lean();

    let nextNum = 1;
    if (lastReq?.requestId) {
      const parsed = parseInt(lastReq.requestId.replace('RR-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const requestId = `RR-${String(nextNum).padStart(3, '0')}`;

    const request = await this.requestModel.create({
      organizationId: orgId,
      requestId,
      projectId: dto.projectId,
      projectName: dto.projectName || '',
      requestedBy: userId,
      title: dto.title,
      requiredSkills: dto.requiredSkills || [],
      preferredSkills: dto.preferredSkills || [],
      minExperienceYears: dto.minExperienceYears || 0,
      allocationPercentage: dto.allocationPercentage || 100,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      priority: dto.priority || 'medium',
      notes: dto.notes || '',
      createdBy: userId,
    });

    // Auto-run matching
    await this.runMatching(orgId, request._id.toString(), token);
    return this.requestModel.findById(request._id).lean();
  }

  async getResourceRequests(orgId: string, query: any) {
    const filter: any = { organizationId: orgId, isDeleted: false };
    if (query.status) filter.status = query.status;
    if (query.projectId) filter.projectId = query.projectId;

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));

    const [data, total] = await Promise.all([
      this.requestModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.requestModel.countDocuments(filter),
    ]);

    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getResourceRequest(orgId: string, id: string) {
    const request = await this.requestModel.findOne({ _id: id, organizationId: orgId, isDeleted: false }).lean();
    if (!request) throw new NotFoundException('Resource request not found');
    return request;
  }

  async updateResourceRequest(orgId: string, id: string, dto: any, userId: string) {
    const request = await this.requestModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { ...dto, updatedBy: userId },
      { new: true },
    ).lean();
    if (!request) throw new NotFoundException('Resource request not found');
    return request;
  }

  async deleteResourceRequest(orgId: string, id: string, userId: string) {
    const request = await this.requestModel.findOneAndUpdate(
      { _id: id, organizationId: orgId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!request) throw new NotFoundException('Resource request not found');
    return { message: 'Resource request deleted' };
  }

  async runMatching(orgId: string, requestId: string, token?: string) {
    const request = await this.requestModel.findOne({ _id: requestId, organizationId: orgId, isDeleted: false });
    if (!request) throw new NotFoundException('Resource request not found');

    const overview = await this.getBenchOverview(orgId, token);
    const benchEmployees = overview.benchEmployees;

    const matches = benchEmployees.map(emp => {
      let score = 0;
      const empSkillsLower = (emp.skills || []).map(s => s.toLowerCase());

      // Required skills: +20 per match
      for (const skill of request.requiredSkills) {
        if (empSkillsLower.some(s => s.includes(skill.toLowerCase()))) score += 20;
      }

      // Preferred skills: +10 per match
      for (const skill of request.preferredSkills || []) {
        if (empSkillsLower.some(s => s.includes(skill.toLowerCase()))) score += 10;
      }

      // Fully on bench bonus
      if (emp.allocationPercentage === 0) score += 15;

      // Long bench duration bonus
      if (emp.benchSinceDays > 30) score += 5;

      return {
        userId: emp.userId,
        employeeId: emp.employeeId,
        name: emp.name,
        matchScore: score,
        skills: emp.skills,
        status: 'suggested' as const,
      };
    });

    // Filter out zero-score matches and sort by score
    const topMatches = matches
      .filter(m => m.matchScore > 0)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    request.matchedEmployees = topMatches;
    if (topMatches.length > 0) request.status = 'matched';
    await request.save();

    return request.toObject();
  }

  async updateMatchStatus(orgId: string, requestId: string, userId: string, dto: any, updatedBy: string) {
    const request = await this.requestModel.findOne({ _id: requestId, organizationId: orgId, isDeleted: false });
    if (!request) throw new NotFoundException('Resource request not found');

    const match = request.matchedEmployees.find(m => m.userId === userId);
    if (!match) throw new NotFoundException('Matched employee not found');

    match.status = dto.status;
    request.updatedBy = updatedBy;

    // Update request status based on approved matches
    const approvedCount = request.matchedEmployees.filter(m => m.status === 'approved').length;
    if (approvedCount > 0) request.status = 'partially_filled';

    await request.save();
    return request.toObject();
  }

  // ── Snapshots ──

  async takeSnapshot(orgId: string, token?: string) {
    const overview = await this.getBenchOverview(orgId, token);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const snapshot = await this.snapshotModel.findOneAndUpdate(
      { organizationId: orgId, snapshotDate: today },
      {
        organizationId: orgId,
        snapshotDate: today,
        ...overview,
      },
      { upsert: true, new: true },
    );

    return snapshot.toObject();
  }

  async getBenchTrends(orgId: string, query: any) {
    const fromDate = query.fromDate ? new Date(query.fromDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = query.toDate ? new Date(query.toDate) : new Date();

    const snapshots = await this.snapshotModel
      .find({
        organizationId: orgId,
        snapshotDate: { $gte: fromDate, $lte: toDate },
        isDeleted: false,
      })
      .sort({ snapshotDate: 1 })
      .select('snapshotDate benchCount allocatedCount partiallyAllocatedCount benchCostDaily benchCostMonthly benchPercentage totalEmployees')
      .lean();

    return snapshots;
  }

  async getBenchAnalytics(orgId: string, token?: string) {
    const overview = await this.getBenchOverview(orgId, token);
    const trends = await this.getBenchTrends(orgId, {});

    const avgBenchDays = overview.benchEmployees.length > 0
      ? Math.round(overview.benchEmployees.reduce((sum, e) => sum + e.benchSinceDays, 0) / overview.benchEmployees.length)
      : 0;

    // Most common skills on bench
    const skillFreq = new Map<string, number>();
    for (const emp of overview.benchEmployees) {
      for (const skill of emp.skills) {
        skillFreq.set(skill, (skillFreq.get(skill) || 0) + 1);
      }
    }
    const topBenchSkills = Array.from(skillFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([skill, count]) => ({ skill, count }));

    // Department with highest bench %
    const deptBenchPercentages = overview.departmentBreakdown.map(d => ({
      ...d,
      benchPercentage: (d.benchCount + d.allocatedCount) > 0
        ? Math.round((d.benchCount / (d.benchCount + d.allocatedCount)) * 100)
        : 0,
    }));

    return {
      current: {
        benchCount: overview.benchCount,
        allocatedCount: overview.allocatedCount,
        benchPercentage: overview.benchPercentage,
        benchCostDaily: overview.benchCostDaily,
        benchCostMonthly: overview.benchCostMonthly,
      },
      averageBenchDays: avgBenchDays,
      topBenchSkills,
      departmentBenchPercentages: deptBenchPercentages,
      trendDataPoints: trends.length,
    };
  }

  // ── Config ──

  async getBenchConfig(orgId: string) {
    return this.getOrCreateConfig(orgId);
  }

  async updateBenchConfig(orgId: string, dto: any) {
    const config = await this.getOrCreateConfig(orgId);
    Object.assign(config, dto);
    await config.save();
    return config.toObject();
  }

  // ── Cron: Daily Snapshot ──

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailySnapshot() {
    this.logger.log('Running daily bench snapshot cron...');
    const configs = await this.configModel.find({ autoSnapshotEnabled: true, isDeleted: false }).lean();
    for (const config of configs) {
      try {
        await this.takeSnapshot(config.organizationId);
        this.logger.log(`Snapshot taken for org ${config.organizationId}`);
      } catch (err) {
        this.logger.error(`Snapshot failed for org ${config.organizationId}: ${err.message}`);
      }
    }
  }
}
