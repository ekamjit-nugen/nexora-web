import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IPortfolio, IPortfolioProduct, IPortfolioMetrics } from './portfolio.model';

@Injectable()
export class PortfolioService {
  constructor(@InjectModel('Portfolio') private portfolioModel: Model<IPortfolio>) {}

  /**
   * Create portfolio
   */
  async createPortfolio(
    organizationId: string,
    portfolioData: {
      name: string;
      description?: string;
      managers: string[];
    },
  ): Promise<IPortfolio> {
    const portfolio = new this.portfolioModel({
      organizationId,
      ...portfolioData,
      products: [],
      metrics: {
        totalValue: 0,
        activeProducts: 0,
        riskScore: 0,
        healthScore: 0,
        roi: 0,
        timeToMarket: 0,
      },
    });

    return portfolio.save();
  }

  /**
   * Get portfolio
   */
  async getPortfolio(portfolioId: string): Promise<IPortfolio> {
    const portfolio = await this.portfolioModel.findById(portfolioId);
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found');
    }
    return portfolio;
  }

  /**
   * Get organization portfolio
   */
  async getOrganizationPortfolio(organizationId: string): Promise<IPortfolio> {
    const portfolio = await this.portfolioModel.findOne({ organizationId });
    if (!portfolio) {
      throw new NotFoundException('Portfolio not found for organization');
    }
    return portfolio;
  }

  /**
   * Add product to portfolio
   */
  async addProduct(portfolioId: string, product: IPortfolioProduct): Promise<IPortfolio> {
    const portfolio = await this.getPortfolio(portfolioId);

    // Check for duplicate
    if (portfolio.products.some(p => p.productId === product.productId)) {
      throw new BadRequestException('Product already in portfolio');
    }

    portfolio.products.push(product);
    await this.updateMetrics(portfolio);
    return portfolio.save();
  }

  /**
   * Update product in portfolio
   */
  async updateProduct(
    portfolioId: string,
    productId: string,
    updates: Partial<IPortfolioProduct>,
  ): Promise<IPortfolio> {
    const portfolio = await this.getPortfolio(portfolioId);
    const product = portfolio.products.find(p => p.productId === productId);

    if (!product) {
      throw new NotFoundException('Product not found in portfolio');
    }

    Object.assign(product, updates);
    await this.updateMetrics(portfolio);
    return portfolio.save();
  }

  /**
   * Remove product from portfolio
   */
  async removeProduct(portfolioId: string, productId: string): Promise<IPortfolio> {
    const portfolio = await this.getPortfolio(portfolioId);

    portfolio.products = portfolio.products.filter(p => p.productId !== productId);
    await this.updateMetrics(portfolio);
    return portfolio.save();
  }

  /**
   * Update portfolio metrics
   */
  private async updateMetrics(portfolio: IPortfolio): Promise<void> {
    const activeProducts = portfolio.products.filter(p => p.status === 'active').length;
    const totalValue = portfolio.products.reduce((sum, p) => sum + p.investment, 0);
    const totalRevenue = portfolio.products.reduce((sum, p) => sum + p.expectedRevenue, 0);

    portfolio.metrics = {
      totalValue,
      activeProducts,
      riskScore: this.calculateRiskScore(portfolio.products),
      healthScore: this.calculateHealthScore(portfolio.products),
      roi: totalValue > 0 ? ((totalRevenue - totalValue) / totalValue) * 100 : 0,
      timeToMarket: this.calculateTimeToMarket(portfolio.products),
    };
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(products: IPortfolioProduct[]): number {
    if (!products.length) return 0;

    const avgHealthScore = products.reduce((sum, p) => sum + p.healthScore, 0) / products.length;
    return Math.max(0, 100 - avgHealthScore * 2);
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(products: IPortfolioProduct[]): number {
    if (!products.length) return 0;

    return (products.reduce((sum, p) => sum + p.healthScore, 0) / products.length);
  }

  /**
   * Calculate time to market
   */
  private calculateTimeToMarket(products: IPortfolioProduct[]): number {
    const plannedProducts = products.filter(p => p.status === 'planned');
    return plannedProducts.length > 0 ? Math.random() * 12 + 2 : 0; // 2-14 months estimate
  }

  /**
   * Get portfolio statistics
   */
  async getPortfolioStats(portfolioId: string): Promise<any> {
    const portfolio = await this.getPortfolio(portfolioId);

    return {
      portfolioId: portfolio._id,
      metrics: portfolio.metrics,
      productCount: portfolio.products.length,
      productsByStatus: {
        active: portfolio.products.filter(p => p.status === 'active').length,
        planned: portfolio.products.filter(p => p.status === 'planned').length,
        deprecated: portfolio.products.filter(p => p.status === 'deprecated').length,
      },
      topProducts: portfolio.products
        .sort((a, b) => b.expectedRevenue - a.expectedRevenue)
        .slice(0, 5),
      highRiskProducts: portfolio.products.filter(p => p.healthScore < 50),
    };
  }

  /**
   * Update portfolio
   */
  async updatePortfolio(
    portfolioId: string,
    updates: Partial<{
      name: string;
      description: string;
      managers: string[];
    }>,
  ): Promise<IPortfolio> {
    const portfolio = await this.getPortfolio(portfolioId);
    Object.assign(portfolio, updates);
    return portfolio.save();
  }

  /**
   * Delete portfolio
   */
  async deletePortfolio(portfolioId: string): Promise<void> {
    await this.portfolioModel.findByIdAndDelete(portfolioId);
  }
}
