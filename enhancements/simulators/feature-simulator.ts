/**
 * Feature Simulator - Simulates feature behavior and generates test scenarios
 */

import { SimulationResult, SimulationError } from '../agents/types';

export interface SimulationScenario {
  name: string;
  description: string;
  operations: number;
  expectedLatencyMs: number;
  maxErrorRatePercent: number;
}

export class FeatureSimulator {
  /**
   * Run a simulation scenario
   */
  async runScenario(scenario: SimulationScenario): Promise<SimulationResult> {
    const startTime = Date.now();
    const errors: SimulationError[] = [];
    const latencies: number[] = [];

    console.log(`  ⚙️  Running scenario: ${scenario.name}`);

    // Simulate operations
    for (let i = 0; i < scenario.operations; i++) {
      const operationStart = Date.now();

      try {
        // Simulate operation with random latency
        const latency = Math.random() * scenario.expectedLatencyMs * 1.5;
        await new Promise(resolve => setTimeout(resolve, Math.min(latency, 100)));

        latencies.push(latency);
      } catch (error) {
        errors.push({
          operation: `Operation ${i}`,
          message: (error as Error).message,
          timestamp: new Date(),
        });
      }
    }

    const duration = Date.now() - startTime;
    const errorRate = (errors.length / scenario.operations) * 100;
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

    // Sort latencies for percentile calculation
    latencies.sort((a, b) => a - b);
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

    const result: SimulationResult = {
      scenario: scenario.name,
      status: errorRate <= scenario.maxErrorRatePercent ? 'pass' : 'fail',
      duration,
      operations: scenario.operations,
      averageLatency: avgLatency,
      peakLatency: Math.max(...latencies),
      errors,
      metrics: {
        throughput: (scenario.operations / (duration / 1000)),
        errorRate,
        p95Latency,
        p99Latency,
      },
    };

    const status = result.status === 'pass' ? '✅' : '❌';
    console.log(`    ${status} ${scenario.name} - ${result.metrics.throughput.toFixed(2)} ops/sec, ${errorRate.toFixed(2)}% errors`);

    return result;
  }

  /**
   * Run multiple scenarios
   */
  async runScenarios(scenarios: SimulationScenario[]): Promise<SimulationResult[]> {
    const results: SimulationResult[] = [];

    for (const scenario of scenarios) {
      const result = await this.runScenario(scenario);
      results.push(result);
    }

    return results;
  }

  /**
   * Get predefined scenarios for P1 features
   */
  static getP1Scenarios(): SimulationScenario[] {
    return [
      {
        name: 'Custom Fields: Create 50 fields',
        description: 'Create 50 custom fields of various types',
        operations: 50,
        expectedLatencyMs: 100,
        maxErrorRatePercent: 1,
      },
      {
        name: 'Custom Fields: Query 1000 products',
        description: 'Query products by custom field values',
        operations: 1000,
        expectedLatencyMs: 200,
        maxErrorRatePercent: 0.5,
      },
      {
        name: 'Search: Parse complex NQL queries',
        description: 'Parse and execute complex NQL queries',
        operations: 100,
        expectedLatencyMs: 200,
        maxErrorRatePercent: 1,
      },
      {
        name: 'Bulk Operations: Update 500 products',
        description: 'Bulk update 500 products in parallel',
        operations: 500,
        expectedLatencyMs: 10000,
        maxErrorRatePercent: 2,
      },
      {
        name: 'Templates: Clone 100 products',
        description: 'Clone 100 products from templates',
        operations: 100,
        expectedLatencyMs: 3000,
        maxErrorRatePercent: 0.5,
      },
    ];
  }

  /**
   * Get predefined scenarios for P2 features
   */
  static getP2Scenarios(): SimulationScenario[] {
    return [
      {
        name: 'Workflows: Create state transitions',
        description: 'Create and execute workflow state transitions',
        operations: 200,
        expectedLatencyMs: 500,
        maxErrorRatePercent: 1,
      },
      {
        name: 'Automation: Trigger 100 rules',
        description: 'Trigger automation rules on product changes',
        operations: 100,
        expectedLatencyMs: 2000,
        maxErrorRatePercent: 2,
      },
      {
        name: 'Kanban: Render board with 500 cards',
        description: 'Load and render Kanban board',
        operations: 500,
        expectedLatencyMs: 5000,
        maxErrorRatePercent: 1,
      },
      {
        name: 'Analytics: Generate 50 reports',
        description: 'Generate analytics reports',
        operations: 50,
        expectedLatencyMs: 5000,
        maxErrorRatePercent: 2,
      },
      {
        name: 'Portfolio: Calculate metrics for 100 products',
        description: 'Calculate portfolio-level metrics',
        operations: 100,
        expectedLatencyMs: 3000,
        maxErrorRatePercent: 1,
      },
    ];
  }

  /**
   * Get predefined scenarios for P3 features
   */
  static getP3Scenarios(): SimulationScenario[] {
    return [
      {
        name: 'AI Suggestions: Generate for 100 products',
        description: 'Generate AI suggestions using LLM',
        operations: 100,
        expectedLatencyMs: 5000,
        maxErrorRatePercent: 3,
      },
      {
        name: 'RBAC: Verify 1000 permission checks',
        description: 'Verify role-based access control permissions',
        operations: 1000,
        expectedLatencyMs: 100,
        maxErrorRatePercent: 0.1,
      },
      {
        name: 'Multi-tenancy: Isolate 10 tenants',
        description: 'Ensure data isolation across tenants',
        operations: 10,
        expectedLatencyMs: 1000,
        maxErrorRatePercent: 0,
      },
      {
        name: 'Time-Travel: Query 1000 versions',
        description: 'Query product versions from history',
        operations: 1000,
        expectedLatencyMs: 500,
        maxErrorRatePercent: 1,
      },
      {
        name: 'Collaboration: 50 concurrent users',
        description: 'Handle real-time collaboration',
        operations: 500,
        expectedLatencyMs: 1000,
        maxErrorRatePercent: 2,
      },
    ];
  }
}
