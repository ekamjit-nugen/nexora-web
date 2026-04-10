import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ExternalServicesService {
  private readonly logger = new Logger(ExternalServicesService.name);
  private readonly hrServiceUrl: string;
  private readonly attendanceServiceUrl: string;
  private readonly leaveServiceUrl: string;
  private readonly authServiceUrl: string;
  private readonly aiServiceUrl: string;

  constructor(private configService: ConfigService) {
    this.hrServiceUrl = this.configService.get<string>('HR_SERVICE_URL') || 'http://localhost:3010';
    this.attendanceServiceUrl = this.configService.get<string>('ATTENDANCE_SERVICE_URL') || 'http://localhost:3011';
    this.leaveServiceUrl = this.configService.get<string>('LEAVE_SERVICE_URL') || 'http://localhost:3012';
    this.authServiceUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:3001';
    this.aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL') || 'http://ai-service:3080';
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

  // Parse resume using AI service
  async parseResume(resumeText: string): Promise<any | null> {
    const prompt = `Extract structured data from this resume. Return JSON only with this exact shape:
{
  "name": "...",
  "email": "...",
  "phone": "...",
  "location": "...",
  "summary": "...",
  "skills": ["skill1", "skill2"],
  "experience": [{"company": "...", "role": "...", "duration": "...", "description": "..."}],
  "education": [{"institution": "...", "degree": "...", "year": 2020}],
  "totalExperienceYears": 5,
  "languages": ["English"],
  "certifications": []
}

Resume:
${resumeText}

Return only valid JSON, no markdown, no commentary.`;

    try {
      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const text = json.data?.response || json.response || json.data?.content || '';
      // Extract JSON from response
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch (err) {
      this.logger.warn(`Resume parsing failed: ${err.message}`);
      return null;
    }
  }

  // Compute match score using AI
  async computeJobMatchScore(
    jobDescription: string,
    candidateResume: any,
  ): Promise<{ score: number; reasoning: string; matchedSkills: string[]; missingSkills: string[] } | null> {
    const prompt = `Rate this candidate's fit for the job on a scale of 0-100. Return JSON only:
{
  "score": 85,
  "reasoning": "...",
  "matchedSkills": [],
  "missingSkills": []
}

Job Description:
${jobDescription}

Candidate:
Skills: ${JSON.stringify(candidateResume?.skills || [])}
Experience: ${JSON.stringify(candidateResume?.experience || [])}
Total Experience: ${candidateResume?.totalExperienceYears || 0} years
Summary: ${candidateResume?.summary || ''}

Return only valid JSON.`;

    try {
      const res = await fetch(`${this.aiServiceUrl}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.2,
          max_tokens: 1000,
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const text = json.data?.response || json.response || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      return JSON.parse(match[0]);
    } catch (err) {
      this.logger.warn(`Match score computation failed: ${err.message}`);
      return null;
    }
  }
}
