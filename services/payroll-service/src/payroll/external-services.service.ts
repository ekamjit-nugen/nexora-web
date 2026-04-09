import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExternalServicesService {
  private readonly logger = new Logger(ExternalServicesService.name);
  private readonly hrServiceUrl: string;
  private readonly attendanceServiceUrl: string;
  private readonly leaveServiceUrl: string;
  private readonly authServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.hrServiceUrl = this.configService.get<string>('HR_SERVICE_URL') || 'http://localhost:3010';
    this.attendanceServiceUrl = this.configService.get<string>('ATTENDANCE_SERVICE_URL') || 'http://localhost:3011';
    this.leaveServiceUrl = this.configService.get<string>('LEAVE_SERVICE_URL') || 'http://localhost:3012';
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
  }

  private async fetchJSON(url: string, token?: string): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        this.logger.warn(`External call failed: ${url} → ${res.status}`);
        return null;
      }
      const json = await res.json();
      return json.data || json;
    } catch (err) {
      this.logger.warn(`External call error: ${url} → ${err.message}`);
      return null;
    }
  }

  // Fetch employee details from hr-service
  async getEmployee(employeeId: string, token?: string): Promise<any> {
    return this.fetchJSON(`${this.hrServiceUrl}/api/v1/employees/${employeeId}`, token);
  }

  // Fetch attendance summary for a month from attendance-service
  async getMonthlyAttendance(employeeId: string, month: number, year: number, token?: string): Promise<any> {
    return this.fetchJSON(
      `${this.attendanceServiceUrl}/api/v1/attendance?employeeId=${employeeId}&month=${month}&year=${year}`,
      token,
    );
  }

  // Fetch leave records for a period from leave-service
  async getLeaveRecords(employeeId: string, startDate: string, endDate: string, token?: string): Promise<any> {
    return this.fetchJSON(
      `${this.leaveServiceUrl}/api/v1/leaves/my?employeeId=${employeeId}&startDate=${startDate}&endDate=${endDate}`,
      token,
    );
  }

  // Fetch org payroll config from auth-service
  async getPayrollConfig(orgId: string, token?: string): Promise<any> {
    return this.fetchJSON(`${this.authServiceUrl}/api/v1/settings/payroll`, token);
  }

  // Fetch org business details from auth-service
  async getOrgDetails(orgId: string, token?: string): Promise<any> {
    return this.fetchJSON(`${this.authServiceUrl}/api/v1/settings/business`, token);
  }
}
