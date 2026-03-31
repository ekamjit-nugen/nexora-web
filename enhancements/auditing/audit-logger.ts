/**
 * Audit Logger - Logs all agent actions and decisions
 */

import { AuditEntry } from '../agents/types';
import * as fs from 'fs';
import * as path from 'path';

export class AuditLogger {
  private auditLog: AuditEntry[] = [];
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath || '/Users/ekamjitsingh/Projects/Nexora/services/product-service/reports/enhancements/audit-logs';
    this.ensureDirectoryExists(this.logPath);
  }

  /**
   * Log an audit action
   */
  async logAction(entry: AuditEntry): Promise<void> {
    this.auditLog.push(entry);

    // Log to console
    console.log(`[AUDIT] ${entry.timestamp.toISOString()} - ${entry.agent}/${entry.feature}: ${entry.action} (${entry.status})`);

    // Optionally persist to file (every 10 entries)
    if (this.auditLog.length % 10 === 0) {
      await this.persistLog();
    }
  }

  /**
   * Get audit entries for a specific agent
   */
  getAgentAudit(agentName: string): AuditEntry[] {
    return this.auditLog.filter(entry => entry.agent === agentName);
  }

  /**
   * Get audit entries for a specific feature
   */
  getFeatureAudit(featureName: string): AuditEntry[] {
    return this.auditLog.filter(entry => entry.feature === featureName);
  }

  /**
   * Get full audit trail
   */
  getFullAudit(): AuditEntry[] {
    return [...this.auditLog];
  }

  /**
   * Generate audit summary
   */
  generateSummary(): any {
    const summary: any = {
      totalActions: this.auditLog.length,
      successCount: 0,
      failureCount: 0,
      warningCount: 0,
      byAgent: {},
      byAction: {},
      timeline: [],
    };

    for (const entry of this.auditLog) {
      // Count by status
      if (entry.status === 'success') summary.successCount++;
      else if (entry.status === 'failure') summary.failureCount++;
      else if (entry.status === 'warning') summary.warningCount++;

      // Count by agent
      if (!summary.byAgent[entry.agent]) {
        summary.byAgent[entry.agent] = { success: 0, failure: 0, warning: 0 };
      }
      summary.byAgent[entry.agent][entry.status]++;

      // Count by action
      if (!summary.byAction[entry.action]) {
        summary.byAction[entry.action] = 0;
      }
      summary.byAction[entry.action]++;

      // Timeline
      summary.timeline.push({
        timestamp: entry.timestamp,
        agent: entry.agent,
        action: entry.action,
        status: entry.status,
      });
    }

    return summary;
  }

  /**
   * Persist audit log to file
   */
  private async persistLog(): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(this.logPath, `audit_${timestamp}.json`);

    try {
      fs.writeFileSync(filename, JSON.stringify(this.auditLog, null, 2));
    } catch (error) {
      console.error(`Failed to persist audit log: ${(error as Error).message}`);
    }
  }

  /**
   * Export audit log
   */
  async exportLog(format: 'json' | 'csv' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    if (format === 'json') {
      const filename = path.join(this.logPath, `audit_export_${timestamp}.json`);
      fs.writeFileSync(filename, JSON.stringify(this.auditLog, null, 2));
      return filename;
    } else if (format === 'csv') {
      const filename = path.join(this.logPath, `audit_export_${timestamp}.csv`);
      const csv = this.convertToCsv();
      fs.writeFileSync(filename, csv);
      return filename;
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  /**
   * Convert audit log to CSV
   */
  private convertToCsv(): string {
    const headers = ['Timestamp', 'Agent', 'Feature', 'Action', 'Status', 'Details'];
    const rows = this.auditLog.map(entry => [
      entry.timestamp.toISOString(),
      entry.agent,
      entry.feature,
      entry.action,
      entry.status,
      JSON.stringify(entry.details),
    ]);

    return [headers, ...rows].map(row => row.map(col => `"${col}"`).join(',')).join('\n');
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Clear audit log
   */
  clear(): void {
    this.auditLog = [];
  }
}
