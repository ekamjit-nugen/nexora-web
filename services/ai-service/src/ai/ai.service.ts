import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface LLMResponse {
  text: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly llmUrl: string;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.llmUrl = config.get('LLM_BASE_URL') || 'http://host.docker.internal:7/v1/chat/completions';
    this.model = config.get('LLM_MODEL') || 'deepseek';
    this.logger.log(`LLM configured: ${this.llmUrl} model=${this.model}`);
  }

  // ── Core: Call LLM ──

  async chat(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): Promise<LLMResponse> {
    try {
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: false,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }, { timeout: 60000 });

      const choice = res.data?.choices?.[0];
      return {
        text: choice?.message?.content || '',
        usage: res.data?.usage,
      };
    } catch (err) {
      this.logger.error(`LLM call failed: ${err.message}`);
      throw new Error('AI service is temporarily unavailable. Please try again.');
    }
  }

  // ── Streaming: Call LLM with SSE ──

  async *chatStream(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number }): AsyncGenerator<string> {
    try {
      const res = await axios.post(this.llmUrl, {
        model: this.model,
        stream: true,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
      }, { timeout: 120000, responseType: 'stream' });

      for await (const chunk of res.data) {
        const lines = chunk.toString().split('\n').filter((l: string) => l.startsWith('data: '));
        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta;
            // DeepSeek uses reasoning_content for chain-of-thought, content for actual answer
            if (delta?.content) {
              yield `CONTENT:${delta.content}`;
            } else if (delta?.reasoning_content) {
              yield `THINKING:${delta.reasoning_content}`;
            }
          } catch { /* skip malformed chunks */ }
        }
      }
    } catch (err) {
      this.logger.error(`LLM stream failed: ${err.message}`);
      throw new Error('AI service is temporarily unavailable.');
    }
  }

  // ── Project: Generate Description ──

  async generateProjectDescription(projectName: string, category: string, context?: string): Promise<string> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are a senior project manager at an IT company. Generate concise, professional project descriptions. Output ONLY the description text, no headings or labels. Keep it to 2-3 sentences.',
      },
      {
        role: 'user',
        content: `Generate a project description for:
Project: ${projectName}
Category: ${category}
${context ? `Additional context: ${context}` : ''}`,
      },
    ];
    const res = await this.chat(messages, { temperature: 0.7, maxTokens: 256 });
    return res.text.trim();
  }

  // ── Project: Generate Milestones ──

  async generateMilestones(projectName: string, category: string, description?: string): Promise<Array<{ name: string; durationDays: number }>> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a senior project manager. Generate milestones for a software project.
Output ONLY a JSON array, no markdown, no explanation. Each item: {"name": "milestone name", "durationDays": number}
Generate 5-8 milestones that are industry-standard for the given project type.`,
      },
      {
        role: 'user',
        content: `Generate milestones for:
Project: ${projectName}
Category: ${category}
${description ? `Description: ${description}` : ''}`,
      },
    ];
    const res = await this.chat(messages, { temperature: 0.5, maxTokens: 1024 });

    try {
      const cleaned = res.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn('Failed to parse milestones JSON, returning defaults');
      return [
        { name: 'Discovery & Planning', durationDays: 14 },
        { name: 'Design & Architecture', durationDays: 14 },
        { name: 'Core Development', durationDays: 28 },
        { name: 'Testing & QA', durationDays: 14 },
        { name: 'Deployment & Launch', durationDays: 7 },
      ];
    }
  }

  // ── Project: Generate Board Tasks ──

  async generateBoardTasks(
    projectName: string,
    category: string,
    milestones: string[],
    boardType: string,
  ): Promise<Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a senior project manager. Generate tasks for a ${boardType} board.
Output ONLY a JSON array, no markdown. Each item:
{"title": "task title", "type": "task|story|bug|spike", "priority": "high|medium|low", "milestone": "matching milestone name", "storyPoints": 1-8, "description": "one line description"}
Generate 15-25 tasks distributed across the milestones. Make them specific and actionable.`,
      },
      {
        role: 'user',
        content: `Generate board tasks for:
Project: ${projectName}
Category: ${category}
Board type: ${boardType}
Milestones: ${milestones.join(', ')}`,
      },
    ];
    const res = await this.chat(messages, { temperature: 0.6, maxTokens: 4096 });

    try {
      const cleaned = res.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      this.logger.warn('Failed to parse tasks JSON');
      return [];
    }
  }

  // ── General: Improve Text ──

  async improveText(text: string, instruction: string): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are a professional writer. Output ONLY the improved text, nothing else.' },
      { role: 'user', content: `${instruction}\n\nText:\n${text}` },
    ];
    const res = await this.chat(messages, { temperature: 0.6, maxTokens: 1024 });
    return res.text.trim();
  }

  // ── General: Summarize ──

  async summarize(text: string, maxLength?: number): Promise<string> {
    const messages: ChatMessage[] = [
      { role: 'system', content: `Summarize concisely${maxLength ? ` in ${maxLength} words or less` : ''}. Output ONLY the summary.` },
      { role: 'user', content: text },
    ];
    const res = await this.chat(messages, { temperature: 0.3, maxTokens: 512 });
    return res.text.trim();
  }

  // ── Health Check: Test LLM Connection ──

  async checkLLMHealth(): Promise<{ available: boolean; model: string; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.chat([{ role: 'user', content: 'ping' }], { maxTokens: 5 });
      return { available: true, model: this.model, latencyMs: Date.now() - start };
    } catch {
      return { available: false, model: this.model, latencyMs: Date.now() - start };
    }
  }

  // ── Project: Generate Full Project Plan ──

  async generateProjectPlan(
    projectName: string,
    category: string,
    description?: string,
  ): Promise<{
    description: string;
    milestones: Array<{ name: string; durationDays: number }>;
    tasks: Array<{ title: string; type: string; priority: string; milestone: string; storyPoints: number; description: string }>;
    suggestedBoardType: string;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are a senior project manager. Generate a complete project plan as JSON.
Output ONLY valid JSON with no markdown, no explanation. The JSON must have this structure:
{
  "description": "2-3 sentence project description",
  "milestones": [{"name": "milestone name", "durationDays": number}],
  "tasks": [{"title": "task title", "type": "task|story|bug|spike", "priority": "high|medium|low", "milestone": "matching milestone name", "storyPoints": 1-8, "description": "one line description"}],
  "suggestedBoardType": "scrum|kanban"
}
Generate 5-8 milestones and 15-25 tasks distributed across milestones. Make tasks specific and actionable.
Choose the board type based on the project category (scrum for iterative software projects, kanban for maintenance/ops).`,
      },
      {
        role: 'user',
        content: `Generate a complete project plan for:
Project: ${projectName}
Category: ${category}
${description ? `Description: ${description}` : ''}`,
      },
    ];

    const res = await this.chat(messages, { temperature: 0.6, maxTokens: 4096 });

    try {
      const cleaned = res.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        description: parsed.description || `${projectName} - ${category} project`,
        milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
        suggestedBoardType: parsed.suggestedBoardType || 'scrum',
      };
    } catch {
      this.logger.warn('Failed to parse project plan JSON, returning defaults');
      const defaultMilestones = [
        { name: 'Discovery & Planning', durationDays: 14 },
        { name: 'Design & Architecture', durationDays: 14 },
        { name: 'Core Development', durationDays: 28 },
        { name: 'Testing & QA', durationDays: 14 },
        { name: 'Deployment & Launch', durationDays: 7 },
      ];
      return {
        description: `${projectName} is a ${category} project focused on delivering high-quality results through structured planning and execution.`,
        milestones: defaultMilestones,
        tasks: [
          { title: 'Define project scope and objectives', type: 'task', priority: 'high', milestone: 'Discovery & Planning', storyPoints: 3, description: 'Document project goals, scope, and success criteria' },
          { title: 'Stakeholder requirements gathering', type: 'story', priority: 'high', milestone: 'Discovery & Planning', storyPoints: 5, description: 'Collect and document requirements from all stakeholders' },
          { title: 'Create system architecture document', type: 'task', priority: 'high', milestone: 'Design & Architecture', storyPoints: 5, description: 'Design high-level system architecture and data models' },
          { title: 'UI/UX wireframes and mockups', type: 'story', priority: 'medium', milestone: 'Design & Architecture', storyPoints: 5, description: 'Create wireframes and visual designs for key screens' },
          { title: 'Set up development environment', type: 'task', priority: 'high', milestone: 'Core Development', storyPoints: 3, description: 'Configure development tools, CI/CD, and repositories' },
          { title: 'Implement core features', type: 'story', priority: 'high', milestone: 'Core Development', storyPoints: 8, description: 'Build the primary feature set of the application' },
          { title: 'API integration development', type: 'task', priority: 'medium', milestone: 'Core Development', storyPoints: 5, description: 'Develop and integrate required API endpoints' },
          { title: 'Write unit and integration tests', type: 'task', priority: 'high', milestone: 'Testing & QA', storyPoints: 5, description: 'Create comprehensive test suites for all modules' },
          { title: 'User acceptance testing', type: 'story', priority: 'high', milestone: 'Testing & QA', storyPoints: 5, description: 'Conduct UAT sessions with stakeholders' },
          { title: 'Production deployment', type: 'task', priority: 'high', milestone: 'Deployment & Launch', storyPoints: 3, description: 'Deploy application to production environment' },
        ],
        suggestedBoardType: 'scrum',
      };
    }
  }

  // ── Onboarding: Generate Organization Structure ──

  async generateOnboardingStructure(
    orgName: string,
    industry: string,
    size: string,
  ): Promise<{
    departments: Array<{ name: string; code: string; description: string }>;
    designations: Array<{ title: string; level: number; track: string; department: string }>;
    teams: Array<{ name: string; department: string; description: string }>;
    suggestedRoles: Array<{ name: string; description: string }>;
    suggestedPolicies: Array<{ name: string; type: string; description: string }>;
  }> {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an HR organizational design expert. Generate a complete organizational structure as JSON.
Output ONLY valid JSON with no markdown, no explanation. The JSON must have this structure:
{
  "departments": [{"name": "Department Name", "code": "DEPT_CODE", "description": "what this dept does"}],
  "designations": [{"title": "Job Title", "level": 1-10, "track": "individual|management", "department": "Department Name"}],
  "teams": [{"name": "Team Name", "department": "Department Name", "description": "team purpose"}],
  "suggestedRoles": [{"name": "Role Name", "description": "role permissions description"}],
  "suggestedPolicies": [{"name": "Policy Name", "type": "leave|attendance|expense|security|general", "description": "brief policy description"}]
}

Guidelines by industry:
- IT/Software: Engineering, QA, DevOps, Product, Design, HR, Finance departments
- Agency/Marketing: Creative, Strategy, Account Management, Production, Media, HR, Finance departments
- Healthcare: Clinical, Nursing, Administration, Research, IT, HR, Finance departments
- Manufacturing: Production, Quality Control, Supply Chain, R&D, Maintenance, HR, Finance departments
- Consulting: Consulting, Research, Business Development, Operations, HR, Finance departments
- E-commerce/Retail: Product, Engineering, Marketing, Operations, Customer Support, HR, Finance departments

Scale the number of designations and teams based on organization size:
- small (1-50): 3-5 departments, 8-12 designations, 4-8 teams
- medium (51-200): 5-7 departments, 12-20 designations, 8-15 teams
- large (200+): 7-10 departments, 20-30 designations, 15-25 teams

Always include 3-5 suggested roles (e.g., Admin, Manager, Member, Viewer) and 4-6 suggested policies.`,
      },
      {
        role: 'user',
        content: `Generate an organizational structure for:
Organization: ${orgName}
Industry: ${industry}
Size: ${size}`,
      },
    ];

    const res = await this.chat(messages, { temperature: 0.5, maxTokens: 4096 });

    try {
      const cleaned = res.text.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        departments: Array.isArray(parsed.departments) ? parsed.departments : [],
        designations: Array.isArray(parsed.designations) ? parsed.designations : [],
        teams: Array.isArray(parsed.teams) ? parsed.teams : [],
        suggestedRoles: Array.isArray(parsed.suggestedRoles) ? parsed.suggestedRoles : [],
        suggestedPolicies: Array.isArray(parsed.suggestedPolicies) ? parsed.suggestedPolicies : [],
      };
    } catch {
      this.logger.warn('Failed to parse onboarding structure JSON, returning defaults');
      return {
        departments: [
          { name: 'Engineering', code: 'ENG', description: 'Software development and technical architecture' },
          { name: 'Product', code: 'PROD', description: 'Product management and strategy' },
          { name: 'Design', code: 'DES', description: 'UI/UX design and user research' },
          { name: 'Human Resources', code: 'HR', description: 'People operations, hiring, and employee experience' },
          { name: 'Finance', code: 'FIN', description: 'Financial planning, accounting, and budgeting' },
        ],
        designations: [
          { title: 'Junior Developer', level: 1, track: 'individual', department: 'Engineering' },
          { title: 'Mid Developer', level: 2, track: 'individual', department: 'Engineering' },
          { title: 'Senior Developer', level: 3, track: 'individual', department: 'Engineering' },
          { title: 'Tech Lead', level: 4, track: 'management', department: 'Engineering' },
          { title: 'Engineering Manager', level: 5, track: 'management', department: 'Engineering' },
          { title: 'Product Manager', level: 3, track: 'individual', department: 'Product' },
          { title: 'Senior Product Manager', level: 4, track: 'individual', department: 'Product' },
          { title: 'UI/UX Designer', level: 2, track: 'individual', department: 'Design' },
          { title: 'Senior Designer', level: 3, track: 'individual', department: 'Design' },
          { title: 'HR Executive', level: 2, track: 'individual', department: 'Human Resources' },
          { title: 'HR Manager', level: 4, track: 'management', department: 'Human Resources' },
          { title: 'Accountant', level: 2, track: 'individual', department: 'Finance' },
        ],
        teams: [
          { name: 'Backend Team', department: 'Engineering', description: 'Server-side development and APIs' },
          { name: 'Frontend Team', department: 'Engineering', description: 'Client-side development and UI implementation' },
          { name: 'Product Team', department: 'Product', description: 'Product strategy and roadmap planning' },
          { name: 'Design Team', department: 'Design', description: 'User experience and interface design' },
          { name: 'People Ops', department: 'Human Resources', description: 'Employee engagement and HR operations' },
        ],
        suggestedRoles: [
          { name: 'Admin', description: 'Full system access with organization-wide settings management' },
          { name: 'Manager', description: 'Team management, approvals, and reporting access' },
          { name: 'Member', description: 'Standard access to assigned projects and team resources' },
          { name: 'Viewer', description: 'Read-only access to projects and dashboards' },
        ],
        suggestedPolicies: [
          { name: 'Paid Time Off Policy', type: 'leave', description: 'Annual leave entitlement and request procedures' },
          { name: 'Sick Leave Policy', type: 'leave', description: 'Sick leave allowance and documentation requirements' },
          { name: 'Remote Work Policy', type: 'attendance', description: 'Guidelines for remote and hybrid work arrangements' },
          { name: 'Expense Reimbursement Policy', type: 'expense', description: 'Eligible expenses and reimbursement process' },
          { name: 'Information Security Policy', type: 'security', description: 'Data protection, access controls, and security practices' },
        ],
      };
    }
  }
}
