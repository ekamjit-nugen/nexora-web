/**
 * Agent type definitions for enhancement agents
 */

export enum AgentPriority {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum FeatureStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  priority: AgentPriority;
  status: FeatureStatus;
  dependencies: string[];
  schemaFile?: string;
  serviceFile?: string;
  controllerFile?: string;
  testFile?: string;
  completedAt?: Date;
  error?: Error;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  agent: string;
  feature: string;
  action: string;
  status: 'success' | 'failure' | 'warning';
  details: {
    schemasCreated?: string[];
    servicesAdded?: string[];
    endpointsCreated?: number;
    testsWritten?: number;
    errorMessages?: string[];
  };
  metrics: {
    duration: number;
    filesModified: number;
    linesAdded: number;
    linesRemoved: number;
  };
}

export interface SimulationResult {
  scenario: string;
  status: 'pass' | 'fail';
  duration: number;
  operations: number;
  averageLatency: number;
  peakLatency: number;
  errors: SimulationError[];
  metrics: {
    throughput: number;
    errorRate: number;
    p95Latency: number;
    p99Latency: number;
  };
}

export interface SimulationError {
  operation: string;
  message: string;
  timestamp: Date;
}

export interface AgentMetrics {
  agentName: string;
  featuresImplemented: number;
  schemasCreated: number;
  servicesAdded: number;
  endpointsCreated: number;
  testsWritten: number;
  testsPassed: number;
  testsFailed: number;
  codeCoverage: number;
  executionTime: number;
  dependencies: string[];
  riskScore: number;
}

export interface TestReport {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  coverage: number;
  duration: number;
  details: TestResult[];
}

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
}

export interface AuditReport {
  timestamp: Date;
  executionSummary: {
    totalFeatures: number;
    implementedFeatures: number;
    failedFeatures: number;
    totalDuration: number;
  };
  perAgentReport: AgentReport[];
  integrationTests: TestReport;
  overallMetrics: {
    codeQuality: number;
    testCoverage: number;
    securityScore: number;
  };
  recommendations: string[];
  dependencies: DependencyAnalysis;
}

export interface AgentReport {
  agent: string;
  status: 'success' | 'failure' | 'partial';
  featuresCompleted: number;
  metrics: AgentMetrics;
  tests: TestReport;
  simulations: SimulationResult[];
  errors: Error[];
}

export interface DependencyAnalysis {
  totalDependencies: number;
  satisfiedDependencies: number;
  unsatisfiedDependencies: string[];
  criticalDependencies: string[];
}

export interface ExecutionPlan {
  agents: string[];
  sequence: string[];
  parallelGroups?: string[][];
  totalEstimatedTime: number;
}
