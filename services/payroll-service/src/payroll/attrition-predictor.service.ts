import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ISalaryStructure } from './schemas/salary-structure.schema';
import { IOffboarding } from './schemas/offboarding.schema';
import { IPerformanceReview } from './schemas/performance-review.schema';
import { ExternalServicesService } from './external-services.service';

export interface AttritionFeatures {
  employeeId: string;
  tenureMonths: number;
  avgMonthlyLeaveDays: number;
  recentLateArrivals: number;
  salaryVsMedian: number; // ratio: 1.0 = at median
  latestPerformanceRating: number; // 1-5
  previousAttritionInTeam: number; // 0-1
}

export interface AttritionPrediction {
  employeeId: string;
  riskScore: number; // 0-100
  factors: string[]; // top 3 contributing factors
  confidence: number; // 0-1
  predictedAt: Date;
}

@Injectable()
export class AttritionPredictorService {
  private readonly logger = new Logger(AttritionPredictorService.name);

  // Feature weights (tuned for IT services industry patterns)
  private readonly WEIGHTS = {
    tenure: 0.20,
    leaveFrequency: 0.15,
    attendancePattern: 0.15,
    salaryGap: 0.25, // biggest factor per industry research
    performance: 0.15,
    teamAttrition: 0.10,
  };

  constructor(
    @InjectModel('SalaryStructure') private salaryStructureModel: Model<ISalaryStructure>,
    @InjectModel('Offboarding') private offboardingModel: Model<IOffboarding>,
    @InjectModel('PerformanceReview') private performanceReviewModel: Model<IPerformanceReview>,
    private externalServices: ExternalServicesService,
  ) {}

  /**
   * Compute tenure risk:
   * - 0-12 months: elevated (0.6)
   * - 13-36 months: low (0.2)
   * - 37-60 months: moderate (0.4)
   * - 60+ months: high (0.7) - senior employees have options
   */
  private scoreTenure(tenureMonths: number): number {
    if (tenureMonths < 12) return 0.6;
    if (tenureMonths < 37) return 0.2;
    if (tenureMonths < 61) return 0.4;
    return 0.7;
  }

  /**
   * Leave frequency score: higher usage = higher risk (correlates with dissatisfaction)
   * Normal: 1-2 days/month, elevated: 3-4, high: 5+
   */
  private scoreLeaveFrequency(avgMonthlyLeaveDays: number): number {
    if (avgMonthlyLeaveDays < 1.5) return 0.1;
    if (avgMonthlyLeaveDays < 3) return 0.3;
    if (avgMonthlyLeaveDays < 5) return 0.6;
    return 0.9;
  }

  /**
   * Attendance pattern: late arrivals in last 3 months
   * 0-2: low, 3-5: elevated, 6+: high
   */
  private scoreAttendance(lateArrivals: number): number {
    if (lateArrivals < 3) return 0.1;
    if (lateArrivals < 6) return 0.4;
    return 0.8;
  }

  /**
   * Salary gap: ratio of employee salary to org median
   * < 0.8: high risk (underpaid)
   * 0.8-1.2: normal
   * > 1.2: low risk (well-compensated)
   */
  private scoreSalaryGap(ratio: number): number {
    if (ratio < 0.8) return 0.8;
    if (ratio < 0.95) return 0.5;
    if (ratio < 1.15) return 0.2;
    return 0.1;
  }

  /**
   * Performance rating: lower rating = higher attrition risk
   */
  private scorePerformance(rating: number): number {
    if (rating <= 2) return 0.9;
    if (rating <= 3) return 0.5;
    if (rating <= 4) return 0.2;
    return 0.1;
  }

  /**
   * Team attrition: employees in teams with recent exits are more likely to leave
   */
  private scoreTeamAttrition(teamAttritionRate: number): number {
    return Math.min(1, teamAttritionRate * 2); // 0.5 attrition → 1.0 score
  }

  async extractFeatures(employeeId: string, orgId: string): Promise<AttritionFeatures | null> {
    try {
      // Salary structure — tenure and salary
      const salaryStructure = await this.salaryStructureModel
        .findOne({ employeeId, organizationId: orgId, status: 'active', isDeleted: false })
        .lean();
      if (!salaryStructure) return null;

      const tenureMonths = Math.floor(
        ((salaryStructure as any).effectiveFrom
          ? (Date.now() - new Date((salaryStructure as any).effectiveFrom).getTime()) / (30 * 24 * 60 * 60 * 1000)
          : 12),
      );

      // B-H16/B-H17: previously compared this employee's CTC against the
      // median of EVERY active structure in the org — comparing an intern
      // to the CEO is garbage input. Segment by designation (the closest
      // stand-in for "peer group" we have without an explicit role level)
      // and fall back to the full-org median only when the peer group has
      // too few data points to be reliable. When no salary data exists at
      // all, return `null` instead of a fake `medianSalary = 1` which
      // previously produced astronomical salaryVsMedian scores.
      const MIN_PEER_GROUP_SIZE = 5;
      const designation = (salaryStructure as any).designation || null;

      let salaryVsMedian: number | null = null;
      if (designation) {
        const peerStructures = await this.salaryStructureModel
          .find({
            organizationId: orgId,
            status: 'active',
            isDeleted: false,
            designation,
          })
          .lean();
        const peerSalaries = peerStructures
          .map((s) => s.ctc || 0)
          .filter((v) => v > 0)
          .sort((a, b) => a - b);
        if (peerSalaries.length >= MIN_PEER_GROUP_SIZE) {
          const median = peerSalaries[Math.floor(peerSalaries.length / 2)];
          if (median > 0) salaryVsMedian = (salaryStructure.ctc || 0) / median;
        }
      }
      if (salaryVsMedian === null) {
        const allStructures = await this.salaryStructureModel
          .find({ organizationId: orgId, status: 'active', isDeleted: false })
          .lean();
        const salaries = allStructures
          .map((s) => s.ctc || 0)
          .filter((v) => v > 0)
          .sort((a, b) => a - b);
        if (salaries.length >= MIN_PEER_GROUP_SIZE) {
          const median = salaries[Math.floor(salaries.length / 2)];
          if (median > 0) salaryVsMedian = (salaryStructure.ctc || 0) / median;
        }
      }
      // Still null? Mark as "unknown" by treating the factor as neutral
      // (1.0 = on-market) so it doesn't contribute false signal.
      if (salaryVsMedian === null) salaryVsMedian = 1;

      // Try to get real attendance/leave data from other services
      let avgMonthlyLeaveDays = 2; // default
      let recentLateArrivals = 0; // default

      try {
        const attendanceData = await this.externalServices.getMonthlyAttendance(
          employeeId,
          new Date().getMonth() + 1,
          new Date().getFullYear(),
        );
        if (Array.isArray(attendanceData)) {
          recentLateArrivals = attendanceData.filter((a: any) => a.isLateArrival).length;
        }
      } catch {}

      // Performance rating
      let latestPerformanceRating = 3; // neutral default
      try {
        const review = await this.performanceReviewModel
          .findOne({ employeeId, organizationId: orgId, status: 'finalized', isDeleted: false })
          .sort({ finalizedAt: -1 })
          .lean();
        if (review && (review as any).finalRating) {
          latestPerformanceRating = (review as any).finalRating;
        }
      } catch {}

      // Team attrition (use org-wide recent offboarding rate as proxy)
      const recentExits = await this.offboardingModel.countDocuments({
        organizationId: orgId,
        isDeleted: false,
        status: { $in: ['completed', 'fnf_approved'] },
        createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
      });
      const orgHeadcount = await this.salaryStructureModel.countDocuments({
        organizationId: orgId,
        status: 'active',
        isDeleted: false,
      });
      const previousAttritionInTeam = orgHeadcount > 0
        ? Math.min(1, recentExits / orgHeadcount)
        : 0;

      return {
        employeeId,
        tenureMonths,
        avgMonthlyLeaveDays,
        recentLateArrivals,
        salaryVsMedian,
        latestPerformanceRating,
        previousAttritionInTeam,
      };
    } catch (err) {
      this.logger.warn(`Feature extraction failed for ${employeeId}: ${err.message}`);
      return null;
    }
  }

  predict(features: AttritionFeatures): AttritionPrediction {
    const scores = {
      tenure: this.scoreTenure(features.tenureMonths),
      leaveFrequency: this.scoreLeaveFrequency(features.avgMonthlyLeaveDays),
      attendancePattern: this.scoreAttendance(features.recentLateArrivals),
      salaryGap: this.scoreSalaryGap(features.salaryVsMedian),
      performance: this.scorePerformance(features.latestPerformanceRating),
      teamAttrition: this.scoreTeamAttrition(features.previousAttritionInTeam),
    };

    // Weighted sum
    const rawScore =
      scores.tenure * this.WEIGHTS.tenure +
      scores.leaveFrequency * this.WEIGHTS.leaveFrequency +
      scores.attendancePattern * this.WEIGHTS.attendancePattern +
      scores.salaryGap * this.WEIGHTS.salaryGap +
      scores.performance * this.WEIGHTS.performance +
      scores.teamAttrition * this.WEIGHTS.teamAttrition;

    const riskScore = Math.round(rawScore * 100);

    // Top 3 contributing factors (by weighted contribution)
    const contributions = [
      { name: 'Tenure', value: scores.tenure * this.WEIGHTS.tenure, label: features.tenureMonths < 12 ? 'New employee' : 'Long tenure' },
      { name: 'Leave frequency', value: scores.leaveFrequency * this.WEIGHTS.leaveFrequency, label: 'High leave usage' },
      { name: 'Attendance', value: scores.attendancePattern * this.WEIGHTS.attendancePattern, label: 'Frequent late arrivals' },
      { name: 'Salary gap', value: scores.salaryGap * this.WEIGHTS.salaryGap, label: features.salaryVsMedian < 0.9 ? 'Below market salary' : 'Salary not a factor' },
      { name: 'Performance', value: scores.performance * this.WEIGHTS.performance, label: features.latestPerformanceRating <= 3 ? 'Low performance rating' : 'Strong performance' },
      { name: 'Team attrition', value: scores.teamAttrition * this.WEIGHTS.teamAttrition, label: 'Team attrition spike' },
    ];

    const topFactors = contributions
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .filter(f => f.value > 0.02)
      .map(f => f.label);

    return {
      employeeId: features.employeeId,
      riskScore,
      factors: topFactors,
      confidence: 0.75, // fixed — statistical model, not ML
      predictedAt: new Date(),
    };
  }

  async predictAllEmployees(orgId: string): Promise<AttritionPrediction[]> {
    const activeStructures = await this.salaryStructureModel
      .find({ organizationId: orgId, status: 'active', isDeleted: false })
      .lean();

    const predictions: AttritionPrediction[] = [];
    for (const structure of activeStructures) {
      const features = await this.extractFeatures(structure.employeeId, orgId);
      if (features) {
        predictions.push(this.predict(features));
      }
    }

    // Sort by risk descending
    predictions.sort((a, b) => b.riskScore - a.riskScore);
    return predictions;
  }
}
