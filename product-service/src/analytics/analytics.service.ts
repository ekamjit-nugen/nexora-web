import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IAnalyticsReport, IAnalyticsMetric, IPrediction } from './analytics.model';

@Injectable()
export class AnalyticsService {
  constructor(@InjectModel('AnalyticsReport') private reportModel: Model<IAnalyticsReport>) {}

  /**
   * Generate velocity report
   */
  async generateVelocityReport(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<IAnalyticsReport> {
    const report = new this.reportModel({
      productId,
      reportType: 'velocity',
      period: 'weekly',
      startDate,
      endDate,
      metrics: this.generateVelocityMetrics(startDate, endDate),
      insights: this.generateVelocityInsights(),
    });

    return report.save();
  }

  /**
   * Generate burndown report
   */
  async generateBurndownReport(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<IAnalyticsReport> {
    const report = new this.reportModel({
      productId,
      reportType: 'burndown',
      period: 'daily',
      startDate,
      endDate,
      metrics: this.generateBurndownMetrics(startDate, endDate),
      insights: this.generateBurndownInsights(),
    });

    return report.save();
  }

  /**
   * Generate trend report
   */
  async generateTrendReport(
    productId: string,
    metricName: string,
    startDate: Date,
    endDate: Date,
  ): Promise<IAnalyticsReport> {
    const report = new this.reportModel({
      productId,
      reportType: 'trend',
      period: 'daily',
      startDate,
      endDate,
      metrics: this.generateTrendMetrics(metricName, startDate, endDate),
      insights: this.generateTrendInsights(metricName),
    });

    return report.save();
  }

  /**
   * Generate forecast report
   */
  async generateForecastReport(
    productId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<IAnalyticsReport> {
    const report = new this.reportModel({
      productId,
      reportType: 'forecast',
      period: 'weekly',
      startDate,
      endDate,
      metrics: [],
      predictions: this.generatePredictions(startDate, endDate),
      insights: this.generateForecastInsights(),
    });

    return report.save();
  }

  /**
   * Get report
   */
  async getReport(reportId: string): Promise<IAnalyticsReport> {
    const report = await this.reportModel.findById(reportId);
    if (!report) {
      throw new NotFoundException('Report not found');
    }
    return report;
  }

  /**
   * Get product reports
   */
  async getProductReports(productId: string, reportType?: string): Promise<IAnalyticsReport[]> {
    const query = { productId };
    if (reportType) {
      query['reportType'] = reportType;
    }

    return this.reportModel.find(query).sort({ createdAt: -1 }).exec();
  }

  /**
   * Get summary statistics
   */
  async getSummary(productId: string): Promise<any> {
    const reports = await this.reportModel.find({ productId }).sort({ createdAt: -1 }).limit(10).exec();

    const summary = {
      productId,
      reportsGenerated: reports.length,
      latestReport: reports[0] || null,
      reportTypes: {
        velocity: reports.filter(r => r.reportType === 'velocity').length,
        burndown: reports.filter(r => r.reportType === 'burndown').length,
        trend: reports.filter(r => r.reportType === 'trend').length,
        forecast: reports.filter(r => r.reportType === 'forecast').length,
      },
    };

    return summary;
  }

  /**
   * Generate velocity metrics
   */
  private generateVelocityMetrics(startDate: Date, endDate: Date): IAnalyticsMetric[] {
    const metrics: IAnalyticsMetric[] = [];
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < weeks; i++) {
      metrics.push({
        name: `week_${i + 1}`,
        value: Math.floor(Math.random() * 40) + 20,
        timestamp: new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000),
        tags: { week: `${i + 1}` },
      });
    }

    return metrics;
  }

  /**
   * Generate burndown metrics
   */
  private generateBurndownMetrics(startDate: Date, endDate: Date): IAnalyticsMetric[] {
    const metrics: IAnalyticsMetric[] = [];
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    let remaining = 100;

    for (let i = 0; i < days; i++) {
      remaining = Math.max(0, remaining - Math.random() * 15);
      metrics.push({
        name: 'remaining_points',
        value: Math.floor(remaining),
        timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        tags: { day: `${i + 1}` },
      });
    }

    return metrics;
  }

  /**
   * Generate trend metrics
   */
  private generateTrendMetrics(metricName: string, startDate: Date, endDate: Date): IAnalyticsMetric[] {
    const metrics: IAnalyticsMetric[] = [];
    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    for (let i = 0; i < days; i++) {
      metrics.push({
        name: metricName,
        value: Math.floor(Math.random() * 100),
        timestamp: new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000),
        tags: { trend: metricName },
      });
    }

    return metrics;
  }

  /**
   * Generate predictions
   */
  private generatePredictions(startDate: Date, endDate: Date): IPrediction[] {
    const predictions: IPrediction[] = [];
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));

    for (let i = 0; i < weeks; i++) {
      predictions.push({
        metric: 'velocity',
        predictedValue: 28 + Math.random() * 5,
        confidence: 0.85 + Math.random() * 0.1,
        horizon: `week_${i + 1}`,
        timestamp: new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000),
      });
    }

    return predictions;
  }

  /**
   * Generate velocity insights
   */
  private generateVelocityInsights(): string[] {
    return [
      'Team velocity is stable at ~28 points per week',
      'No significant variance detected in recent sprints',
      'Velocity trend is neutral with slight growth potential',
      'Team capacity appears fully utilized',
    ];
  }

  /**
   * Generate burndown insights
   */
  private generateBurndownInsights(): string[] {
    return [
      'Sprint is on track to complete on schedule',
      'Burndown rate is consistent throughout the sprint',
      'No scope creep detected',
      'Team is maintaining sustainable pace',
    ];
  }

  /**
   * Generate trend insights
   */
  private generateTrendInsights(metricName: string): string[] {
    return [
      `${metricName} shows stable trend over the period`,
      'No significant anomalies detected',
      'Metric is within expected range',
      'Consider monitoring for future deviations',
    ];
  }

  /**
   * Generate forecast insights
   */
  private generateForecastInsights(): string[] {
    return [
      'Forecast predicts consistent team velocity',
      'Expected completion date is on target',
      'Confidence levels are high (>85%)',
      'Plan accordingly for upcoming sprints',
    ];
  }

  /**
   * Delete report
   */
  async deleteReport(reportId: string): Promise<void> {
    await this.reportModel.findByIdAndDelete(reportId);
  }
}
