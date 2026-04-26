import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IEmployee } from './schemas/employee.schema';
import { IDepartment } from './schemas/department.schema';
import { IDesignation } from './schemas/designation.schema';
import { ITeam } from './schemas/team.schema';
import { IClient } from './schemas/client.schema';
import { IInvoice } from './schemas/invoice.schema';
import { IInvoiceTemplate } from './schemas/invoice-template.schema';
import { ICallLog } from './schemas/call-log.schema';
import { IBillingRate } from './schemas/billing-rate.schema';
import { IEmployeeStatus, DEFAULT_EMPLOYEE_STATUSES } from './schemas/employee-status.schema';
import {
  CreateEmployeeDto, UpdateEmployeeDto, EmployeeQueryDto,
  CreateDepartmentDto, UpdateDepartmentDto,
  CreateDesignationDto, UpdateDesignationDto,
  CreateTeamDto, UpdateTeamDto,
  CreateClientDto, UpdateClientDto, ClientQueryDto,
  ClientContactPersonDto, LinkProjectDto,
  CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto, InvoiceQueryDto, SendInvoiceDto, MarkPaidDto,
  CreateInvoiceTemplateDto,
  CreateBillingRateDto, UpdateBillingRateDto, BillingRateQueryDto,
  PreviewInvoiceDto, GenerateInvoiceDto,
  CreateCallLogDto, UpdateCallLogDto, CallLogQueryDto,
  CreateEmployeeStatusDto, UpdateEmployeeStatusDto,
} from './dto/index';

@Injectable()
export class HrService {
  private readonly logger = new Logger(HrService.name);

  constructor(
    @InjectModel('Employee') private employeeModel: Model<IEmployee>,
    @InjectModel('Department') private departmentModel: Model<IDepartment>,
    @InjectModel('Designation') private designationModel: Model<IDesignation>,
    @InjectModel('Team') private teamModel: Model<ITeam>,
    @InjectModel('Client') private clientModel: Model<IClient>,
    @InjectModel('Invoice') private invoiceModel: Model<IInvoice>,
    @InjectModel('InvoiceTemplate') private invoiceTemplateModel: Model<IInvoiceTemplate>,
    @InjectModel('CallLog') private callLogModel: Model<ICallLog>,
    @InjectModel('BillingRate') private billingRateModel: Model<IBillingRate>,
    @InjectModel('EmployeeStatus') private employeeStatusModel: Model<IEmployeeStatus>,
  ) {}

  // ── Employee Statuses ──

  /**
   * Lazy-seed defaults for an org the first time statuses are listed.
   * Using updateOne upsert so concurrent requests don't create duplicates.
   */
  private async ensureDefaultEmployeeStatuses(orgId: string): Promise<void> {
    if (!orgId) return;
    const existing = await this.employeeStatusModel.countDocuments({ organizationId: orgId });
    if (existing > 0) return;
    const docs = DEFAULT_EMPLOYEE_STATUSES.map((s) => ({
      ...s,
      organizationId: orgId,
      isSystem: true,
      isActive: true,
      isDeleted: false,
    }));
    try {
      await this.employeeStatusModel.insertMany(docs, { ordered: false });
      this.logger.log(`Seeded ${docs.length} default employee statuses for org ${orgId}`);
    } catch (err: any) {
      // Ignore duplicate-key errors — another request may have seeded concurrently.
      if (err?.code !== 11000) throw err;
    }
  }

  async getEmployeeStatuses(orgId?: string) {
    if (orgId) await this.ensureDefaultEmployeeStatuses(orgId);
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.employeeStatusModel.find(filter).sort({ order: 1, label: 1 });
  }

  /**
   * Verifies that `status` exists in the org's catalog before writing it to an
   * employee. Seeds defaults on first call so brand-new orgs don't get a false
   * validation error. Returns silently if status is empty/undefined.
   */
  private async assertEmployeeStatusValid(status: string | undefined, orgId?: string): Promise<void> {
    if (!status || !orgId) return;
    await this.ensureDefaultEmployeeStatuses(orgId);
    const exists = await this.employeeStatusModel.exists({
      organizationId: orgId,
      value: status,
      isDeleted: false,
      isActive: true,
    });
    if (!exists) {
      throw new BadRequestException(
        `Invalid status "${status}". Use one defined in the organization's status catalog.`,
      );
    }
  }

  async createEmployeeStatus(dto: CreateEmployeeStatusDto, orgId: string, userId?: string) {
    if (!orgId) throw new BadRequestException('organizationId is required');
    const value = dto.value.toLowerCase().trim();
    const existing = await this.employeeStatusModel.findOne({
      organizationId: orgId,
      value,
      isDeleted: false,
    });
    if (existing) throw new ConflictException(`Status "${value}" already exists`);
    const doc = new this.employeeStatusModel({
      ...dto,
      value,
      organizationId: orgId,
      isSystem: false,
      createdBy: userId || null,
    });
    await doc.save();
    return doc;
  }

  async updateEmployeeStatus(id: string, dto: UpdateEmployeeStatusDto, orgId: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const doc = await this.employeeStatusModel.findOneAndUpdate(filter, dto, { new: true });
    if (!doc) throw new NotFoundException('Status not found');
    return doc;
  }

  async deleteEmployeeStatus(id: string, orgId: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const doc = await this.employeeStatusModel.findOne(filter);
    if (!doc) throw new NotFoundException('Status not found');
    if (doc.isSystem) throw new BadRequestException('System statuses cannot be deleted');
    // Refuse delete if any employee still uses this status.
    const inUse = await this.employeeModel.countDocuments({
      organizationId: orgId,
      status: doc.value,
      isDeleted: false,
    });
    if (inUse > 0) {
      throw new ConflictException(`Cannot delete: ${inUse} employee(s) still have this status`);
    }
    doc.isDeleted = true;
    doc.isActive = false;
    await doc.save();
    return { message: 'Status deleted successfully' };
  }

  // ── Employees ──

  async createEmployee(dto: CreateEmployeeDto, createdBy: string, authToken?: string, orgId?: string) {
    const existing = await this.employeeModel.findOne({ email: dto.email, isDeleted: false, organizationId: orgId });
    if (existing) throw new ConflictException('Employee with this email already exists');

    await this.assertEmployeeStatusValid(dto.status, orgId);

    // Find the highest existing NXR-XXXX number GLOBALLY (unique index is global, not per-org)
    // This includes deleted employees since they still hold the unique index
    const lastEmp = await this.employeeModel
      .findOne({ employeeId: { $regex: /^NXR-\d+$/ } })
      .sort({ employeeId: -1 })
      .select('employeeId')
      .lean();
    let nextNum = 1;
    if (lastEmp?.employeeId) {
      const parsed = parseInt(lastEmp.employeeId.replace('NXR-', ''), 10);
      if (!isNaN(parsed)) nextNum = parsed + 1;
    }
    const employeeId = `NXR-${String(nextNum).padStart(4, '0')}`;

    // Provision auth user account and send invitation via the auth service.
    // The auth service creates the user, org membership (as pending/invited), and returns an invite token.
    let inviteToken: string | null = null;
    let authUserId: string | null = null;
    try {
      const axios = require('axios');
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = authToken;

      if (orgId) {
        const inviteRes = await axios.post(
          `${authUrl}/api/v1/auth/organizations/${orgId}/invite`,
          { email: dto.email, firstName: dto.firstName, lastName: dto.lastName, role: (dto as any).role || 'employee' },
          { headers, timeout: 8000 },
        ).catch((inviteErr: any) => {
          if (inviteErr?.response?.status !== 409) throw inviteErr;
          this.logger.log(`User ${dto.email} already a member of org ${orgId}`);
          return inviteErr?.response;
        });
        // Extract invite token and userId from auth response
        const resData = inviteRes?.data?.data || inviteRes?.data || {};
        inviteToken = resData.inviteToken || resData.token || null;
        authUserId = resData.userId || null;
        this.logger.log(`Auth invitation sent for ${dto.email} (token: ${inviteToken ? 'yes' : 'no'})`);
      }
    } catch (err) {
      this.logger.warn(`Failed to provision auth account for ${dto.email}: ${err.message || err}`);
    }

    // Use auth userId if available, otherwise auto-generate
    if (!dto.userId) {
      dto.userId = authUserId || `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // New employees start as 'invited' — they become 'active' when they accept the invitation
    const employee = new this.employeeModel({ ...dto, employeeId, createdBy, organizationId: orgId, status: dto.status || 'invited' });
    try {
      await employee.save();
    } catch (err: any) {
      if (err.code === 11000) {
        const field = Object.keys(err.keyPattern || {})[0] || 'field';
        throw new ConflictException(`Employee with this ${field} already exists`);
      }
      throw err;
    }
    this.logger.log(`Employee created: ${employee.employeeId} - ${dto.email}`);

    // Send invitation email via SMTP (MailHog in dev)
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mailhog',
        port: parseInt(process.env.SMTP_PORT || '1025'),
        secure: false,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3100';
      const inviteUrl = inviteToken
        ? `${frontendUrl}/auth/accept-invite?token=${inviteToken}`
        : `${frontendUrl}/invite?email=${encodeURIComponent(dto.email)}&org=${encodeURIComponent(orgId || '')}`;

      await transporter.sendMail({
        from: '"Nexora" <no-reply@nexora.io>',
        to: dto.email,
        subject: 'You have been invited to join Nexora',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="background: #2E86C1; color: white; width: 48px; height: 48px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">N</div>
              <h2 style="color: #0F172A; margin-top: 10px;">Welcome to Nexora</h2>
            </div>
            <p style="color: #334155; font-size: 16px;">Hi ${dto.firstName},</p>
            <p style="color: #64748B; font-size: 14px; line-height: 1.6;">
              You've been invited to join as a team member. Click the button below to create your account and get started.
            </p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${inviteUrl}" style="background: #2E86C1; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                Accept & Join
              </a>
            </div>
            <p style="color: #64748B; font-size: 13px; text-align: center;">
              Or copy this link: <br/>
              <span style="color: #2E86C1; word-break: break-all;">${inviteUrl}</span>
            </p>
            <p style="color: #94A3B8; font-size: 12px; text-align: center; margin-top: 20px;">
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `,
      });
      this.logger.log(`Invitation email sent to ${dto.email}`);
    } catch (emailErr) {
      this.logger.warn(`Failed to send invitation email to ${dto.email}: ${emailErr.message || emailErr}`);
    }

    return employee;
  }

  async getEmployees(query: EmployeeQueryDto, orgId?: string) {
    // Tenant-isolation guarantee: refuse to list across all orgs. If orgId is missing
    // the only safe behaviour is to reject rather than silently drop the scope filter.
    if (!orgId) {
      throw new ForbiddenException('Organization context required to list employees');
    }
    const { search, departmentId, designationId, employmentType, status, location, page = 1, limit = 20, sort = '-createdAt' } = query;

    const filter: any = { isDeleted: false };
    filter.organizationId = orgId;
    if (departmentId) filter.departmentId = departmentId;
    if (designationId) filter.designationId = designationId;
    if (employmentType) filter.employmentType = employmentType;
    if (status) filter.status = status;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeId: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

    const [data, total] = await Promise.all([
      this.employeeModel.find(filter).sort(sortObj as any).skip(skip).limit(limit),
      this.employeeModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getEmployeeById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const employee = await this.employeeModel.findOne(filter);
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async getEmployeeByUserId(userId: string, orgId?: string) {
    const filter: any = { userId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const employee = await this.employeeModel.findOne(filter);
    if (!employee) throw new NotFoundException('Employee not found');
    return employee;
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto, updatedBy: string, orgId?: string) {
    await this.assertEmployeeStatusValid(dto.status, orgId);
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const employee = await this.employeeModel.findOneAndUpdate(
      filter,
      { ...dto, updatedBy },
      { new: true },
    );
    if (!employee) throw new NotFoundException('Employee not found');
    this.logger.log(`Employee updated: ${employee.employeeId}`);
    return employee;
  }

  async deleteEmployee(id: string, deletedBy: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const employee = await this.employeeModel.findOneAndUpdate(
      filter,
      { isDeleted: true, isActive: false, deletedAt: new Date(), updatedBy: deletedBy },
      { new: true },
    );
    if (!employee) throw new NotFoundException('Employee not found');
    this.logger.log(`Employee soft-deleted: ${employee.employeeId}`);
    return { message: 'Employee deleted successfully' };
  }

  async getOrgChart(departmentId?: string, orgId?: string) {
    const filter: any = { isDeleted: false, isActive: true };
    if (orgId) filter.organizationId = orgId;
    if (departmentId) filter.departmentId = departmentId;

    const employees = await this.employeeModel.find(filter).select('_id firstName lastName email avatar departmentId designationId reportingManagerId employeeId').lean();

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    employees.forEach(emp => map.set(emp._id.toString(), { ...emp, children: [] }));
    employees.forEach(emp => {
      const node = map.get(emp._id.toString());
      if (emp.reportingManagerId && map.has(emp.reportingManagerId)) {
        map.get(emp.reportingManagerId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  async getStats(orgId?: string) {
    const baseFilter: any = { isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;
    const deptFilter: any = { isDeleted: false, isActive: true };
    if (orgId) deptFilter.organizationId = orgId;

    const [total, active, onNotice, departments, recentJoiners] = await Promise.all([
      this.employeeModel.countDocuments(baseFilter),
      this.employeeModel.countDocuments({ ...baseFilter, status: 'active' }),
      this.employeeModel.countDocuments({ ...baseFilter, status: 'on_notice' }),
      this.departmentModel.countDocuments(deptFilter),
      this.employeeModel.find(baseFilter)
        .sort({ joiningDate: -1 })
        .limit(5)
        .select('firstName lastName email joiningDate departmentId'),
    ]);

    return { total, active, onNotice, departments, recentJoiners };
  }

  // ── Employee Policies ──

  async attachPolicy(employeeId: string, policyId: string, orgId?: string) {
    const filter: any = { _id: employeeId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const emp = await this.employeeModel.findOneAndUpdate(
      filter,
      { $addToSet: { policyIds: policyId } },
      { new: true },
    );
    if (!emp) throw new NotFoundException('Employee not found');
    this.logger.log(`Policy ${policyId} attached to employee ${emp.employeeId}`);
    return emp;
  }

  async detachPolicy(employeeId: string, policyId: string, orgId?: string) {
    const filter: any = { _id: employeeId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const emp = await this.employeeModel.findOneAndUpdate(
      filter,
      { $pull: { policyIds: policyId } },
      { new: true },
    );
    if (!emp) throw new NotFoundException('Employee not found');
    this.logger.log(`Policy ${policyId} detached from employee ${emp.employeeId}`);
    return emp;
  }

  async getEmployeePolicies(employeeId: string, orgId?: string) {
    const filter: any = { _id: employeeId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const emp = await this.employeeModel.findOne(filter);
    if (!emp) throw new NotFoundException('Employee not found');
    return emp.policyIds || [];
  }

  // ── Departments ──

  async createDepartment(dto: CreateDepartmentDto, createdBy: string, orgId?: string) {
    const filter: any = { code: dto.code.toUpperCase(), isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const existing = await this.departmentModel.findOne(filter);
    if (existing) throw new ConflictException('Department with this code already exists');

    const dept = new this.departmentModel({ ...dto, code: dto.code.toUpperCase(), createdBy, organizationId: orgId });
    await dept.save();
    this.logger.log(`Department created: ${dept.code}`);
    return dept;
  }

  async getDepartments(orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.departmentModel.find(filter).sort({ name: 1 });
  }

  async getDepartmentById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const dept = await this.departmentModel.findOne(filter);
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async updateDepartment(id: string, dto: UpdateDepartmentDto, updatedBy: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const dept = await this.departmentModel.findOneAndUpdate(
      filter,
      { ...dto, updatedBy },
      { new: true },
    );
    if (!dept) throw new NotFoundException('Department not found');
    return dept;
  }

  async deleteDepartment(id: string, orgId?: string) {
    const empFilter: any = { departmentId: id, isDeleted: false };
    if (orgId) empFilter.organizationId = orgId;
    const employees = await this.employeeModel.countDocuments(empFilter);
    if (employees > 0) throw new ConflictException(`Cannot delete department with ${employees} active employees`);

    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const dept = await this.departmentModel.findOneAndUpdate(
      filter,
      { isDeleted: true, isActive: false },
      { new: true },
    );
    if (!dept) throw new NotFoundException('Department not found');
    return { message: 'Department deleted successfully' };
  }

  // ── Designations ──

  async createDesignation(dto: CreateDesignationDto, orgId?: string) {
    const designation = new this.designationModel({ ...dto, organizationId: orgId });
    await designation.save();
    this.logger.log(`Designation created: ${designation.title}`);
    return designation;
  }

  async getDesignations(orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    return this.designationModel.find(filter).sort({ level: 1, title: 1 });
  }

  async updateDesignation(id: string, dto: UpdateDesignationDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const designation = await this.designationModel.findOneAndUpdate(filter, dto, { new: true });
    if (!designation) throw new NotFoundException('Designation not found');
    return designation;
  }

  async deleteDesignation(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const designation = await this.designationModel.findOneAndUpdate(filter, { isDeleted: true, isActive: false }, { new: true });
    if (!designation) throw new NotFoundException('Designation not found');
    return { message: 'Designation deleted successfully' };
  }

  // ── Teams ──

  async createTeam(dto: CreateTeamDto, orgId?: string) {
    const team = new this.teamModel({ ...dto, organizationId: orgId });
    await team.save();
    this.logger.log(`Team created: ${team.name}`);
    return team;
  }

  async getTeams(departmentId?: string, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (departmentId) filter.departmentId = departmentId;
    return this.teamModel.find(filter).sort({ name: 1 });
  }

  async updateTeam(id: string, dto: UpdateTeamDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const team = await this.teamModel.findOneAndUpdate(filter, dto, { new: true });
    if (!team) throw new NotFoundException('Team not found');
    return team;
  }

  async deleteTeam(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const team = await this.teamModel.findOneAndUpdate(filter, { isDeleted: true, isActive: false }, { new: true });
    if (!team) throw new NotFoundException('Team not found');
    return { message: 'Team deleted successfully' };
  }

  // ── Clients ──

  async createClient(dto: CreateClientDto, createdBy: string, orgId?: string) {
    const uniqueFilter: any = { companyName: dto.companyName, isDeleted: false };
    if (orgId) uniqueFilter.organizationId = orgId;
    const existing = await this.clientModel.findOne(uniqueFilter);
    if (existing) throw new ConflictException('Client with this company name already exists');

    const client = new this.clientModel({ ...dto, createdBy, organizationId: orgId });
    await client.save();
    this.logger.log(`Client created: ${client.companyName}`);
    return client;
  }

  async getClients(query: ClientQueryDto, orgId?: string) {
    const { search, status, industry, showDeleted, page = 1, limit = 20, sort = '-createdAt' } = query;

    const filter: any = showDeleted ? { isDeleted: true } : { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (industry) filter.industry = industry;
    if (search) {
      filter.$or = [
        { companyName: { $regex: search, $options: 'i' } },
        { displayName: { $regex: search, $options: 'i' } },
        { 'contactPerson.name': { $regex: search, $options: 'i' } },
        { 'contactPerson.email': { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

    const [data, total] = await Promise.all([
      this.clientModel.find(filter).sort(sortObj as any).skip(skip).limit(limit),
      this.clientModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getClientById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const client = await this.clientModel.findOne(filter);
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  async updateClient(id: string, dto: UpdateClientDto, updatedBy: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const client = await this.clientModel.findOneAndUpdate(
      filter,
      { ...dto, updatedBy },
      { new: true },
    );
    if (!client) throw new NotFoundException('Client not found');
    this.logger.log(`Client updated: ${client.companyName}`);
    return client;
  }

  async deleteClient(id: string, deletedBy: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const client = await this.clientModel.findOneAndUpdate(
      filter,
      { isDeleted: true, deletedAt: new Date(), updatedBy: deletedBy },
      { new: true },
    );
    if (!client) throw new NotFoundException('Client not found');
    this.logger.log(`Client soft-deleted: ${client.companyName}`);
    return { message: 'Client deleted successfully' };
  }

  async getClientStats(orgId?: string) {
    const baseFilter: any = { isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;

    const [total, active, inactive, prospects] = await Promise.all([
      this.clientModel.countDocuments(baseFilter),
      this.clientModel.countDocuments({ ...baseFilter, status: 'active' }),
      this.clientModel.countDocuments({ ...baseFilter, status: 'inactive' }),
      this.clientModel.countDocuments({ ...baseFilter, status: 'prospect' }),
    ]);

    return { total, active, inactive, prospects };
  }

  async getClientDashboard(clientId: string, orgId?: string, authToken?: string) {
    const client = await this.getClientById(clientId, orgId);

    // Fetch linked projects from project-service via HTTP
    let projects = [];
    if (client.projectIds && client.projectIds.length > 0) {
      try {
        const axios = require('axios');
        const projectUrl = process.env.PROJECT_SERVICE_URL || 'http://project-service:3020';
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = authToken;

        const projectPromises = client.projectIds.map(pid =>
          axios.get(`${projectUrl}/api/v1/projects/${pid}`, { headers, timeout: 5000 })
            .then(res => res.data?.data)
            .catch(() => null)
        );
        const results = await Promise.all(projectPromises);
        projects = results.filter(Boolean);
      } catch (err) {
        this.logger.warn(`Failed to fetch projects for client ${clientId}: ${err.message || err}`);
      }
    }

    return {
      client,
      projects,
      invoiceSummary: {
        totalRevenue: client.totalRevenue || 0,
        outstandingAmount: client.outstandingAmount || 0,
        lastInvoiceDate: client.lastInvoiceDate || null,
        lastPaymentDate: client.lastPaymentDate || null,
      },
    };
  }

  async linkProjectToClient(clientId: string, projectId: string, orgId?: string) {
    const filter: any = { _id: clientId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const client = await this.clientModel.findOne(filter);
    if (!client) throw new NotFoundException('Client not found');

    const existing = client.projectIds || [];
    if (existing.includes(projectId)) {
      return client;
    }

    client.projectIds = [...existing, projectId];
    await client.save();
    this.logger.log(`Project ${projectId} linked to client ${client.companyName}`);
    return client;
  }

  async unlinkProjectFromClient(clientId: string, projectId: string, orgId?: string) {
    const filter: any = { _id: clientId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const client = await this.clientModel.findOne(filter);
    if (!client) throw new NotFoundException('Client not found');

    client.projectIds = (client.projectIds || []).filter(pid => pid !== projectId);
    await client.save();
    this.logger.log(`Project ${projectId} unlinked from client ${client.companyName}`);
    return client;
  }

  async getClientProjects(clientId: string, orgId?: string, authToken?: string) {
    const client = await this.getClientById(clientId, orgId);

    if (!client.projectIds || client.projectIds.length === 0) {
      return [];
    }

    try {
      const axios = require('axios');
      const projectUrl = process.env.PROJECT_SERVICE_URL || 'http://project-service:3020';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = authToken;

      const projectPromises = client.projectIds.map(pid =>
        axios.get(`${projectUrl}/api/v1/projects/${pid}`, { headers, timeout: 5000 })
          .then(res => res.data?.data)
          .catch(() => null)
      );
      const results = await Promise.all(projectPromises);
      return results.filter(Boolean);
    } catch (err) {
      this.logger.warn(`Failed to fetch projects for client ${clientId}: ${err.message || err}`);
      return [];
    }
  }

  async addContactPerson(clientId: string, contact: ClientContactPersonDto, orgId?: string) {
    const filter: any = { _id: clientId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const client = await this.clientModel.findOne(filter);
    if (!client) throw new NotFoundException('Client not found');

    if (!client.contactPersons) {
      client.contactPersons = [];
    }

    // If this contact is primary, unset other primaries
    if (contact.isPrimary) {
      client.contactPersons.forEach(cp => { cp.isPrimary = false; });
    }

    client.contactPersons.push({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || undefined,
      designation: contact.designation || undefined,
      isPrimary: contact.isPrimary || false,
    } as any);

    await client.save();
    this.logger.log(`Contact person added to client ${client.companyName}`);
    return client;
  }

  async removeContactPerson(clientId: string, contactIndex: number, orgId?: string) {
    const filter: any = { _id: clientId, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const client = await this.clientModel.findOne(filter);
    if (!client) throw new NotFoundException('Client not found');

    if (!client.contactPersons || contactIndex < 0 || contactIndex >= client.contactPersons.length) {
      throw new NotFoundException('Contact person not found at the given index');
    }

    client.contactPersons.splice(contactIndex, 1);
    await client.save();
    this.logger.log(`Contact person removed from client ${client.companyName}`);
    return client;
  }

  // ── Call Logs ──

  async createCallLog(dto: CreateCallLogDto, userId: string, orgId?: string) {
    const callLog = new this.callLogModel({
      organizationId: orgId,
      callerId: userId,
      receiverId: dto.receiverId,
      callerName: dto.callerName || null,
      receiverName: dto.receiverName || null,
      type: dto.type || 'audio',
      status: 'initiated',
      startTime: new Date(),
      notes: dto.notes || null,
    });
    await callLog.save();
    this.logger.log(`Call log created: ${callLog._id} (${userId} -> ${dto.receiverId})`);
    return callLog;
  }

  async getCallLogs(query: CallLogQueryDto, orgId?: string) {
    const { userId, startDate, endDate, status, type, page = 1, limit = 20 } = query;

    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (userId) {
      filter.$or = [{ callerId: userId }, { receiverId: userId }];
    }
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      this.callLogModel.find(filter).sort({ startTime: -1 }).skip(skip).limit(Number(limit)).exec(),
      this.callLogModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getCallLogById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const callLog = await this.callLogModel.findOne(filter);
    if (!callLog) throw new NotFoundException('Call log not found');
    return callLog;
  }

  async updateCallLog(id: string, dto: UpdateCallLogDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const update: any = {};
    if (dto.status) update.status = dto.status;
    if (dto.endTime) update.endTime = new Date(dto.endTime);
    if (dto.duration !== undefined) update.duration = dto.duration;
    if (dto.notes !== undefined) update.notes = dto.notes;

    // Auto-calculate duration if ending and startTime exists
    if (dto.status === 'ended' && !dto.duration) {
      const existing = await this.callLogModel.findOne(filter);
      if (existing) {
        const end = dto.endTime ? new Date(dto.endTime) : new Date();
        update.endTime = end;
        update.duration = Math.round((end.getTime() - existing.startTime.getTime()) / 1000);
      }
    }

    const callLog = await this.callLogModel.findOneAndUpdate(filter, { $set: update }, { new: true });
    if (!callLog) throw new NotFoundException('Call log not found');
    this.logger.log(`Call log updated: ${id}`);
    return callLog;
  }

  async getCallStats(userId?: string, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    // Today's date range
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayFilter: any = { ...filter, startTime: { $gte: todayStart, $lte: todayEnd } };
    if (userId) {
      todayFilter.$or = [{ callerId: userId }, { receiverId: userId }];
    }

    const [totalToday, missedToday, allTodayCalls] = await Promise.all([
      this.callLogModel.countDocuments(todayFilter),
      this.callLogModel.countDocuments({ ...todayFilter, status: 'missed' }),
      this.callLogModel.find({ ...todayFilter, status: 'ended', duration: { $gt: 0 } }).select('duration').exec(),
    ]);

    const totalDuration = allTodayCalls.reduce((sum, c) => sum + (c.duration || 0), 0);
    const avgDuration = allTodayCalls.length > 0 ? Math.round(totalDuration / allTodayCalls.length) : 0;

    return {
      totalToday,
      missedToday,
      avgDuration,
      completedToday: allTodayCalls.length,
    };
  }

  async getRecentCalls(userId: string, orgId?: string) {
    const filter: any = {
      isDeleted: false,
      $or: [{ callerId: userId }, { receiverId: userId }],
    };
    if (orgId) filter.organizationId = orgId;

    return this.callLogModel.find(filter).sort({ startTime: -1 }).limit(20).exec();
  }

  // ── Invoices ──

  private calculateInvoiceTotals(items: any[], discount: number = 0, discountType: string = 'fixed') {
    let subtotal = 0;
    let taxTotal = 0;

    for (const item of items) {
      const amount = item.quantity * item.rate;
      const taxAmount = item.taxRate ? (amount * item.taxRate) / 100 : 0;
      item.amount = Math.round(amount * 100) / 100;
      item.taxAmount = Math.round(taxAmount * 100) / 100;
      subtotal += item.amount;
      taxTotal += item.taxAmount;
    }

    subtotal = Math.round(subtotal * 100) / 100;
    taxTotal = Math.round(taxTotal * 100) / 100;

    let discountAmount = 0;
    if (discountType === 'percentage') {
      discountAmount = Math.round(((subtotal + taxTotal) * discount) / 100 * 100) / 100;
    } else {
      discountAmount = Math.round(discount * 100) / 100;
    }

    const total = Math.round((subtotal + taxTotal - discountAmount) * 100) / 100;

    return { items, subtotal, taxTotal, discount: discountAmount, total };
  }

  private async generateInvoiceNumber(orgId?: string): Promise<string> {
    const year = new Date().getFullYear();
    const filter: any = { invoiceNumber: { $regex: `^INV-${year}-` } };
    if (orgId) filter.organizationId = orgId;

    const lastInvoice = await this.invoiceModel
      .findOne(filter)
      .sort({ createdAt: -1, invoiceNumber: -1 })
      .select('invoiceNumber')
      .lean();

    let seq = 1;
    if (lastInvoice) {
      const parts = lastInvoice.invoiceNumber.split('-');
      seq = parseInt(parts[2], 10) + 1;
    }

    // Ensure uniqueness by checking for existing invoice with this number
    const candidate = `INV-${year}-${String(seq).padStart(4, '0')}`;
    const exists = await this.invoiceModel.findOne({ organizationId: orgId, invoiceNumber: candidate }).lean();
    if (exists) {
      seq++;
    }

    return `INV-${year}-${String(seq).padStart(4, '0')}`;
  }

  async createInvoice(dto: CreateInvoiceDto, userId: string, orgId?: string) {
    const invoiceNumber = await this.generateInvoiceNumber(orgId);
    const { items, subtotal, taxTotal, discount, total } = this.calculateInvoiceTotals(
      dto.items, dto.discount || 0, dto.discountType || 'fixed',
    );

    const invoice = new this.invoiceModel({
      ...dto,
      invoiceNumber,
      items,
      subtotal,
      taxTotal,
      discount,
      discountType: dto.discountType || 'fixed',
      total,
      amountPaid: 0,
      balanceDue: total,
      emailCount: 0,
      isDeleted: false,
      createdBy: userId,
      organizationId: orgId,
    });

    await invoice.save();
    this.logger.log(`Invoice created: ${invoice.invoiceNumber}`);
    return invoice;
  }

  async getInvoices(query: InvoiceQueryDto, orgId?: string) {
    const { search, status, clientId, projectId, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = query;

    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (projectId) filter.projectId = projectId;
    if (startDate || endDate) {
      filter.issueDate = {};
      if (startDate) filter.issueDate.$gte = new Date(startDate);
      if (endDate) filter.issueDate.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const sortObj = sort.startsWith('-') ? { [sort.slice(1)]: -1 } : { [sort]: 1 };

    const [data, total] = await Promise.all([
      this.invoiceModel.find(filter).sort(sortObj as any).skip(skip).limit(limit),
      this.invoiceModel.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getInvoiceById(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const invoice = await this.invoiceModel.findOne(filter);
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateInvoice(id: string, dto: UpdateInvoiceDto, userId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const existing = await this.invoiceModel.findOne(filter);
    if (!existing) throw new NotFoundException('Invoice not found');
    if (!['draft', 'sent'].includes(existing.status)) {
      throw new ConflictException('Only draft or sent invoices can be edited');
    }

    const updateData: any = { ...dto, updatedBy: userId };

    if (dto.items) {
      const { items, subtotal, taxTotal, discount, total } = this.calculateInvoiceTotals(
        dto.items, dto.discount ?? existing.discount, dto.discountType ?? existing.discountType,
      );
      updateData.items = items;
      updateData.subtotal = subtotal;
      updateData.taxTotal = taxTotal;
      updateData.discount = discount;
      updateData.total = total;
      updateData.balanceDue = total - existing.amountPaid;
    }

    const invoice = await this.invoiceModel.findOneAndUpdate(filter, updateData, { new: true });
    this.logger.log(`Invoice updated: ${invoice.invoiceNumber}`);
    return invoice;
  }

  async deleteInvoice(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const existing = await this.invoiceModel.findOne(filter);
    if (!existing) throw new NotFoundException('Invoice not found');
    if (existing.status !== 'draft') {
      throw new ConflictException('Only draft invoices can be deleted');
    }

    existing.isDeleted = true;
    await existing.save();
    this.logger.log(`Invoice soft-deleted: ${existing.invoiceNumber}`);
    return { message: 'Invoice deleted successfully' };
  }

  async updateInvoiceStatus(id: string, dto: UpdateInvoiceStatusDto, userId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const invoice = await this.invoiceModel.findOne(filter);
    if (!invoice) throw new NotFoundException('Invoice not found');

    // If marking as paid, set amountPaid = total and balanceDue = 0
    const updateData: any = { status: dto.status, updatedBy: userId };
    if (dto.status === 'paid') {
      updateData.amountPaid = invoice.total;
      updateData.balanceDue = 0;
    }

    const updated = await this.invoiceModel.findOneAndUpdate(filter, updateData, { new: true });
    this.logger.log(`Invoice ${updated.invoiceNumber} status changed to ${dto.status}`);
    return updated;
  }

  async sendInvoice(id: string, dto: SendInvoiceDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const invoice = await this.invoiceModel.findOne(filter);
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Get client info for the email
    let clientName = 'Client';
    try {
      const client = await this.clientModel.findById(invoice.clientId);
      if (client) clientName = client.displayName || client.companyName;
    } catch {}

    const toEmail = dto.email;
    const subject = dto.subject || `Invoice ${invoice.invoiceNumber} from ${invoice.brandName || 'Nexora'}`;

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mailhog',
        port: parseInt(process.env.SMTP_PORT || '1025'),
        secure: false,
      });

      const currencySymbol = invoice.currency === 'USD' ? '$' : invoice.currency === 'EUR' ? '\u20AC' : '\u20B9';

      const itemsHtml = invoice.items.map((item, i) => `
        <tr style="border-bottom: 1px solid #E2E8F0;">
          <td style="padding: 12px 8px; color: #334155;">${i + 1}</td>
          <td style="padding: 12px 8px; color: #334155;">${item.description}</td>
          <td style="padding: 12px 8px; text-align: center; color: #334155;">${item.quantity}</td>
          <td style="padding: 12px 8px; text-align: right; color: #334155;">${currencySymbol}${item.rate.toFixed(2)}</td>
          <td style="padding: 12px 8px; text-align: right; color: #334155;">${currencySymbol}${item.amount.toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 20px; background: #FFFFFF;">
          <div style="text-align: center; margin-bottom: 30px; padding: 24px; background: #2E86C1; border-radius: 12px;">
            <div style="color: white; font-size: 28px; font-weight: bold;">${invoice.brandName || 'Nexora'}</div>
            ${invoice.brandAddress ? `<div style="color: #BEE3F8; font-size: 12px; margin-top: 4px;">${invoice.brandAddress}</div>` : ''}
          </div>

          <div style="background: #F8FAFC; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between;">
              <div>
                <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Invoice</div>
                <div style="color: #0F172A; font-size: 20px; font-weight: bold;">${invoice.invoiceNumber}</div>
              </div>
              <div style="text-align: right;">
                <div style="color: #64748B; font-size: 12px;">Issue Date: ${new Date(invoice.issueDate).toLocaleDateString()}</div>
                <div style="color: #64748B; font-size: 12px;">Due Date: <strong style="color: #EF4444;">${new Date(invoice.dueDate).toLocaleDateString()}</strong></div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 24px;">
            <div style="color: #64748B; font-size: 12px; text-transform: uppercase;">Bill To</div>
            <div style="color: #0F172A; font-size: 16px; font-weight: 600;">${clientName}</div>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <thead>
              <tr style="background: #F1F5F9;">
                <th style="padding: 12px 8px; text-align: left; color: #64748B; font-size: 12px; text-transform: uppercase;">#</th>
                <th style="padding: 12px 8px; text-align: left; color: #64748B; font-size: 12px; text-transform: uppercase;">Description</th>
                <th style="padding: 12px 8px; text-align: center; color: #64748B; font-size: 12px; text-transform: uppercase;">Qty</th>
                <th style="padding: 12px 8px; text-align: right; color: #64748B; font-size: 12px; text-transform: uppercase;">Rate</th>
                <th style="padding: 12px 8px; text-align: right; color: #64748B; font-size: 12px; text-transform: uppercase;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>

          <div style="text-align: right; margin-bottom: 24px;">
            <div style="color: #64748B; font-size: 14px;">Subtotal: ${currencySymbol}${invoice.subtotal.toFixed(2)}</div>
            ${invoice.taxTotal > 0 ? `<div style="color: #64748B; font-size: 14px;">Tax: ${currencySymbol}${invoice.taxTotal.toFixed(2)}</div>` : ''}
            ${invoice.discount > 0 ? `<div style="color: #64748B; font-size: 14px;">Discount: -${currencySymbol}${invoice.discount.toFixed(2)}</div>` : ''}
            <div style="color: #0F172A; font-size: 20px; font-weight: bold; margin-top: 8px; padding-top: 8px; border-top: 2px solid #2E86C1;">Total: ${currencySymbol}${invoice.total.toFixed(2)}</div>
          </div>

          ${invoice.notes ? `<div style="background: #F8FAFC; border-radius: 8px; padding: 16px; margin-bottom: 16px;"><div style="color: #64748B; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Notes</div><div style="color: #334155; font-size: 14px;">${invoice.notes}</div></div>` : ''}
          ${invoice.terms ? `<div style="background: #F8FAFC; border-radius: 8px; padding: 16px;"><div style="color: #64748B; font-size: 12px; text-transform: uppercase; margin-bottom: 4px;">Terms & Conditions</div><div style="color: #334155; font-size: 14px;">${invoice.terms}</div></div>` : ''}

          ${dto.message ? `<div style="margin-top: 24px; padding: 16px; background: #EFF6FF; border-radius: 8px; color: #334155; font-size: 14px;">${dto.message}</div>` : ''}

          <div style="text-align: center; margin-top: 32px; color: #94A3B8; font-size: 12px;">
            This invoice was generated by Nexora. Payment is due by ${new Date(invoice.dueDate).toLocaleDateString()}.
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: `"${invoice.brandName || 'Nexora'}" <no-reply@nexora.io>`,
        to: toEmail,
        subject,
        html,
      });

      invoice.status = invoice.status === 'draft' ? 'sent' : invoice.status;
      invoice.sentAt = new Date();
      invoice.sentTo = toEmail;
      invoice.emailCount = (invoice.emailCount || 0) + 1;
      await invoice.save();

      this.logger.log(`Invoice ${invoice.invoiceNumber} sent to ${toEmail}`);
    } catch (err) {
      this.logger.warn(`Failed to send invoice email: ${err.message || err}`);
      throw new ConflictException('Failed to send invoice email. Please try again.');
    }

    return invoice;
  }

  async markAsPaid(id: string, dto: MarkPaidDto, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const invoice = await this.invoiceModel.findOne(filter);
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (['cancelled', 'draft'].includes(invoice.status)) {
      throw new ConflictException(`Cannot mark a ${invoice.status} invoice as paid`);
    }

    const newAmountPaid = Math.round((invoice.amountPaid + dto.amount) * 100) / 100;
    const newBalanceDue = Math.round((invoice.total - newAmountPaid) * 100) / 100;

    invoice.amountPaid = newAmountPaid;
    invoice.balanceDue = Math.max(0, newBalanceDue);
    if (dto.paymentMethod) invoice.paymentMethod = dto.paymentMethod;
    if (dto.paymentNotes) invoice.paymentNotes = dto.paymentNotes;

    if (invoice.balanceDue <= 0) {
      invoice.status = 'paid';
    } else {
      invoice.status = 'partially_paid';
    }

    await invoice.save();
    this.logger.log(`Invoice ${invoice.invoiceNumber} payment recorded: ${dto.amount}`);
    return invoice;
  }

  async getInvoiceStats(orgId?: string) {
    const baseFilter: any = { isDeleted: false };
    if (orgId) baseFilter.organizationId = orgId;

    const [
      totalCount,
      draftCount,
      sentCount,
      paidCount,
      partiallyPaidCount,
      overdueCount,
      totalRevenue,
      paidAmount,
      pendingAmount,
      overdueAmount,
    ] = await Promise.all([
      this.invoiceModel.countDocuments(baseFilter),
      this.invoiceModel.countDocuments({ ...baseFilter, status: 'draft' }),
      this.invoiceModel.countDocuments({ ...baseFilter, status: 'sent' }),
      this.invoiceModel.countDocuments({ ...baseFilter, status: 'paid' }),
      this.invoiceModel.countDocuments({ ...baseFilter, status: 'partially_paid' }),
      this.invoiceModel.countDocuments({ ...baseFilter, status: 'overdue' }),
      this.invoiceModel.aggregate([
        { $match: { ...baseFilter, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]).then(r => r[0]?.total || 0),
      this.invoiceModel.aggregate([
        { $match: baseFilter },
        { $group: { _id: null, total: { $sum: '$amountPaid' } } },
      ]).then(r => r[0]?.total || 0),
      this.invoiceModel.aggregate([
        { $match: { ...baseFilter, status: { $in: ['sent', 'partially_paid'] } } },
        { $group: { _id: null, total: { $sum: '$balanceDue' } } },
      ]).then(r => r[0]?.total || 0),
      this.invoiceModel.aggregate([
        { $match: { ...baseFilter, status: 'overdue' } },
        { $group: { _id: null, total: { $sum: '$balanceDue' } } },
      ]).then(r => r[0]?.total || 0),
    ]);

    return {
      totalCount, draftCount, sentCount, paidCount, partiallyPaidCount, overdueCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      overdueAmount: Math.round(overdueAmount * 100) / 100,
    };
  }

  // ── Invoice Templates ──

  async createInvoiceTemplate(dto: CreateInvoiceTemplateDto, userId: string, orgId?: string) {
    const template = new this.invoiceTemplateModel({
      ...dto,
      createdBy: userId,
      organizationId: orgId,
    });
    await template.save();
    this.logger.log(`Invoice template created: ${template.name}`);
    return template;
  }

  async getInvoiceTemplates(orgId?: string) {
    const filter: any = { isDeleted: false };
    // Return both org-specific and default (no org) templates
    if (orgId) {
      filter.$or = [{ organizationId: orgId }, { organizationId: null }];
    }
    return this.invoiceTemplateModel.find(filter).sort({ isDefault: -1, name: 1 });
  }

  async deleteInvoiceTemplate(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const template = await this.invoiceTemplateModel.findOneAndUpdate(
      filter,
      { isDeleted: true },
      { new: true },
    );
    if (!template) throw new NotFoundException('Invoice template not found');
    this.logger.log(`Invoice template deleted: ${template.name}`);
    return { message: 'Invoice template deleted successfully' };
  }

  // ── Billing Rates ──

  async createBillingRate(dto: CreateBillingRateDto, userId: string, orgId?: string) {
    // Validate: role_based needs role, user_specific needs userId
    if (dto.type === 'role_based' && !dto.role) {
      throw new BadRequestException('role is required for role_based billing rate');
    }
    if (dto.type === 'user_specific' && !dto.userId) {
      throw new BadRequestException('userId is required for user_specific billing rate');
    }

    // Check for duplicate active rate
    const dupFilter: any = {
      projectId: dto.projectId,
      type: dto.type,
      isDeleted: false,
      effectiveTo: null,
    };
    if (orgId) dupFilter.organizationId = orgId;
    if (dto.type === 'role_based') dupFilter.role = dto.role;
    if (dto.type === 'user_specific') dupFilter.userId = dto.userId;

    const existing = await this.billingRateModel.findOne(dupFilter);
    if (existing) {
      // End the existing rate
      existing.effectiveTo = new Date(dto.effectiveFrom);
      existing.updatedBy = userId;
      await existing.save();
    }

    const rate = new this.billingRateModel({
      ...dto,
      effectiveFrom: new Date(dto.effectiveFrom),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      currency: dto.currency || 'USD',
      isDeleted: false,
      createdBy: userId,
      organizationId: orgId,
    });
    await rate.save();
    this.logger.log(`Billing rate created: ${rate._id} for project ${dto.projectId}`);
    return rate;
  }

  async getBillingRates(query: BillingRateQueryDto, orgId?: string) {
    const filter: any = { isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    if (query.projectId) filter.projectId = query.projectId;
    if (query.type) filter.type = query.type;
    return this.billingRateModel.find(filter).sort({ type: 1, createdAt: -1 });
  }

  async updateBillingRate(id: string, dto: UpdateBillingRateDto, userId: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;

    const rate = await this.billingRateModel.findOne(filter);
    if (!rate) throw new NotFoundException('Billing rate not found');

    if (dto.hourlyRate !== undefined) rate.hourlyRate = dto.hourlyRate;
    if (dto.currency) rate.currency = dto.currency;
    if (dto.effectiveFrom) rate.effectiveFrom = new Date(dto.effectiveFrom);
    if (dto.effectiveTo) rate.effectiveTo = new Date(dto.effectiveTo);
    if (dto.role !== undefined) rate.role = dto.role;
    if (dto.userName !== undefined) rate.userName = dto.userName;
    rate.updatedBy = userId;
    await rate.save();
    return rate;
  }

  async deleteBillingRate(id: string, orgId?: string) {
    const filter: any = { _id: id, isDeleted: false };
    if (orgId) filter.organizationId = orgId;
    const rate = await this.billingRateModel.findOneAndUpdate(filter, { isDeleted: true }, { new: true });
    if (!rate) throw new NotFoundException('Billing rate not found');
    this.logger.log(`Billing rate deleted: ${id}`);
    return { message: 'Billing rate deleted successfully' };
  }

  // ── Billing Rate Resolution ──

  private async resolveRate(projectId: string, userId: string, role: string | null, orgId?: string): Promise<{ rate: number; currency: string }> {
    const now = new Date();
    const baseFilter: any = {
      projectId,
      isDeleted: false,
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: now } }],
    };
    if (orgId) baseFilter.organizationId = orgId;

    // Priority 1: user_specific
    const userRate = await this.billingRateModel.findOne({ ...baseFilter, type: 'user_specific', userId }).sort({ effectiveFrom: -1 });
    if (userRate) return { rate: userRate.hourlyRate, currency: userRate.currency };

    // Priority 2: role_based
    if (role) {
      const roleRate = await this.billingRateModel.findOne({ ...baseFilter, type: 'role_based', role }).sort({ effectiveFrom: -1 });
      if (roleRate) return { rate: roleRate.hourlyRate, currency: roleRate.currency };
    }

    // Priority 3: project_default
    const defaultRate = await this.billingRateModel.findOne({ ...baseFilter, type: 'project_default' }).sort({ effectiveFrom: -1 });
    if (defaultRate) return { rate: defaultRate.hourlyRate, currency: defaultRate.currency };

    return { rate: 0, currency: 'USD' };
  }

  // ── Timesheet-to-Invoice Bridge ──

  async previewInvoiceFromTimesheets(dto: PreviewInvoiceDto, authToken?: string, orgId?: string) {
    if (!dto.timesheetIds || dto.timesheetIds.length === 0) {
      throw new BadRequestException('At least one timesheet ID is required');
    }

    // Fetch timesheets from task-service via HTTP
    const timesheets = await this.fetchTimesheets(dto.timesheetIds, authToken);

    // Only approved timesheets can be invoiced
    const nonApproved = timesheets.filter(ts => ts.status !== 'approved');
    if (nonApproved.length > 0) {
      throw new BadRequestException(`${nonApproved.length} timesheet(s) are not approved. Only approved timesheets can be invoiced.`);
    }

    return this.buildInvoicePreview(timesheets, orgId);
  }

  async generateInvoiceFromTimesheets(dto: GenerateInvoiceDto, userId: string, authToken?: string, orgId?: string) {
    if (!dto.timesheetIds || dto.timesheetIds.length === 0) {
      throw new BadRequestException('At least one timesheet ID is required');
    }

    const timesheets = await this.fetchTimesheets(dto.timesheetIds, authToken);
    const nonApproved = timesheets.filter(ts => ts.status !== 'approved');
    if (nonApproved.length > 0) {
      throw new BadRequestException(`${nonApproved.length} timesheet(s) are not approved. Only approved timesheets can be invoiced.`);
    }

    const preview = await this.buildInvoicePreview(timesheets, orgId);

    if (preview.lineItems.length === 0) {
      throw new BadRequestException('No billable line items found in the selected timesheets');
    }

    // Determine client
    const clientId = dto.clientId || preview.suggestedClientId;
    if (!clientId) {
      throw new BadRequestException('clientId is required — could not auto-detect client from projects');
    }

    // Verify client exists
    const clientFilter: any = { _id: clientId, isDeleted: false };
    if (orgId) clientFilter.organizationId = orgId;
    const client = await this.clientModel.findOne(clientFilter);
    if (!client) throw new NotFoundException('Client not found');

    // Build invoice items
    const items = preview.lineItems.map(li => ({
      description: `${li.projectName} — ${li.personName} (${li.hours}h)`,
      quantity: li.hours,
      rate: li.rate,
      amount: li.amount,
      taxRate: 0,
      taxAmount: 0,
    }));

    const dueDate = dto.dueDate
      ? new Date(dto.dueDate)
      : new Date(Date.now() + (client.paymentTerms || 30) * 24 * 60 * 60 * 1000);

    const invoiceNumber = await this.generateInvoiceNumber(orgId);
    const { items: calcItems, subtotal, taxTotal, total } = this.calculateInvoiceTotals(items, 0, 'fixed');

    const invoice = new this.invoiceModel({
      organizationId: orgId,
      invoiceNumber,
      clientId,
      issueDate: new Date(),
      dueDate,
      items: calcItems,
      subtotal,
      taxTotal,
      discount: 0,
      discountType: 'fixed',
      total,
      amountPaid: 0,
      balanceDue: total,
      currency: dto.currency || preview.currency || client.currency || 'USD',
      status: 'draft',
      paymentTerms: client.paymentTerms || 30,
      notes: dto.notes || `Generated from ${dto.timesheetIds.length} timesheet(s)`,
      emailCount: 0,
      isDeleted: false,
      createdBy: userId,
    });

    await invoice.save();
    this.logger.log(`Invoice ${invoice.invoiceNumber} generated from ${dto.timesheetIds.length} timesheets`);

    // Update client lastInvoiceDate
    await this.clientModel.updateOne({ _id: clientId }, { $set: { lastInvoiceDate: new Date() } });

    return { invoice, preview };
  }

  private async fetchTimesheets(timesheetIds: string[], authToken?: string): Promise<any[]> {
    // Fetch timesheets via internal HTTP call to task-service
    const taskServiceUrl = process.env.TASK_SERVICE_URL || 'http://task-service:3021';
    const timesheets: any[] = [];

    for (const id of timesheetIds) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = authToken;

        const response = await fetch(`${taskServiceUrl}/api/v1/timesheets/${id}`, { headers });
        if (!response.ok) {
          throw new NotFoundException(`Timesheet ${id} not found or inaccessible`);
        }
        const body: any = await response.json();
        timesheets.push(body.data || body);
      } catch (err) {
        if (err instanceof NotFoundException) throw err;
        this.logger.error(`Failed to fetch timesheet ${id}: ${err.message}`);
        throw new BadRequestException(`Failed to fetch timesheet ${id}`);
      }
    }

    return timesheets;
  }

  private async buildInvoicePreview(timesheets: any[], orgId?: string) {
    // Group all entries by projectId + employeeId
    const groups: Map<string, {
      projectId: string;
      projectName: string;
      personId: string;
      personName: string;
      hours: number;
      entries: any[];
    }> = new Map();

    for (const ts of timesheets) {
      const personId = ts.employeeId || ts.userId || ts.createdBy;
      const personName = ts.employeeName || personId;

      for (const entry of (ts.entries || [])) {
        const key = `${entry.projectId || 'unknown'}_${personId}`;
        if (!groups.has(key)) {
          groups.set(key, {
            projectId: entry.projectId || 'unknown',
            projectName: entry.projectName || 'General',
            personId,
            personName,
            hours: 0,
            entries: [],
          });
        }
        const g = groups.get(key)!;
        g.hours += entry.hours || 0;
        g.entries.push(entry);
      }
    }

    // Resolve rates and build line items
    const lineItems: Array<{
      projectId: string;
      projectName: string;
      personId: string;
      personName: string;
      hours: number;
      rate: number;
      currency: string;
      amount: number;
    }> = [];

    let suggestedClientId: string | null = null;
    let currency = 'USD';

    // Try to detect clientId from projects via client schema
    const projectIds = [...new Set([...groups.values()].map(g => g.projectId).filter(id => id !== 'unknown'))];
    if (projectIds.length > 0) {
      // Check clients that have these projectIds linked
      const clients = await this.clientModel.find({
        projectIds: { $in: projectIds },
        isDeleted: false,
        ...(orgId ? { organizationId: orgId } : {}),
      }).lean();
      if (clients.length === 1) {
        suggestedClientId = clients[0]._id.toString();
        currency = clients[0].currency || 'USD';
      }
    }

    for (const [, group] of groups) {
      const resolved = await this.resolveRate(group.projectId, group.personId, null, orgId);
      const hours = Math.round(group.hours * 100) / 100;
      const amount = Math.round(hours * resolved.rate * 100) / 100;

      lineItems.push({
        projectId: group.projectId,
        projectName: group.projectName,
        personId: group.personId,
        personName: group.personName,
        hours,
        rate: resolved.rate,
        currency: resolved.currency || currency,
        amount,
      });

      if (resolved.currency && resolved.currency !== 'USD') {
        currency = resolved.currency;
      }
    }

    // Build project subtotals
    const projectSubtotals: Record<string, { projectName: string; hours: number; amount: number }> = {};
    for (const li of lineItems) {
      if (!projectSubtotals[li.projectId]) {
        projectSubtotals[li.projectId] = { projectName: li.projectName, hours: 0, amount: 0 };
      }
      projectSubtotals[li.projectId].hours += li.hours;
      projectSubtotals[li.projectId].amount += li.amount;
    }

    const grandTotal = Math.round(lineItems.reduce((sum, li) => sum + li.amount, 0) * 100) / 100;
    const totalHours = Math.round(lineItems.reduce((sum, li) => sum + li.hours, 0) * 100) / 100;

    return {
      timesheetIds: timesheets.map(ts => ts._id),
      lineItems,
      projectSubtotals: Object.values(projectSubtotals),
      grandTotal,
      totalHours,
      currency,
      suggestedClientId,
    };
  }
}
