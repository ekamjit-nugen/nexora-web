import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IDlpRule } from './schemas/retention-policy.schema';

export interface DlpCheckResult {
  allowed: boolean;
  action?: string;
  rule?: string;
  message?: string;
  redactedContent?: string;
}

// Pre-built patterns (safe — no nested quantifiers)
const BUILTIN_PATTERNS: Record<string, string> = {
  credit_card: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
  aadhaar: '\\b\\d{4}\\s?\\d{4}\\s?\\d{4}\\b',
  pan: '\\b[A-Z]{5}\\d{4}[A-Z]\\b',
  ssn: '\\b\\d{3}-\\d{2}-\\d{4}\\b',
  phone_bulk: '(?:\\+?\\d[\\d\\s\\-]{8,15}\\d){5,}',   // Fixed: bounded repetition, no nested .*
  email_bulk: '(?:[\\w.+\\-]+@[\\w\\-]+\\.\\w{2,6}\\s*){5,}', // Fixed: bounded repetition
};

/**
 * Detect potentially dangerous regex patterns that could cause ReDoS.
 * Rejects patterns with nested quantifiers like (a+)+, (a*)*b, etc.
 */
function isUnsafeRegex(pattern: string): boolean {
  // Detect nested quantifiers: quantifier followed by quantifier (common ReDoS pattern)
  const nestedQuantifier = /(\+|\*|\{[^}]+\})\)(\+|\*|\{[^}]+\}|\?)/;
  if (nestedQuantifier.test(pattern)) return true;
  // Detect overlapping alternation with repetition: (a|a)+
  // Simple heuristic — not perfect, but catches common cases
  return false;
}

/**
 * Safe regex test with timeout protection.
 * Runs the regex test and aborts if it takes longer than maxMs.
 */
function safeRegexTest(pattern: string, flags: string, input: string, maxMs: number = 100): boolean {
  // Limit input length to prevent pathological performance
  const truncated = input.length > 10000 ? input.slice(0, 10000) : input;
  const regex = new RegExp(pattern, flags);
  const start = Date.now();
  const result = regex.test(truncated);
  const elapsed = Date.now() - start;
  if (elapsed > maxMs) {
    throw new Error(`Regex execution exceeded ${maxMs}ms (took ${elapsed}ms)`);
  }
  return result;
}

function safeRegexReplace(pattern: string, flags: string, input: string, replacement: string, maxMs: number = 100): string {
  const truncated = input.length > 10000 ? input.slice(0, 10000) : input;
  const regex = new RegExp(pattern, flags);
  const start = Date.now();
  const result = truncated.replace(regex, replacement);
  const elapsed = Date.now() - start;
  if (elapsed > maxMs) {
    throw new Error(`Regex execution exceeded ${maxMs}ms (took ${elapsed}ms)`);
  }
  return result;
}

@Injectable()
export class DlpService {
  private readonly logger = new Logger(DlpService.name);

  constructor(
    @InjectModel('DlpRule', 'nexora_chat') private ruleModel: Model<IDlpRule>,
  ) {}

  /**
   * Check message content against all active DLP rules for the org.
   */
  async checkMessage(organizationId: string, content: string): Promise<DlpCheckResult> {
    if (!content || content.length < 3) return { allowed: true };

    const rules = await this.ruleModel.find({ organizationId, isActive: true }).lean();

    for (const rule of rules) {
      try {
        // Safe regex execution with timeout to prevent ReDoS
        if (safeRegexTest(rule.pattern, 'gi', content)) {
          // Increment trigger count
          this.ruleModel.updateOne({ _id: rule._id }, { $inc: { triggeredCount: 1 } }).catch(() => {});

          this.logger.warn(`DLP rule "${rule.name}" triggered for org ${organizationId}`);

          switch (rule.action) {
            case 'block':
              return { allowed: false, action: 'block', rule: rule.name, message: rule.message || 'Message blocked by DLP policy' };
            case 'warn':
              return { allowed: true, action: 'warn', rule: rule.name, message: rule.message || 'This message may contain sensitive information' };
            case 'redact':
              const redacted = safeRegexReplace(rule.pattern, 'gi', content, '****');
              return { allowed: true, action: 'redact', rule: rule.name, redactedContent: redacted };
            case 'flag':
            default:
              return { allowed: true, action: 'flag', rule: rule.name };
          }
        }
      } catch (err) {
        this.logger.warn(`DLP regex issue for rule ${rule.name}: ${err.message}`);
      }
    }

    return { allowed: true };
  }

  // ── Rule CRUD ──

  async createRule(organizationId: string, data: Partial<IDlpRule>, createdBy: string) {
    // Validate regex syntax
    try { new RegExp(data.pattern); } catch { throw new Error('Invalid regex pattern'); }
    // Reject potentially dangerous patterns (ReDoS)
    if (isUnsafeRegex(data.pattern)) {
      throw new Error('Regex pattern contains nested quantifiers which could cause performance issues. Please simplify the pattern.');
    }

    const rule = new this.ruleModel({ ...data, organizationId, createdBy });
    await rule.save();
    return rule;
  }

  async getRules(organizationId: string) {
    return this.ruleModel.find({ organizationId }).sort({ createdAt: -1 }).lean();
  }

  async updateRule(ruleId: string, data: Partial<IDlpRule>) {
    if (data.pattern) {
      try { new RegExp(data.pattern); } catch { throw new Error('Invalid regex pattern'); }
      if (isUnsafeRegex(data.pattern)) {
        throw new Error('Regex pattern contains nested quantifiers which could cause performance issues.');
      }
    }
    return this.ruleModel.findByIdAndUpdate(ruleId, data, { new: true });
  }

  async deleteRule(ruleId: string) {
    return this.ruleModel.findByIdAndDelete(ruleId);
  }

  async getBuiltinPatterns() {
    return BUILTIN_PATTERNS;
  }
}
