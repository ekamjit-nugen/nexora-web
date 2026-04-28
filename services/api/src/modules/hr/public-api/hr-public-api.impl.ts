import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  HrPublicApi,
  EmployeeSummary,
  FindEmployeeByUserIdentity,
  SearchEmployeesQuery,
  SearchEmployeesResult,
  CreateEmployeeInput,
} from './hr-public-api';
import { IEmployee } from '../internal/hr/schemas/employee.schema';
import { HR_DB } from '../../../bootstrap/database/database.tokens';

/**
 * In-process implementation of HrPublicApi.
 *
 * Thin projection layer — same Mongo collection that the legacy
 * HrController writes to, but exposed only through this typed
 * interface to other modules. Other modules cannot reach the schema
 * directly (.eslintrc enforces).
 */
@Injectable()
export class HrPublicApiImpl implements HrPublicApi {
  constructor(
    @InjectModel('Employee', HR_DB) private readonly employeeModel: Model<IEmployee>,
  ) {}

  async getEmployeeById(id: string, organizationId: string): Promise<EmployeeSummary | null> {
    const e: any = await this.employeeModel.findOne({
      _id: id,
      organizationId,
      isDeleted: { $ne: true },
    }).lean();
    return e ? this.toSummary(e) : null;
  }

  async findEmployeeByUserIdentity(query: FindEmployeeByUserIdentity): Promise<EmployeeSummary | null> {
    const filter: any = { organizationId: query.organizationId, isDeleted: { $ne: true } };
    if (query.userId) {
      filter.userId = query.userId;
    } else if (query.email) {
      filter.email = query.email.toLowerCase();
    } else {
      return null;
    }
    const e: any = await this.employeeModel.findOne(filter).lean();
    return e ? this.toSummary(e) : null;
  }

  async searchEmployees(query: SearchEmployeesQuery): Promise<SearchEmployeesResult> {
    const filter: any = { organizationId: query.organizationId, isDeleted: { $ne: true } };
    if (query.status) filter.status = query.status;
    if (query.managerId) filter.reportingManagerId = query.managerId;
    if (query.search) {
      const re = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { employeeId: re },
        { firstName: re },
        { lastName: re },
        { email: re },
      ];
    }
    const limit = Math.min(query.limit || 50, 5000);
    const skip = ((query.page || 1) - 1) * limit;
    const [rows, total] = await Promise.all([
      this.employeeModel.find(filter).limit(limit).skip(skip).lean(),
      this.employeeModel.countDocuments(filter),
    ]);
    return {
      data: rows.map((r: any) => this.toSummary(r)),
      total,
    };
  }

  async createEmployee(input: CreateEmployeeInput): Promise<EmployeeSummary> {
    const created: any = await this.employeeModel.create({
      organizationId: input.organizationId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      designation: input.designation,
      department: input.department,
      joiningDate: input.joiningDate,
      reportingManagerId: input.reportingManagerId,
      status: 'active',
      isDeleted: false,
    });
    return this.toSummary(created.toObject());
  }

  private toSummary(e: any): EmployeeSummary {
    return {
      _id: String(e._id),
      employeeId: e.employeeId || null,
      organizationId: String(e.organizationId),
      firstName: e.firstName || null,
      lastName: e.lastName || null,
      email: e.email || null,
      phone: e.phone || null,
      userId: e.userId || null,
      status: e.status || 'unknown',
      joiningDate: e.joiningDate || null,
      reportingManagerId: e.reportingManagerId ? String(e.reportingManagerId) : null,
      designation: e.designation || null,
      department: e.department || null,
      pan: e.pan || null,
      uan: e.uan || null,
      bankAccount: e.bankAccount
        ? {
            accountNumber: e.bankAccount.accountNumber || '',
            ifsc: e.bankAccount.ifsc || '',
            holderName: e.bankAccount.holderName || '',
          }
        : null,
    };
  }
}
