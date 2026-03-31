import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IProductHealth, IHealthMetric, IAlert } from './health.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class HealthService {
  constructor(@InjectModel('ProductHealth') private healthModel: Model<IProductHealth>) {}

  /**
   * Check product health
   */
  async checkHealth(productId: string): Promise<IProductHealth> {
    let health = await this.healthModel.findOne({ productId });

    if (!health) {
      health = new this.healthModel({
        productId,
        overallHealth: 100,
        status: 'healthy',
        metrics: [],
        alerts: [],
        lastUpdated: new Date(),
      });
      await health.save();
    }

    // Generate health metrics
    const metrics = this.generateHealthMetrics();
    health.metrics = metrics;
    health.overallHealth = this.calculateOverallHealth(metrics);
    health.status = this.determineStatus(health.overallHealth);
    health.lastUpdated = new Date();

    // Check for alerts
    this.evaluateAlerts(health);

    return health.save();
  }

  /**
   * Get product health
   */
  async getHealth(productId: string): Promise<IProductHealth> {
    const health = await this.healthModel.findOne({ productId });
    if (!health) {
      throw new NotFoundException('Health data not found');
    }
    return health;
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(productId: string): Promise<IAlert[]> {
    const health = await this.getHealth(productId);
    return health.alerts.filter(a => !a.isResolved);
  }

  /**
   * Resolve alert
   */
  async resolveAlert(productId: string, alertId: string): Promise<IProductHealth> {
    const health = await this.getHealth(productId);
    const alert = health.alerts.find(a => a.id === alertId);

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    alert.isResolved = true;
    alert.resolved = new Date();

    return health.save();
  }

  /**
   * Get health trends
   */
  async getHealthTrends(productId: string, days: number = 7): Promise<any> {
    const health = await this.getHealth(productId);

    const trends = {
      productId,
      period: `${days} days`,
      currentHealth: health.overallHealth,
      status: health.status,
      metrics: health.metrics.map(m => ({
        name: m.name,
        value: m.value,
        threshold: m.threshold,
      })),
    };

    return trends;
  }

  /**
   * Generate health metrics
   */
  private generateHealthMetrics(): IHealthMetric[] {
    return [
      {
        name: 'API Response Time',
        value: Math.random() * 500,
        threshold: 1000,
        status: 'healthy',
        timestamp: new Date(),
      },
      {
        name: 'Database Connection Pool',
        value: Math.random() * 100,
        threshold: 80,
        status: 'healthy',
        timestamp: new Date(),
      },
      {
        name: 'Cache Hit Rate',
        value: Math.random() * 100,
        threshold: 70,
        status: 'healthy',
        timestamp: new Date(),
      },
      {
        name: 'Error Rate',
        value: Math.random() * 5,
        threshold: 2,
        status: 'healthy',
        timestamp: new Date(),
      },
      {
        name: 'CPU Usage',
        value: Math.random() * 100,
        threshold: 80,
        status: 'healthy',
        timestamp: new Date(),
      },
      {
        name: 'Memory Usage',
        value: Math.random() * 100,
        threshold: 85,
        status: 'healthy',
        timestamp: new Date(),
      },
    ];
  }

  /**
   * Calculate overall health
   */
  private calculateOverallHealth(metrics: IHealthMetric[]): number {
    if (metrics.length === 0) return 100;

    const healthScores = metrics.map(m => {
      if (m.status === 'healthy') return 100;
      if (m.status === 'warning') return 60;
      return 20;
    });

    return Math.round(healthScores.reduce((a, b) => a + b) / healthScores.length);
  }

  /**
   * Determine status
   */
  private determineStatus(health: number): 'healthy' | 'warning' | 'critical' {
    if (health >= 80) return 'healthy';
    if (health >= 60) return 'warning';
    return 'critical';
  }

  /**
   * Evaluate alerts
   */
  private evaluateAlerts(health: IProductHealth): void {
    health.metrics.forEach(metric => {
      const existingAlert = health.alerts.find(a => a.metric === metric.name && !a.isResolved);

      if (metric.status !== 'healthy') {
        if (!existingAlert) {
          const alert: IAlert = {
            id: uuidv4(),
            productId: health.productId,
            metric: metric.name,
            severity: metric.status === 'critical' ? 'critical' : 'medium',
            message: `${metric.name} is ${metric.status}`,
            triggered: new Date(),
            isResolved: false,
          };
          health.alerts.push(alert);
        }
      } else if (existingAlert && metric.status === 'healthy') {
        existingAlert.isResolved = true;
        existingAlert.resolved = new Date();
      }
    });
  }

  /**
   * Get dashboard summary
   */
  async getDashboardSummary(productId: string): Promise<any> {
    const health = await this.getHealth(productId);

    return {
      productId,
      overallHealth: health.overallHealth,
      status: health.status,
      totalAlerts: health.alerts.length,
      activeAlerts: health.alerts.filter(a => !a.isResolved).length,
      criticalAlerts: health.alerts.filter(a => a.severity === 'critical' && !a.isResolved).length,
      lastUpdated: health.lastUpdated,
      metrics: health.metrics,
    };
  }

  /**
   * Delete health data
   */
  async deleteHealth(productId: string): Promise<void> {
    await this.healthModel.findOneAndDelete({ productId });
  }
}
