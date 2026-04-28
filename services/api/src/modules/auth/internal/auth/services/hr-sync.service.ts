import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class HrSyncService {
  private readonly logger = new Logger(HrSyncService.name);

  constructor(private jwtService: JwtService) {}

  /**
   * Provision an employee record in the HR service for a user joining an org.
   * This is best-effort — failure does not block the org/invite flow.
   */
  async provisionEmployee(
    email: string,
    firstName: string,
    lastName: string,
    orgId: string,
    createdBy: string,
    status: string = 'active',
  ): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';

      // Generate a temporary JWT with org context for the HR service
      const tempPayload = {
        sub: createdBy,
        email,
        firstName,
        lastName,
        roles: ['admin'],
        organizationId: orgId,
      };
      const tempToken = this.jwtService.sign(tempPayload, { expiresIn: '1m' as any });

      const http = await import('http');
      const postData = JSON.stringify({
        firstName: firstName || email.split('@')[0],
        lastName: lastName || '',
        email,
        joiningDate: new Date().toISOString().split('T')[0],
        status,
      });

      await new Promise<void>((resolve) => {
        const req = http.request(
          `${hrUrl}/api/v1/employees`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tempToken}`,
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 5000,
          },
          (res) => {
            let body = '';
            res.on('data', (chunk) => (body += chunk));
            res.on('end', () => {
              if (res.statusCode === 201 || res.statusCode === 200) {
                this.logger.log(`Employee provisioned for ${email} in org ${orgId}`);
              } else if (res.statusCode === 409) {
                this.logger.debug(`Employee already exists for ${email} in org ${orgId}`);
              } else {
                this.logger.warn(`Employee provisioning returned ${res.statusCode} for ${email}: ${body}`);
              }
              resolve();
            });
          },
        );
        req.on('error', (err) => {
          this.logger.warn(`Employee provisioning failed for ${email}: ${err.message}`);
          resolve();
        });
        req.on('timeout', () => {
          req.destroy();
          this.logger.warn(`Employee provisioning timed out for ${email}`);
          resolve();
        });
        req.write(postData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee provisioning error for ${email}: ${err.message || err}`);
    }
  }

  /**
   * Update an employee's name in the HR service (best-effort).
   * Used after profile completion to sync the name.
   */
  async syncEmployeeName(email: string, firstName: string, lastName: string, orgId: string, userId: string): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';
      const tempToken = this.jwtService.sign({
        sub: userId, email, firstName, lastName, roles: ['admin'], organizationId: orgId,
      }, { expiresIn: '1m' as any });

      const http = await import('http');

      // First, find the employee by email
      const employees: any[] = await new Promise((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees?search=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tempToken}` },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(body)?.data || []); } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
        req.end();
      });

      const emp = employees.find((e: any) => e.email === email);
      if (!emp?._id) {
        this.logger.debug(`No HR employee found for ${email} to update name`);
        return;
      }

      // Update the employee name
      const putData = JSON.stringify({ firstName, lastName });
      await new Promise<void>((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees/${emp._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tempToken}`,
            'Content-Length': Buffer.byteLength(putData),
          },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              this.logger.log(`Employee name updated for ${email}: ${firstName} ${lastName}`);
            } else {
              this.logger.warn(`Employee name update returned ${res.statusCode} for ${email}: ${body}`);
            }
            resolve();
          });
        });
        req.on('error', (err) => { this.logger.warn(`Employee name sync failed: ${err.message}`); resolve(); });
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(putData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee name sync error for ${email}: ${err.message || err}`);
    }
  }

  /**
   * Update an employee's status in the HR service (best-effort).
   * Used after invite acceptance to change status from 'invited' to 'active'.
   */
  async syncEmployeeStatus(email: string, status: string, orgId: string, userId: string): Promise<void> {
    try {
      const hrUrl = process.env.HR_SERVICE_URL || 'http://hr-service:3010';
      const tempToken = this.jwtService.sign({
        sub: userId, email, roles: ['admin'], organizationId: orgId,
      }, { expiresIn: '1m' as any });

      const http = await import('http');

      // Find employee by email
      const employees: any[] = await new Promise((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees?search=${encodeURIComponent(email)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${tempToken}` },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(body)?.data || []); } catch { resolve([]); }
          });
        });
        req.on('error', () => resolve([]));
        req.on('timeout', () => { req.destroy(); resolve([]); });
        req.end();
      });

      const emp = employees.find((e: any) => e.email === email);
      if (!emp?._id) {
        this.logger.debug(`No HR employee found for ${email} to update status`);
        return;
      }

      const putData = JSON.stringify({ status });
      await new Promise<void>((resolve) => {
        const req = http.request(`${hrUrl}/api/v1/employees/${emp._id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tempToken}`,
            'Content-Length': Buffer.byteLength(putData),
          },
          timeout: 5000,
        }, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            if (res.statusCode === 200) {
              this.logger.log(`Employee status updated to '${status}' for ${email}`);
            } else {
              this.logger.warn(`Employee status update returned ${res.statusCode} for ${email}: ${body}`);
            }
            resolve();
          });
        });
        req.on('error', (err) => { this.logger.warn(`Employee status sync failed: ${err.message}`); resolve(); });
        req.on('timeout', () => { req.destroy(); resolve(); });
        req.write(putData);
        req.end();
      });
    } catch (err) {
      this.logger.warn(`Employee status sync error for ${email}: ${err.message || err}`);
    }
  }
}
